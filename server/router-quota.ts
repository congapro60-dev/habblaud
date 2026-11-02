// Quota das contas do 9Router, lida das mesmas rotas do painel /dashboard/quota dele (/api/providers/client e
// /api/usage/:id) e guardada em <dataDir>/router-quota.json: quando o 9Router trava ou cai, o Habblaud continua
// mostrando a última leitura boa de cada conta, com a hora dela. Só leitura; nunca expõe token nem chave.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isLoopbackBind } from './config';
import { errMsg, log } from './log';
import type { RouterQuotaAccount, RouterQuotaSnapshot, RouterQuotaWindow } from '../shared/router-quota';

const LIST_TIMEOUT_MS = 10_000;
const USAGE_TIMEOUT_MS = 25_000;
/** Consulta em segundo plano: a cópia salva fica em dia mesmo sem ninguém olhando. */
const POLL_MS = 120_000;
/** Pedidos da interface dentro desta janela reaproveitam a última consulta (cada consulta chega até os provedores). */
const CACHE_MS = 60_000;
const MAX_PAGES = 10;
const CONCURRENCY = 3;

function loopbackUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !isLoopbackBind(url.hostname)) return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, max = 200): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Normaliza `quotas` do /api/usage/:id (o formato muda um pouco entre Claude, Codex, Antigravity...). */
export function parseWindows(quotas: unknown): RouterQuotaWindow[] {
  const out: RouterQuotaWindow[] = [];
  for (const [key, raw] of Object.entries(record(quotas))) {
    const q = record(raw);
    const used = num(q.used);
    const total = num(q.total);
    const remaining = num(q.remaining);
    let pct = num(q.remainingPercentage);
    if (pct === null && total && total > 0) pct = remaining !== null ? (remaining / total) * 100 : used !== null ? ((total - used) / total) * 100 : null;
    out.push({
      key: key.slice(0, 80),
      label: str(q.displayName, 80) ?? key.slice(0, 80),
      used,
      total,
      remainingPct: pct === null ? null : Math.max(0, Math.min(100, Math.round(pct * 10) / 10)),
      resetAt: str(q.resetAt, 40),
      unlimited: q.unlimited === true,
    });
  }
  return out;
}

export class RouterQuotaService {
  private snap: RouterQuotaSnapshot;
  private pending?: Promise<RouterQuotaSnapshot>;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly file: string,
    env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    const baseUrl = loopbackUrl((env.HABBLAUD_9ROUTER_URL ?? 'http://127.0.0.1:20128').trim());
    this.snap = { baseUrl, health: baseUrl ? 'unknown' : 'unavailable', checkedAt: null, fetchedAt: null, error: baseUrl ? null : '9Router URL phải là loopback', accounts: [] };
    this.load();
  }

  start(): void {
    if (this.timer || !this.snap.baseUrl) return;
    void this.refresh(true);
    this.timer = setInterval(() => void this.refresh(true), POLL_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  snapshot(): RouterQuotaSnapshot {
    return structuredClone(this.snap);
  }

  /** Responde na hora com o que está salvo e atualiza em segundo plano: um 9Router travado nunca segura a interface. */
  current(): RouterQuotaSnapshot {
    void this.refresh(false);
    return this.snapshot();
  }

  async refresh(force = false): Promise<RouterQuotaSnapshot> {
    if (!this.snap.baseUrl) return this.snapshot();
    if (!force && this.snap.checkedAt !== null && this.now() - this.snap.checkedAt < CACHE_MS) return this.snapshot();
    if (this.pending) return this.pending;
    this.pending = this.poll().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private async poll(): Promise<RouterQuotaSnapshot> {
    const checkedAt = this.now();
    let conns: Record<string, unknown>[];
    try {
      conns = await this.listConnections();
    } catch (err) {
      // 9Router fora do ar: mantém as contas e números salvos, só marca o estado
      this.snap = { ...this.snap, health: 'unavailable', checkedAt, error: errMsg(err).slice(0, 300) };
      return this.snapshot();
    }
    const previous = new Map(this.snap.accounts.map((a) => [a.id, a]));
    const accounts: RouterQuotaAccount[] = [];
    const queue = conns.filter((c) => c.isActive !== false);
    const work = async (): Promise<void> => {
      for (let c = queue.shift(); c; c = queue.shift()) accounts.push(await this.readAccount(c, previous.get(String(c.id)), checkedAt));
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, work));
    const order = new Map(conns.map((c, i) => [String(c.id), i]));
    accounts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    // a lista respondeu mas nenhuma conta deu leitura (9Router sobrecarregado): os números continuam os antigos
    const anyRead = accounts.some((a) => a.fetchedAt === checkedAt);
    if (accounts.length && !anyRead) {
      this.snap = { ...this.snap, health: 'unavailable', checkedAt, error: accounts.find((a) => a.error)?.error ?? null, accounts };
    } else {
      this.snap = { ...this.snap, health: 'ok', checkedAt, fetchedAt: checkedAt, error: null, accounts };
    }
    this.save();
    return this.snapshot();
  }

  private async listConnections(): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = record(await this.getJson(`/api/providers/client?page=${page}&pageSize=100&sort=priority`, LIST_TIMEOUT_MS));
      const list = Array.isArray(body.connections) ? body.connections.map(record) : [];
      all.push(...list.filter((c) => typeof c.id === 'string'));
      const pg = record(body.pagination);
      const pages = num(pg.totalPages) ?? num(pg.pages) ?? 1;
      if (!list.length || page >= pages) break;
    }
    return all;
  }

  private async readAccount(c: Record<string, unknown>, prev: RouterQuotaAccount | undefined, at: number): Promise<RouterQuotaAccount> {
    const base: RouterQuotaAccount = {
      id: String(c.id).slice(0, 80),
      provider: str(c.provider, 40) ?? 'unknown',
      label: str(c.name, 120) ?? str(c.email, 120) ?? String(c.id).slice(0, 12),
      status: str(c.testStatus, 40) ?? 'unknown',
      plan: prev?.plan ?? null,
      message: prev?.message ?? null,
      limitReached: prev?.limitReached ?? false,
      windows: prev?.windows ?? [],
      fetchedAt: prev?.fetchedAt ?? null,
      error: null,
    };
    try {
      const u = record(await this.getJson(`/api/usage/${encodeURIComponent(base.id)}`, USAGE_TIMEOUT_MS));
      return {
        ...base,
        plan: str(u.plan, 60),
        message: str(u.message, 300),
        limitReached: u.limitReached === true,
        windows: parseWindows(u.quotas),
        fetchedAt: at,
      };
    } catch (err) {
      return { ...base, error: errMsg(err).slice(0, 300) };
    }
  }

  private async getJson(path: string, timeoutMs: number): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.snap.baseUrl}${path}`, { headers: { Accept: 'application/json' }, redirect: 'error', signal: controller.signal });
      if (!res.ok) throw new Error(`9Router HTTP ${res.status}`);
      const text = await res.text();
      if (!text.trim()) throw new Error('9Router trả về rỗng');
      return JSON.parse(text);
    } catch (err) {
      if (controller.signal.aborted) throw new Error(`9Router không phản hồi sau ${Math.round(timeoutMs / 1000)} giây`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private load(): void {
    try {
      const data = record(JSON.parse(readFileSync(this.file, 'utf8')));
      if (!Array.isArray(data.accounts)) return;
      this.snap = { ...this.snap, fetchedAt: num(data.fetchedAt), accounts: data.accounts as RouterQuotaAccount[] };
    } catch {
      // sem cópia salva ainda
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify({ version: 1, fetchedAt: this.snap.fetchedAt, accounts: this.snap.accounts }));
      renameSync(tmp, this.file);
      log.clearOnce('router-quota-write');
    } catch (err) {
      log.warnOnce('router-quota-write', `Không ghi được ${this.file} (${errMsg(err)}); quota 9Router chỉ giữ trong bộ nhớ.`);
    }
  }
}
