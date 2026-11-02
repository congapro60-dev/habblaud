// Vẽ các màn hoá hình: tụ chakra, hình vĩ thú, cầu vĩ thú và sóng xung kích, tên chiêu. Sprite cache sẵn, không vẽ lại mỗi khung.
import { BEAST_AX, BEAST_AY, BEAST_FRAMES, renderBeast, type BeastKind } from '../../art/beasts';
import { BEAST_CHARGE_MS, BEAST_FADE_MS, type BeastEvent } from '../sim/beast-show';

const FRAME_MS = 220;
const PULSE_MS = 3_400;

const AURA: Partial<Record<BeastKind, string>> = {
  kurama: '#ff8a2c', shukaku: '#d9b36a', gyuki: '#a06cd5', matatabi: '#5f8bff', isobu: '#a9b5a0', songoku: '#ff5a3c',
  kokuo: '#fff3d0', saiken: '#cfe9f2', choumei: '#7fe0b8', juubi: '#c8313a', gamabunta: '#ff7a3c', manda: '#9a5fe0', katsuyu: '#bfe3ff',
  enma: '#d9a441', susanoo_blue: '#5fa8ff', susanoo_purple: '#b070ff', susanoo_red: '#ff5a50', hagoromo: '#fff0a8', naruto_sixpaths: '#ffe07a',
};

/** Có bắn cầu vĩ thú. */
const BIJUU: ReadonlySet<BeastKind> = new Set<BeastKind>(['kurama', 'shukaku', 'gyuki', 'matatabi', 'isobu', 'songoku', 'kokuo', 'saiken', 'choumei', 'juubi']);

/** Cỡ vẽ so với sprite: vĩ thú, linh thú, Susanoo khổng lồ so với ninja; người hoá hình nhỏ hơn. Giữ nét pixel. */
function scaleOf(kind: BeastKind): number {
  if (kind === 'naruto_sixpaths') return 1;
  if (kind === 'hagoromo') return 1.5;
  return 2;
}

const cache = new Map<string, HTMLCanvasElement>();

function sprite(kind: BeastKind, frame: number): HTMLCanvasElement {
  const key = `${kind}:${frame}`;
  let c = cache.get(key);
  if (c) return c;
  const buf = renderBeast(kind, frame);
  c = document.createElement('canvas');
  c.width = buf.w;
  c.height = buf.h;
  c.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(buf.data), buf.w, buf.h), 0, 0);
  cache.set(key, c);
  return c;
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, width: number, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawOne(ctx: CanvasRenderingContext2D, e: BeastEvent, now: number): void {
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  const aura = AURA[e.kind] ?? '#ffffff';
  const age = now - e.startAt;

  if (age < BEAST_CHARGE_MS) {
    // tụ chakra: các vòng thu dần vào người, lóe sáng ngay trước khi hiện hình
    const k = age / BEAST_CHARGE_MS;
    ctx.globalAlpha = 0.25 + k * 0.4;
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 10 + k * 18, 14 + k * 26, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const p = (k * 2 + i / 3) % 1;
      ring(ctx, x, y, 44 * (1 - p), 16 * (1 - p), aura, 2, 0.8 * p);
    }
    if (k > 0.85) {
      ctx.globalAlpha = (k - 0.85) / 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y - 34, 52, 52, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  const alpha = Math.min(1, (e.endAt - now) / BEAST_FADE_MS, (age - BEAST_CHARGE_MS) / 240 + 0.3);
  const frame = Math.floor(now / FRAME_MS) % BEAST_FRAMES;
  const s = sprite(e.kind, frame);
  const sc = scaleOf(e.kind);

  // bóng và hào quang dưới chân
  ctx.globalAlpha = 0.28 * alpha;
  ctx.fillStyle = '#10131c';
  ctx.beginPath();
  ctx.ellipse(x, y, 46 * sc, 12 * sc, 0, 0, Math.PI * 2);
  ctx.fill();
  const flow = (now % 1_600) / 1_600;
  ring(ctx, x, y, (34 + flow * 24) * sc, (10 + flow * 7) * sc, aura, 2, (1 - flow) * 0.7 * alpha);

  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  const dw = Math.round(s.width * sc);
  const dh = Math.round(s.height * sc);
  if (e.flip) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(s, Math.round(-BEAST_AX * sc), Math.round(y - BEAST_AY * sc), dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(s, Math.round(x - BEAST_AX * sc), Math.round(y - BEAST_AY * sc), dw, dh);
  }

  // cầu vĩ thú: tụ trước miệng rồi nổ thành sóng xung kích
  if (BIJUU.has(e.kind)) {
    const t = ((age - BEAST_CHARGE_MS) % PULSE_MS) / PULSE_MS;
    const mx = x + (e.flip ? -1 : 1) * 12 * sc;
    const my = y - 62 * sc;
    if (t < 0.45) {
      const r = (2 + (t / 0.45) * 12) * sc;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#17121f';
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ring(ctx, mx, my, r + 2, r + 2, aura, 2, alpha);
    } else if (t < 0.75) {
      const p = (t - 0.45) / 0.3;
      ring(ctx, x, y - 20 * sc, (30 + p * 110) * sc, (14 + p * 52) * sc, aura, 4 * (1 - p) + 1, (1 - p) * alpha);
      ring(ctx, x, y - 20 * sc, (16 + p * 80) * sc, (8 + p * 36) * sc, '#ffffff', 2, (1 - p) * 0.8 * alpha);
    }
  }

  // tên chiêu
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(e.label).width + 12;
  const ly = Math.round(y - BEAST_AY * sc - 8);
  ctx.fillStyle = 'rgba(16,19,28,0.82)';
  ctx.fillRect(Math.round(x - w / 2), ly - 8, Math.round(w), 16);
  ctx.fillStyle = aura;
  ctx.fillRect(Math.round(x - w / 2), ly + 7, Math.round(w), 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(e.label, x, ly);
  ctx.globalAlpha = 1;
}

export function drawBeastEvents(ctx: CanvasRenderingContext2D, events: readonly BeastEvent[], now: number): void {
  if (!events.length) return;
  ctx.save();
  // con ở xa camera (y nhỏ) vẽ trước
  for (const e of [...events].sort((a, b) => a.y - b.y)) drawOne(ctx, e, now);
  ctx.restore();
}
