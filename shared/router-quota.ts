// Quota das contas do 9Router como o Habblaud expõe em /api/router/quota (só leitura, sem credenciais).

export interface RouterQuotaWindow {
  key: string;
  label: string;
  used: number | null;
  total: number | null;
  /** 0..100; null quando o 9Router não informa nada utilizável. */
  remainingPct: number | null;
  resetAt: string | null;
  unlimited: boolean;
}

export interface RouterQuotaAccount {
  id: string;
  provider: string;
  /** Nome da conexão no 9Router (geralmente o e-mail da conta). */
  label: string;
  /** testStatus do 9Router: active, unavailable... */
  status: string;
  plan: string | null;
  /** Aviso do 9Router para a conta (ex.: precisa reconectar). */
  message: string | null;
  limitReached: boolean;
  windows: RouterQuotaWindow[];
  /** Quando estes números foram lidos com sucesso (ms); null = nunca. */
  fetchedAt: number | null;
  /** Erro da última tentativa; os números acima continuam os da última leitura boa. */
  error: string | null;
}

/**
 * Janelas para olhar de relance: quando a conta tem totais (`gemini_weekly`, `claude_gpt_session`...), as linhas por
 * modelo só repetem o mesmo limite; senão mostra tudo.
 */
export function summaryWindows(windows: readonly RouterQuotaWindow[]): RouterQuotaWindow[] {
  const totals = windows.filter((w) => /_(weekly|session)$/.test(w.key));
  return totals.length ? totals : [...windows];
}

/** Contas ativas primeiro; dentro de cada grupo, a ordem do 9Router (prioridade). */
export function accountsForDisplay(accounts: readonly RouterQuotaAccount[]): RouterQuotaAccount[] {
  return [...accounts.filter((a) => a.status === 'active'), ...accounts.filter((a) => a.status !== 'active')];
}

export interface CompactQuotaWindow extends RouterQuotaWindow {
  level: 'ok' | 'low' | 'out' | 'na';
}

export interface CompactQuotaRow {
  provider: string;
  /** Phần trước @ của e-mail, gọn cho góc màn hình. */
  label: string;
  windows: CompactQuotaWindow[];
}

/** Mức cảnh báo theo phần trăm còn lại. */
export function quotaLevel(pct: number | null): CompactQuotaWindow['level'] {
  if (pct === null) return 'na';
  return pct <= 5 ? 'out' : pct <= 25 ? 'low' : 'ok';
}

/**
 * Bản thu gọn cho màn hình nền: chỉ tài khoản đang dùng được, mỗi tài khoản tối đa 2 hạn mức sắp hết nhất.
 * `hidden` là số tài khoản không dùng được đã lược bỏ.
 */
export function compactQuota(snap: Pick<RouterQuotaSnapshot, 'accounts'>): { rows: CompactQuotaRow[]; hidden: number } {
  const usable = snap.accounts.filter((a) => a.status === 'active' && !a.limitReached);
  const rows = usable.map((a) => ({
    provider: a.provider,
    label: a.label.split('@')[0],
    windows: summaryWindows(a.windows)
      .slice()
      .sort((x, y) => (x.unlimited ? 101 : x.remainingPct ?? 100) - (y.unlimited ? 101 : y.remainingPct ?? 100))
      .slice(0, 2)
      .map((w) => ({ ...w, level: w.unlimited ? ('ok' as const) : quotaLevel(w.remainingPct) })),
  }));
  return { rows, hidden: snap.accounts.length - usable.length };
}

export interface RouterQuotaSnapshot {
  baseUrl: string;
  /** ok = a última consulta respondeu; unavailable = 9Router não respondeu (mostrando a cópia salva). */
  health: 'ok' | 'unavailable' | 'unknown';
  checkedAt: number | null;
  /** Última vez que a lista de contas veio do 9Router. */
  fetchedAt: number | null;
  error: string | null;
  accounts: RouterQuotaAccount[];
}
