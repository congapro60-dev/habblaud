import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { accountsForDisplay, compactQuota, summaryWindows, type RouterQuotaAccount } from '../shared/router-quota';
import { parseWindows, RouterQuotaService } from './router-quota';

const ENV = { HABBLAUD_9ROUTER_URL: 'http://127.0.0.1:20128' };
const dirs: string[] = [];
function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'router-quota-'));
  dirs.push(dir);
  return join(dir, 'router-quota.json');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const CONNECTIONS = {
  connections: [
    { id: 'c1', provider: 'claude', name: 'Account 1', testStatus: 'active', isActive: true, accessToken: 'sk-secret' },
    { id: 'c2', provider: 'codex', name: 'me@example.com', testStatus: 'active', isActive: true },
    { id: 'c3', provider: 'codex', name: 'off', testStatus: 'active', isActive: false },
  ],
  pagination: { page: 1, totalPages: 1 },
};
const USAGE: Record<string, unknown> = {
  c1: { plan: 'Claude Code', quotas: { 'weekly (7d)': { used: 64, total: 100, remaining: 36, remainingPercentage: 36, resetAt: '2026-11-04T14:59:59Z', unlimited: false } } },
  c2: { plan: 'plus', limitReached: false, refreshToken: 'nope', quotas: { weekly: { used: 74, total: 100, remaining: 26, resetAt: '2026-11-04T06:35:32Z', unlimited: false } } },
};

function router(alive: () => boolean): typeof fetch {
  return (async (input: string | URL | Request) => {
    if (!alive()) throw new Error('connect ECONNREFUSED');
    const url = new URL(String(input));
    if (url.pathname === '/api/providers/client') return new Response(JSON.stringify(CONNECTIONS));
    const id = url.pathname.split('/').pop()!;
    return new Response(JSON.stringify(USAGE[id] ?? {}));
  }) as typeof fetch;
}

describe('quota 9Router', () => {
  it('normaliza as janelas: usa remainingPercentage ou calcula pelo restante', () => {
    const w = parseWindows({ a: { used: 1, total: 4, remaining: 3 }, b: { remainingPercentage: 41.35862, displayName: 'Gemini (Weekly)' }, c: { unlimited: true } });
    expect(w.map((x) => [x.key, x.label, x.remainingPct, x.unlimited])).toEqual([
      ['a', 'a', 75, false],
      ['b', 'Gemini (Weekly)', 41.4, false],
      ['c', 'c', null, true],
    ]);
  });

  it('de relance: só os totais quando existem; contas ativas primeiro', () => {
    const anti = parseWindows({ 'gemini-3.8-flash-low': { used: 7, total: 1000 }, gemini_weekly: { used: 586, total: 1000 }, claude_gpt_session: { used: 0, total: 1000 } });
    expect(summaryWindows(anti).map((w) => w.key)).toEqual(['gemini_weekly', 'claude_gpt_session']);
    const codex = parseWindows({ session: { used: 22, total: 100 }, weekly: { used: 74, total: 100 } });
    expect(summaryWindows(codex).map((w) => w.key)).toEqual(['session', 'weekly']);
    const acc = (id: string, status: string) => ({ id, status }) as RouterQuotaAccount;
    expect(accountsForDisplay([acc('a', 'unavailable'), acc('b', 'active'), acc('c', 'active')]).map((a) => a.id)).toEqual(['b', 'c', 'a']);
  });

  it('bản thu gọn cho màn hình nền: chỉ tài khoản dùng được, 2 hạn mức sắp hết nhất, có cảnh báo', () => {
    const acc = (over: Partial<RouterQuotaAccount>): RouterQuotaAccount => ({ id: 'x', provider: 'codex', label: 'me@mail.com', status: 'active', plan: null, message: null, limitReached: false, windows: [], fetchedAt: 1, error: null, ...over });
    const view = compactQuota({
      accounts: [
        acc({ windows: parseWindows({ a: { used: 10, total: 100 }, b: { used: 80, total: 100 }, c: { used: 98, total: 100 } }) }),
        acc({ status: 'unavailable' }),
        acc({ limitReached: true }),
      ],
    });
    expect(view.hidden).toBe(2);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0].label).toBe('me');
    expect(view.rows[0].windows.map((w) => [w.key, w.level])).toEqual([['c', 'out'], ['b', 'low']]);
  });

  it('lê contas ativas e quotas sem expor credenciais', async () => {
    const svc = new RouterQuotaService(tmpFile(), ENV, router(() => true), () => 1_000);
    const snap = await svc.refresh(true);
    expect(snap.health).toBe('ok');
    expect(snap.accounts.map((a) => [a.id, a.plan, a.windows[0]?.remainingPct])).toEqual([
      ['c1', 'Claude Code', 36],
      ['c2', 'plus', 26],
    ]);
    expect(JSON.stringify(snap)).not.toMatch(/sk-secret|nope|token/i);
  });

  it('9Router fora do ar: mantém a última leitura boa, com a hora dela, e marca indisponível', async () => {
    let alive = true;
    let t = 1_000;
    const file = tmpFile();
    const svc = new RouterQuotaService(file, ENV, router(() => alive), () => t);
    await svc.refresh(true);
    alive = false;
    t = 500_000;
    const down = await svc.refresh(true);
    expect(down.health).toBe('unavailable');
    expect(down.error).toMatch(/ECONNREFUSED/);
    expect(down.accounts[0]).toMatchObject({ id: 'c1', fetchedAt: 1_000 });

    // reinício do Habblaud com o 9Router ainda fora: a cópia salva aparece
    const fresh = new RouterQuotaService(file, ENV, router(() => false), () => t);
    expect(fresh.snapshot().accounts.map((a) => a.windows[0]?.remainingPct)).toEqual([36, 26]);
    expect(fresh.snapshot().fetchedAt).toBe(1_000);
  });

  it('uma conta falhando não apaga os números antigos dela', async () => {
    let failC2 = false;
    let t = 1_000;
    const base = router(() => true);
    const svc = new RouterQuotaService(tmpFile(), ENV, (async (input: string | URL | Request, init?: RequestInit) => {
      if (failC2 && String(input).endsWith('/api/usage/c2')) return new Response('', { status: 200 });
      return base(input, init);
    }) as typeof fetch, () => t);
    await svc.refresh(true);
    failC2 = true;
    t = 2_000;
    const snap = await svc.refresh(true);
    const c2 = snap.accounts.find((a) => a.id === 'c2')!;
    expect(c2).toMatchObject({ plan: 'plus', fetchedAt: 1_000 });
    expect(c2.error).toMatch(/rỗng/);
    expect(snap.accounts.find((a) => a.id === 'c1')!.fetchedAt).toBe(2_000);
  });

  it('9Router travado: current() responde na hora com o salvo, sem esperar a consulta', async () => {
    let hang = false;
    let t = 1_000;
    const base = router(() => true);
    const svc = new RouterQuotaService(tmpFile(), ENV, (async (input: string | URL | Request, init?: RequestInit) => {
      if (hang) return new Promise<Response>(() => undefined);
      return base(input, init);
    }) as typeof fetch, () => t);
    await svc.refresh(true);
    hang = true;
    t = 500_000;
    const snap = svc.current();
    expect(snap.accounts.map((a) => a.windows[0]?.remainingPct)).toEqual([36, 26]);
    expect(snap.fetchedAt).toBe(1_000);
  });

  it('lista responde mas nenhuma conta dá leitura: indisponível, sem fingir que atualizou', async () => {
    let failUsage = false;
    let t = 1_000;
    const base = router(() => true);
    const svc = new RouterQuotaService(tmpFile(), ENV, (async (input: string | URL | Request, init?: RequestInit) => {
      if (failUsage && String(input).includes('/api/usage/')) return new Response('', { status: 200 });
      return base(input, init);
    }) as typeof fetch, () => t);
    await svc.refresh(true);
    failUsage = true;
    t = 2_000;
    const snap = await svc.refresh(true);
    expect(snap.health).toBe('unavailable');
    expect(snap.fetchedAt).toBe(1_000);
    expect(snap.accounts[0]).toMatchObject({ plan: 'Claude Code', fetchedAt: 1_000 });
  });

  it('recusa URL fora do loopback sem chamar a rede', async () => {
    const svc = new RouterQuotaService(tmpFile(), { HABBLAUD_9ROUTER_URL: 'https://router.example' }, (async () => {
      throw new Error('must not call');
    }) as typeof fetch);
    expect((await svc.refresh(true)).health).toBe('unavailable');
  });
});
