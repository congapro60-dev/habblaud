// 9Router read-only cockpit. Discovery only; no model turn, no credential exposure.
import { isLoopbackBind } from './config';
import { assertCoordinationScope, assertDepartmentModel, modelFamily, type WorkOrder } from '../shared/work-orders';

export type RouterHealth = 'ok' | 'unavailable' | 'unknown';
export type RouterCostClass = 'free-verified' | 'subscription' | 'paid-api' | 'unknown';
export type RouterQuotaState = 'usable' | 'exhausted' | 'unknown';

export interface RouterModelInfo {
  providerId: string;
  modelId: string;
  family?: string;
  /** Trusted route telemetry only; /v1/models does not populate this. */
  servedModel?: string;
  supportsTools?: boolean;
  context?: number;
  reasoning?: string;
  costClass: RouterCostClass;
  quotaState: RouterQuotaState;
  health: RouterHealth;
}

export interface RouterCatalog {
  baseUrl: string;
  checkedAt: number | null;
  health: RouterHealth;
  quotaState: RouterQuotaState;
  models: RouterModelInfo[];
  error?: string;
}

export interface RouteSelection {
  providerId: string;
  modelId: string;
  servedModel?: string;
  role: 'planner' | 'worker' | 'reviewer' | 'director';
  policy: 'free-fast' | 'balanced-code' | 'deep-code' | 'review-code';
  costClass: string;
  quotaState: string;
  health: string;
  evidenceRefs: string[];
  degraded?: string;
  selectedAt: number;
}

const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_MS = 60_000;

function loopbackUrl(raw: string): string {
  try {
    const url = new URL(raw || 'http://127.0.0.1:20128');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !isLoopbackBind(url.hostname)) return '';
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseModel(value: unknown): RouterModelInfo | undefined {
  const item = record(value);
  const id = string(item.id) ?? string(item.model);
  if (!id) return undefined;
  const metadata = record(item.metadata);
  const capabilities = record(item.capabilities);
  return {
    providerId: '9router',
    modelId: id.slice(0, 200),
    family: string(item.owned_by) ?? string(item.family),
    // ponytail: discovery has no served telemetry; wire trusted adapter evidence before department dispatch.
    supportsTools: typeof item.supportsTools === 'boolean' ? item.supportsTools : typeof metadata.supportsTools === 'boolean' ? metadata.supportsTools : typeof capabilities.tools === 'boolean' ? capabilities.tools : undefined,
    context: number(item.context_length) ?? number(metadata.context_length),
    reasoning: string(item.reasoning),
    // A model name or `free` badge is not cost proof. Canary promotion belongs to P1B.
    costClass: 'unknown',
    quotaState: 'unknown',
    health: 'ok',
  };
}

export class RouterService {
  private catalog: RouterCatalog;
  private pending?: Promise<RouterCatalog>;

  constructor(
    env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    const baseUrl = loopbackUrl(env.HABBLAUD_9ROUTER_URL ?? 'http://127.0.0.1:20128');
    this.catalog = { baseUrl, checkedAt: null, health: baseUrl ? 'unknown' : 'unavailable', quotaState: 'unknown', models: [], ...(baseUrl ? {} : { error: '9Router URL phải là loopback' }) };
  }

  snapshot(): RouterCatalog {
    return structuredClone(this.catalog);
  }

  async refresh(force = false): Promise<RouterCatalog> {
    if (!force && this.catalog.checkedAt !== null && this.now() - this.catalog.checkedAt < CACHE_MS) return this.snapshot();
    if (this.pending) return this.pending;
    this.pending = this.fetchCatalog().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  async select(modelId: string | undefined, policy: RouteSelection['policy'], role: RouteSelection['role'], scope?: WorkOrder): Promise<RouteSelection> {
    if (scope) assertCoordinationScope(scope);
    if (scope && modelId) assertDepartmentModel(scope, modelId);
    const catalog = await this.refresh();
    const models = scope?.coordinationMode === 'department'
      ? catalog.models.filter((item) => modelFamily(item.modelId) === scope.servedFamily && item.health === 'ok' && item.quotaState !== 'exhausted' && item.costClass !== 'paid-api' && item.supportsTools === true)
      : catalog.models;
    const model = modelId
      ? models.find((item) => item.modelId === modelId)
      : models.find((item) => item.modelId === 'ag/gemini-3.8-flash-high' && item.supportsTools === true)
        ?? models.find((item) => /^(?:ag|cx|cc|gc)\//.test(item.modelId) && item.supportsTools === true);
    if (catalog.health !== 'ok' || !model) throw new Error('9Router chưa có model khỏe để chọn route');
    if (role !== 'director' && model.supportsTools !== true) throw new Error('route chưa xác nhận capability tools');
    if (policy === 'free-fast' && model.costClass !== 'free-verified') throw new Error('route free-fast cần model đã xác minh free');
    return {
      providerId: model.providerId,
      modelId: model.modelId,
      ...(scope?.coordinationMode === 'department' ? { servedModel: model.servedModel ?? 'unknown' } : {}),
      role,
      policy,
      costClass: model.costClass,
      quotaState: model.quotaState,
      health: model.health,
      evidenceRefs: [`9router:/v1/models#${model.modelId}`],
      ...(model.costClass === 'unknown' || model.quotaState === 'unknown' ? { degraded: 'cost-or-quota-unknown' } : {}),
      selectedAt: this.now(),
    };
  }

  private async fetchCatalog(): Promise<RouterCatalog> {
    const baseUrl = this.catalog.baseUrl;
    if (!baseUrl) return this.snapshot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(`${baseUrl}/v1/models`, { headers: { Accept: 'application/json' }, redirect: 'error', signal: controller.signal });
      if (!response.ok) throw new Error(`9Router HTTP ${response.status}`);
      const body = record(await response.json());
      const models = Array.isArray(body.data) ? body.data.map(parseModel).filter((x): x is RouterModelInfo => !!x) : [];
      this.catalog = { baseUrl, checkedAt: this.now(), health: 'ok', quotaState: 'unknown', models };
    } catch (error) {
      this.catalog = { ...this.catalog, checkedAt: this.now(), health: 'unavailable', quotaState: 'unknown', models: [], error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) };
    } finally {
      clearTimeout(timer);
    }
    return this.snapshot();
  }
}
