// Quota das contas do 9Router dentro do Habblaud (/api/router/quota). O servidor guarda a última leitura boa, então
// o painel continua útil quando a página local do 9Router trava ou cai: mostra os números salvos e há quanto tempo.
import { tr } from '../../../shared/i18n';
import { accountsForDisplay, summaryWindows, type RouterQuotaAccount, type RouterQuotaSnapshot, type RouterQuotaWindow } from '../../../shared/router-quota';
import type { UiComponent, UiContext } from './context';
import { h, iconButton, setText } from './dom';
import { ICONS } from './icons';

/** Atualiza sozinho enquanto o painel está aberto (o servidor consulta o 9Router em segundo plano). */
const REFRESH_MS = 15_000;

function ago(at: number | null, now: number): string {
  if (!at) return tr('chưa từng');
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return tr('{0} giây trước', [String(s)]);
  if (s < 3600) return tr('{0} phút trước', [String(Math.round(s / 60))]);
  return tr('{0} giờ trước', [String(Math.round(s / 3600))]);
}

function resetIn(iso: string | null, now: number): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const m = Math.round((t - now) / 60_000);
  if (m <= 0) return tr('đã reset');
  if (m < 60) return tr('reset sau {0} phút', [String(m)]);
  if (m < 48 * 60) return tr('reset sau {0} giờ', [String(Math.round(m / 60))]);
  return tr('reset sau {0} ngày', [String(Math.round(m / 1440))]);
}

/** Cor da barra pelo que sobra: verde, âmbar, vermelho. */
function level(pct: number | null): 'ok' | 'low' | 'out' | 'na' {
  if (pct === null) return 'na';
  return pct <= 5 ? 'out' : pct <= 25 ? 'low' : 'ok';
}

export class RouterQuotaPanel implements UiComponent {
  readonly button: HTMLButtonElement;
  readonly el: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly list: HTMLElement;
  private readonly refreshBtn: HTMLButtonElement;
  private open = false;
  private loading = false;
  private snap: RouterQuotaSnapshot | null = null;
  private loadError: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly ctx: UiContext) {
    this.button = iconButton(ICONS.quota, tr('Quota 9Router'), () => this.toggle(), 'ui-btn-quota');
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.status = h('p', { class: 'ui-quota__status', role: 'status', attrs: { 'aria-live': 'polite' } });
    this.list = h('div', { class: 'ui-quota__list' });
    this.refreshBtn = h('button', { class: 'ui-btn ui-quota__refresh', type: 'button', text: tr('Làm mới'), on: { click: () => void this.load(true) } });
    this.panel = h('section', { class: 'ui-popover ui-quota', role: 'dialog', tabIndex: -1, attrs: { 'aria-label': tr('Quota 9Router'), id: 'ui-quota', popover: 'auto' } },
      h('div', { class: 'ui-quota__head' },
        h('strong', { text: tr('Quota 9Router') }),
        this.refreshBtn,
        h('button', { class: 'ui-btn ui-quota__close', type: 'button', text: '×', attrs: { 'aria-label': tr('Fechar') }, on: { click: () => this.hide() } })),
      this.status,
      this.list,
    );
    this.panel.addEventListener('toggle', (ev) => {
      if ((ev as ToggleEvent).newState === 'closed' && this.open) this.hide();
    });
    this.el = h('div', { class: 'ui-quota-root' }, this.panel);
  }

  toggle(): void {
    this.open ? this.hide() : this.show();
  }

  show(): void {
    this.open = true;
    // abre embaixo do botão, alinhado à direita (como o histórico)
    const r = this.button.getBoundingClientRect();
    this.panel.style.top = `${Math.round(r.bottom + 8)}px`;
    this.panel.style.right = `${Math.max(8, Math.round(innerWidth - r.right - 4))}px`;
    if (typeof this.panel.showPopover === 'function' && !this.panel.matches(':popover-open')) this.panel.showPopover();
    else this.panel.classList.add('is-open');
    void this.load(false);
    this.timer ??= setInterval(() => void this.load(false), REFRESH_MS);
    this.ctx.invalidate();
  }

  hide(): void {
    this.open = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof this.panel.hidePopover === 'function' && this.panel.matches(':popover-open')) this.panel.hidePopover();
    this.panel.classList.remove('is-open');
    this.ctx.invalidate();
  }

  render(): void {
    this.button.classList.toggle('is-on', this.open);
    const down = this.snap?.health === 'unavailable';
    this.button.classList.toggle('is-warn', down);
    if (this.open) this.renderPanel();
  }

  private async load(force: boolean): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.renderPanel();
    try {
      const res = await fetch(`/api/router/quota${force ? '?force=1' : ''}`, { credentials: 'same-origin', cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as (RouterQuotaSnapshot & { error?: string }) | null;
      if (!res.ok || !body) throw new Error(body?.error || `HTTP ${res.status}`);
      this.snap = body;
      this.loadError = null;
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
      this.ctx.invalidate();
    }
  }

  private renderPanel(): void {
    const now = Date.now();
    const snap = this.snap;
    this.refreshBtn.disabled = this.loading;
    setText(this.refreshBtn, this.loading ? tr('Đang tải…') : tr('Làm mới'));
    let line: string;
    if (this.loadError) line = tr('Không lấy được quota từ Habblaud: {0}', [this.loadError]);
    else if (!snap) line = tr('Đang tải…');
    else if (snap.health === 'unavailable') line = tr('⚠️ 9Router không phản hồi ({0}). Đang hiện số liệu đã lưu, cập nhật {1}.', [snap.error ?? '?', ago(snap.fetchedAt, now)]);
    else if (snap.health === 'unknown') line = tr('Đang kiểm tra 9Router… Số liệu đã lưu, cập nhật {0}.', [ago(snap.fetchedAt, now)]);
    else line = tr('9Router hoạt động · cập nhật {0}', [ago(snap.fetchedAt, now)]);
    setText(this.status, line);
    this.status.classList.toggle('is-warn', !!this.loadError || snap?.health === 'unavailable');
    if (!snap) return;
    if (!snap.accounts.length) {
      this.list.replaceChildren(h('p', { class: 'ui-quota__empty', text: tr('Chưa có dữ liệu quota nào được lưu.') }));
      return;
    }
    this.list.replaceChildren(...accountsForDisplay(snap.accounts).map((a) => this.renderAccount(a, now)));
  }

  private renderAccount(a: RouterQuotaAccount, now: number): HTMLElement {
    const bad = a.status !== 'active' || a.limitReached;
    const meta = [a.plan, a.status !== 'active' ? a.status : null, a.limitReached ? tr('hết hạn mức') : null].filter(Boolean).join(' · ');
    const notes: HTMLElement[] = [];
    if (a.message) notes.push(h('p', { class: 'ui-quota__note', text: a.message }));
    if (a.error) notes.push(h('p', { class: 'ui-quota__note is-warn', text: tr('Lần đọc gần nhất lỗi ({0}); số dưới đây từ {1}.', [a.error, ago(a.fetchedAt, now)]) }));
    return h('div', { class: `ui-quota__acct${bad ? ' is-dim' : ''}` },
      h('div', { class: 'ui-quota__acct-head' },
        h('span', { class: 'ui-quota__provider', text: a.provider }),
        h('span', { class: 'ui-quota__label', text: a.label, title: a.label }),
        h('span', { class: 'ui-quota__meta', text: meta })),
      ...notes,
      ...summaryWindows(a.windows).map((w) => this.renderWindow(w, now)),
    );
  }

  private renderWindow(w: RouterQuotaWindow, now: number): HTMLElement {
    const lv = w.unlimited ? 'ok' : level(w.remainingPct);
    const pct = w.unlimited ? 100 : w.remainingPct ?? 0;
    const value = w.unlimited ? tr('không giới hạn') : w.remainingPct === null ? '—' : `${Math.round(w.remainingPct)}%`;
    const bar = h('div', { class: `ui-quota__bar is-${lv}` }, h('div', { class: 'ui-quota__fill' }));
    (bar.firstChild as HTMLElement).style.width = `${pct}%`;
    return h('div', { class: 'ui-quota__win' },
      h('span', { class: 'ui-quota__win-label', text: w.label, title: w.label }),
      bar,
      h('span', { class: 'ui-quota__win-value', text: value }),
      h('span', { class: 'ui-quota__reset', text: resetIn(w.resetAt, now) }),
    );
  }
}
