import { createHash } from 'node:crypto';
import type { Activity, AgentStatus, SourceInfo } from '../../shared/types';
import { truncate } from '../../shared/activity';
import { tr } from '../../shared/i18n';
import type { Office, TranscriptSummary } from '../model/office';
import { isLoopbackBind } from '../config';
import type { AgentSource } from './source';

type JsonRecord = Record<string, unknown>;

interface OpenCodeEvent {
  type?: string;
  properties?: JsonRecord;
}

interface OpenCodeSession {
  id: string;
  directory?: string;
  title?: string;
  status?: string;
  model?: string | JsonRecord;
  providerID?: string;
  modelID?: string;
  time?: { created?: number; updated?: number };
}

export interface OpenCodeSourceOptions {
  office: Office;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => number;
  pollMs?: number;
}

interface TrackedSession {
  id: string;
  key: string;
  directory: string;
  status: AgentStatus;
  title?: string;
  model?: string;
  lastAt: number;
  digest: string;
}

const OFFLINE_GRACE_MS = 20_000;
const DEFAULT_POLL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_RECENT_HOURS = 24;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function modelLabel(session: OpenCodeSession): string | undefined {
  if (typeof session.model === 'string') return truncate(session.model, 160);
  const model = record(session.model);
  const provider = stringValue(model.providerID) ?? session.providerID;
  const id = stringValue(model.modelID) ?? stringValue(model.id) ?? session.modelID;
  return provider && id ? truncate(`${provider}/${id}`, 160) : undefined;
}

function sessionFrom(value: unknown): OpenCodeSession | undefined {
  const r = record(value);
  const id = stringValue(r.id) ?? stringValue(r.sessionID);
  if (!id) return undefined;
  const time = record(r.time);
  return {
    id,
    directory: stringValue(r.directory) ?? stringValue(r.cwd),
    title: stringValue(r.title),
    status: stringValue(r.status),
    model: typeof r.model === 'string' || (r.model && typeof r.model === 'object') ? r.model as string | JsonRecord : undefined,
    providerID: stringValue(r.providerID),
    modelID: stringValue(r.modelID),
    time: {
      created: typeof time.created === 'number' ? time.created : undefined,
      updated: typeof time.updated === 'number' ? time.updated : undefined,
    },
  };
}

function sessionStatus(value: unknown): string {
  if (typeof value === 'string') return value.toLowerCase();
  const r = record(value);
  return (stringValue(r.status) ?? stringValue(r.type) ?? stringValue(r.state) ?? '').toLowerCase();
}

export function statusOf(session: OpenCodeSession, statuses: JsonRecord): { status: AgentStatus; waitingFor?: string } {
  const raw = sessionStatus(statuses[session.id] ?? session.status);
  if (raw.includes('permission') || raw.includes('question') || raw.includes('waiting')) return { status: 'waiting', waitingFor: tr('OpenCode cần bạn') };
  if (raw.includes('busy') || raw.includes('running') || raw.includes('stream') || raw.includes('working')) return { status: 'working' };
  if (raw.includes('error') || raw.includes('failed')) return { status: 'idle' };
  return { status: 'idle' };
}

function activityFor(status: AgentStatus, title?: string, model?: string): Activity {
  const suffix = model ? ` · ${model}` : '';
  if (status === 'waiting') return { id: '', kind: 'ask', icon: '✋', text: truncate(tr('OpenCode chờ bạn{0}', [suffix]), 46), at: 0 };
  if (status === 'working') return { id: '', kind: 'think', icon: '✎', text: truncate(tr('{0} đang làm{1}', [title || 'OpenCode', suffix]), 46), at: 0 };
  return { id: '', kind: 'done', icon: '✓', text: truncate(tr('{0} đã xong{1}', [title || 'OpenCode', suffix]), 46), at: 0 };
}

function hash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function loopbackUrl(value: string): string | undefined {
  if (!value) return undefined;
  try {
  const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '') || !isLoopbackBind(url.hostname)) return undefined;
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

function parseDirectories(env: NodeJS.ProcessEnv): Array<string | undefined> {
  const raw = env.HABBLAUD_OPENCODE_DIRS?.trim();
  if (!raw) return [undefined];
  return raw.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}

export class OpenCodeSource implements AgentSource {
  /** Keep AgentSource's existing provider contract; `engine` identifies OpenCode and blocks Codex controls. */
  readonly provider = 'claude' as const;
  private readonly url: string;
  private readonly routerUrl: string;
  private readonly authorization?: string;
  private readonly directories: Array<string | undefined>;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly pollMs: number;
  private readonly recentMs: number;
  /** v1 uses /session and /event; v2 uses /api/session and /api/global/event. */
  private apiPrefix = '';
  private readonly office: Office;
  private readonly sessions = new Map<string, TrackedSession>();
  private readonly seenEvents = new Set<string>();
  private readonly sourceState: SourceInfo = { label: tr('OpenCode'), provider: 'claude', engine: 'opencode', path: '', sessions: 0, ok: true };
  private timer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  private polling = false;
  private eventControllers: AbortController[] = [];
  private routerModelCount?: number;
  private lastRouterCheck = 0;

  constructor(options: OpenCodeSourceOptions) {
    const env = options.env ?? process.env;
    this.office = options.office;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    const configuredPoll = options.pollMs ?? Number(env.HABBLAUD_OPENCODE_POLL_MS);
    this.pollMs = Math.max(250, Number.isFinite(configuredPoll) && configuredPoll > 0 ? configuredPoll : DEFAULT_POLL_MS);
    const recentHours = Number(env.HABBLAUD_OPENCODE_RECENT_HOURS);
    this.recentMs = (Number.isFinite(recentHours) && recentHours >= 0 ? recentHours : DEFAULT_RECENT_HOURS) * 3_600_000;
    const rawUrl = (env.HABBLAUD_OPENCODE_URL ?? '').trim();
    this.url = loopbackUrl(rawUrl) ?? '';
    this.routerUrl = loopbackUrl((env.HABBLAUD_9ROUTER_URL ?? 'http://127.0.0.1:20128').trim()) ?? '';
    const username = env.HABBLAUD_OPENCODE_USERNAME;
    const password = env.HABBLAUD_OPENCODE_PASSWORD;
    if (username && password) this.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    this.directories = parseDirectories(env);
    this.sourceState.path = this.url || tr('tắt');
    if (rawUrl && !this.url) {
      this.sourceState.ok = false;
      this.sourceState.error = tr('OpenCode phải dùng URL loopback không kèm credential');
    }
  }

  async start(): Promise<void> {
    if (!this.url) return;
    this.stopped = false;
    this.office.beginBoot();
    try {
      await this.detectApiVersion();
      await this.pollAsync(true);
    } finally {
      this.office.endBoot();
    }
    this.timer = setInterval(() => this.poll(false), this.pollMs);
    this.timer.unref?.();
    for (const directory of this.directories) void this.watchEvents(directory);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    for (const controller of this.eventControllers) controller.abort();
    this.eventControllers = [];
  }

  sources(): SourceInfo[] {
    this.sourceState.sessions = this.sessions.size;
    this.sourceState.label = this.routerModelCount === undefined ? tr('OpenCode') : tr('OpenCode · 9Router {0} model', [this.routerModelCount]); 
    return [{ ...this.sourceState }];
  }

  transcriptPathOf(): string | undefined {
    return undefined;
  }

  private async request(path: string): Promise<unknown> {
    const headers = new Headers({ Accept: 'application/json' });
    if (this.authorization) headers.set('Authorization', this.authorization);
    const response = await this.fetchBounded(`${this.url}${this.apiPrefix}${path}`, { headers });
    if (!response.ok) throw new Error(`OpenCode HTTP ${response.status}`);
    return response.json();
  }

  private async detectApiVersion(): Promise<void> {
    try {
      const headers = new Headers({ Accept: 'application/json' });
      if (this.authorization) headers.set('Authorization', this.authorization);
      const response = await this.fetchBounded(`${this.url}/api/session`, { headers });
      const contentType = response.headers?.get('content-type') ?? '';
      this.apiPrefix = response.ok && (contentType.includes('json') || contentType === '') ? '/api' : '';
    } catch {
      this.apiPrefix = '';
    }
  }

  private async fetchBounded(input: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await this.fetchImpl(input, { ...init, redirect: 'error', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private poll(boot: boolean): void {
    if (this.stopped || this.polling) return;
    this.polling = true;
    void this.pollAsync(boot).finally(() => { this.polling = false; });
  }

  private async pollAsync(boot: boolean): Promise<void> {
    if (!this.url) return;
    try {
      const seen = new Set<string>();
      for (const directory of this.directories) {
        const query = directory ? `?directory=${encodeURIComponent(directory)}` : '';
        const [rawSessions, rawStatuses] = await Promise.all([
          this.request(`/session${query}`),
          this.request(`/session/status${query}`).catch(() => ({})),
        ]);
        const statuses = record(rawStatuses);
        for (const raw of arrayValue(rawSessions)) {
          const session = sessionFrom(raw);
          if (!session) continue;
          const cwd = session.directory ?? directory ?? process.cwd();
          const key = `opencode:${hash(cwd)}:${session.id}`;
          const mapped = statusOf(session, statuses);
          const previous = this.sessions.get(key);
          const updatedAt = session.time?.updated ?? session.time?.created ?? 0;
          if (mapped.status === 'idle' && this.recentMs > 0 && updatedAt && this.now() - updatedAt > this.recentMs) continue;
          seen.add(key);
          this.sync(session, key, cwd, statuses, boot);
        }
      }
      const now = this.now();
      for (const [key, tracked] of this.sessions) {
        if (seen.has(key)) continue;
        if (now - tracked.lastAt < OFFLINE_GRACE_MS) continue;
        this.office.closeMain(key);
        this.sessions.delete(key);
      }
      this.sourceState.ok = true;
      delete this.sourceState.error;
      this.sourceState.sessions = this.sessions.size;
      if (!this.lastRouterCheck || this.now() - this.lastRouterCheck >= 60_000) await this.refreshRouterMetadata();
    } catch (error) {
      this.sourceState.ok = false;
      this.sourceState.error = error instanceof Error && error.message.includes('HTTP') ? error.message : tr('OpenCode không phản hồi');
    }
  }

  private sync(session: OpenCodeSession, key: string, cwd: string, statuses: JsonRecord, boot: boolean): void {
    const now = this.now();
    const mapped = statusOf(session, statuses);
    const model = modelLabel(session);
    const digest = `${mapped.status}|${mapped.waitingFor ?? ''}|${session.title ?? ''}|${model ?? ''}`;
    const previous = this.sessions.get(key);
    if (!previous) {
      this.office.addMain({ id: key, provider: 'claude', engine: 'opencode', account: 'opencode', sessionId: session.id, cwd, role: 'OpenCode', startedAt: session.time?.created ?? now, status: mapped.status, waitingFor: mapped.waitingFor });
      this.sessions.set(key, { id: session.id, key, directory: cwd, status: mapped.status, title: session.title, model, lastAt: now, digest });
      this.applySummary(key, session, model);
      this.addActivity(key, mapped.status, session.title, model, now, boot);
      return;
    }
    previous.lastAt = now;
    if (previous.digest !== digest) {
      previous.digest = digest;
      previous.status = mapped.status;
      previous.title = session.title;
      previous.model = model;
      this.office.setStatus(key, mapped.status, mapped.waitingFor);
      this.applySummary(key, session, model);
      this.addActivity(key, mapped.status, session.title, model, now, boot);
    }
  }

  private applySummary(key: string, session: OpenCodeSession, model?: string): void {
    const summary: TranscriptSummary = { title: session.title, tasks: [], stats: { toolCalls: 0, tokensIn: 0, tokensOut: 0, subagents: 0 } };
    if (model) summary.model = model;
    this.office.applyTranscript(key, summary);
  }

  private addActivity(key: string, status: AgentStatus, title: string | undefined, model: string | undefined, at: number, boot: boolean): void {
    const a = activityFor(status, title, model);
    a.id = `${key}#opencode:${hash(`${status}|${title ?? ''}|${model ?? ''}|${at}`)}`;
    a.at = at;
    this.office.addActivity(key, a, true, { feed: !boot });
  }

  private async refreshRouterMetadata(): Promise<void> {
    this.lastRouterCheck = this.now();
    try {
      const response = await this.fetchBounded(`${this.routerUrl}/v1/models`, { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const body = record(await response.json());
      this.routerModelCount = arrayValue(body.data).length;
    } catch {
      // Router metadata is optional. OpenCode observation remains usable.
    }
  }

  private async watchEvents(directory: string | undefined): Promise<void> {
    if (!this.url || this.stopped) return;
    const controller = new AbortController();
    this.eventControllers.push(controller);
    try {
      while (!this.stopped) {
        try {
          const query = this.apiPrefix ? '' : (directory ? `?directory=${encodeURIComponent(directory)}` : '');
          const headers = new Headers({ Accept: 'text/event-stream' });
          if (this.authorization) headers.set('Authorization', this.authorization);
          const response = await this.fetchImpl(`${this.url}${this.apiPrefix ? '/api/global/event' : '/event'}${query}`, { headers, redirect: 'error', signal: controller.signal });
          if (!response.ok || !response.body) throw new Error(`OpenCode event HTTP ${response.status}`);
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let pending = '';
          while (!this.stopped) {
            const chunk = await reader.read();
            if (chunk.done) break;
            pending += decoder.decode(chunk.value, { stream: true });
            const frames = pending.split(/\n\n+/);
            pending = frames.pop() ?? '';
            for (const frame of frames) {
              const data = /^data:\s*(\{.*\})/ms.exec(frame)?.[1];
              if (!data) continue;
              try {
                const event = JSON.parse(data) as OpenCodeEvent;
                this.consumeEvent(event);
              } catch {
                // Ignore malformed/unknown event payloads; bounded polling repairs state.
              }
            }
          }
        } catch {
          if (this.stopped) break;
        }
        if (!this.stopped) await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    } finally {
      this.eventControllers = this.eventControllers.filter((x) => x !== controller);
    }
  }

  private consumeEvent(event: OpenCodeEvent): void {
    const type = stringValue(event.type)?.toLowerCase();
    if (!type || !event.properties) return;
    const p = event.properties;
    const info = record(p.info);
    const part = record(p.part);
    const sessionId = stringValue(p.sessionID) ?? stringValue(info.sessionID);
    if (!sessionId) {
      if (type === 'session.status') this.poll(false);
      return;
    }
    const tracked = [...this.sessions.values()].find((s) => s.id === sessionId);
    if (!tracked) return;
    const partId = stringValue(part.id) ?? stringValue(p.partID) ?? '';
    const eventId = stringValue(p.id) ?? stringValue(info.id) ?? partId;
    const dedupe = `${tracked.key}|${type}|${eventId || JSON.stringify([p.status, part.type, part.state])}`;
    if (this.seenEvents.has(dedupe)) return;
    this.seenEvents.add(dedupe);
    if (this.seenEvents.size > 2_000) this.seenEvents.delete(this.seenEvents.values().next().value as string);
    const now = this.now();
    let activity: Activity | undefined;
    if (type === 'session.status' || type === 'session.created' || type === 'session.updated' || type === 'permission.replied') {
      this.poll(false);
      return;
    }
    if (type === 'message.updated') {
      const provider = stringValue(info.providerID);
      const model = stringValue(info.modelID);
      if (provider && model && tracked.model !== `${provider}/${model}`) {
        tracked.model = truncate(`${provider}/${model}`, 160);
        tracked.digest = `${tracked.status}|${tracked.status === 'waiting' ? 'OpenCode cần bạn' : ''}|${tracked.title ?? ''}|${tracked.model}`;
        this.applySummary(tracked.key, { id: tracked.id, title: tracked.title }, tracked.model);
      }
      return;
    }
    if (type === 'session.idle') {
      tracked.status = 'idle';
      tracked.digest = `idle||${tracked.title ?? ''}|${tracked.model ?? ''}`;
      this.office.setStatus(tracked.key, 'idle');
      activity = activityFor('idle', tracked.title, tracked.model);
    } else if (type === 'permission.asked') {
      tracked.status = 'waiting';
      tracked.digest = `waiting|OpenCode cần bạn|${tracked.title ?? ''}|${tracked.model ?? ''}`;
      this.office.setStatus(tracked.key, 'waiting', tr('OpenCode cần bạn'));
      activity = activityFor('waiting', tracked.title, tracked.model);
    } else if (type === 'session.error' || type === 'session.status.error') {
      activity = { id: '', kind: 'error', icon: '⚠', text: tr('OpenCode báo lỗi'), at: 0, error: true };
    } else if (type.includes('message.part.updated')) {
      const partType = stringValue(part.type)?.toLowerCase();
      if (partType === 'tool') {
        const state = stringValue(record(part.state).status)?.toLowerCase();
        const tool = stringValue(part.tool);
        const label = tool && /^[a-z0-9_-]{1,32}$/i.test(tool) ? truncate(tool, 24) : tr('công cụ');
        activity = { id: '', kind: 'run', icon: '⚙', text: truncate(tr('Đang dùng {0}', [label]), 46), at: 0 };
        if (state === 'error') { activity.kind = 'error'; activity.error = true; }
      } else if (partType === 'text') {
        activity = { id: '', kind: 'respond', icon: '✎', text: tr('Đang soạn phản hồi'), at: 0 };
      } else if (partType === 'reasoning') {
        activity = { id: '', kind: 'think', icon: '✦', text: tr('Đang suy luận'), at: 0 };
      }
    } else if (type.includes('file.edited') || type.includes('file.watcher.updated')) {
      activity = { id: '', kind: 'edit', icon: '✎', text: tr('Đã cập nhật tệp'), at: 0 };
    }
    if (activity) {
      activity.id = `${tracked.key}#opencode-event:${hash(dedupe)}`;
      activity.at = now;
      this.office.addActivity(tracked.key, activity, true);
    }
  }
}
