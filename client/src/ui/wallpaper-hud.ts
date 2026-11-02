// Lớp phủ của chế độ màn hình nền (?wallpaper=1): bảng quota 9Router thu gọn luôn hiện, và nút zoom để không bao giờ kẹt
// ở mức phóng to (hình nền không có bàn phím và không có thanh công cụ). Không thao tác một lúc thì tự về toàn cảnh.
import { compactQuota, type RouterQuotaSnapshot } from '../../../shared/router-quota';
import { h, setText } from './dom';
import type { WorldApi } from '../world';

const POLL_MS = 30_000;
/** Không thao tác trong khoảng này thì tự về toàn cảnh. */
const IDLE_RECENTER_MS = 45_000;

function ago(at: number | null, now: number): string {
  if (!at) return 'chưa có dữ liệu';
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s} giây trước`;
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  return `${Math.round(s / 3600)} giờ trước`;
}

function resetIn(iso: string | null, now: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return '';
  const m = Math.round((t - now) / 60_000);
  if (m <= 0) return 'đã reset';
  if (m < 60) return `${m}p`;
  if (m < 48 * 60) return `${Math.round(m / 60)}g`;
  return `${Math.round(m / 1440)}n`;
}

export function mountWallpaperHud(root: HTMLElement, world: WorldApi): void {
  const status = h('div', { class: 'ui-wall-quota__status' });
  const list = h('div', { class: 'ui-wall-quota__list' });
  const quota = h('section', { class: 'ui-wall-quota', attrs: { 'aria-label': 'Quota 9Router' } }, h('strong', { text: 'Quota 9Router' }), status, list);

  let interacted = false;
  let lastInput = 0;
  const touched = () => {
    interacted = true;
    lastInput = Date.now();
  };
  const button = (text: string, label: string, act: () => void) =>
    h('button', {
      class: 'ui-wall-zoom__btn',
      type: 'button',
      text,
      title: label,
      attrs: { 'aria-label': label },
      on: {
        click: () => {
          act();
          touched();
        },
      },
    });
  const zoom = h(
    'div',
    { class: 'ui-wall-zoom', role: 'group', attrs: { 'aria-label': 'Thu phóng' } },
    button('+', 'Phóng to', () => world.zoomBy(1.25)),
    button('−', 'Thu nhỏ', () => world.zoomBy(1 / 1.25)),
    button('⌂', 'Xem toàn cảnh', () => world.overview()),
  );
  root.append(quota, zoom);

  window.addEventListener('pointerdown', touched, { passive: true });
  window.addEventListener('wheel', touched, { passive: true });
  window.addEventListener('dblclick', touched, { passive: true });
  setInterval(() => {
    if (!interacted || Date.now() - lastInput < IDLE_RECENTER_MS) return;
    interacted = false;
    world.overview();
  }, 2_000);

  let snap: RouterQuotaSnapshot | null = null;
  const render = () => {
    const now = Date.now();
    if (!snap) return;
    const down = snap.health === 'unavailable';
    quota.classList.toggle('is-down', down);
    setText(status, `${down ? '⚠️ 9Router không phản hồi · ' : ''}cập nhật ${ago(snap.fetchedAt, now)}`);
    const view = compactQuota(snap);
    const rows: HTMLElement[] = view.rows.map((row) =>
      h(
        'div',
        { class: 'ui-wall-quota__acct' },
        h('div', { class: 'ui-wall-quota__name', text: `${row.provider} · ${row.label}` }),
        ...row.windows.map((w) => {
          const pct = w.remainingPct ?? 0;
          const fill = h('i');
          fill.style.width = `${w.unlimited ? 100 : pct}%`;
          return h(
            'div',
            { class: `ui-wall-quota__win is-${w.level}` },
            h('span', { text: w.label }),
            h('b', {}, fill),
            h('span', { class: 'ui-wall-quota__pct', text: w.unlimited ? '∞' : w.remainingPct === null ? '—' : `${Math.round(pct)}%` }),
            h('span', { class: 'ui-wall-quota__reset', text: resetIn(w.resetAt, now) }),
          );
        }),
      ),
    );
    if (view.hidden > 0) rows.push(h('div', { class: 'ui-wall-quota__more', text: `+${view.hidden} tài khoản không dùng được` }));
    list.replaceChildren(...rows);
  };
  const poll = async () => {
    try {
      const res = await fetch('/api/router/quota', { cache: 'no-store' });
      if (res.ok) snap = (await res.json()) as RouterQuotaSnapshot;
    } catch {
      // server đang khởi động lại: giữ số đang hiện
    }
    render();
  };
  void poll();
  setInterval(() => void poll(), POLL_MS);
  // "cập nhật X giây trước" vẫn chạy giữa hai lần hỏi
  setInterval(render, 5_000);
}
