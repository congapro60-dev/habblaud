// Bia tập trên bàn trong phòng session: thay cho màn hình máy tính nhưng vẫn cho biết session đang làm gì.
//   code / terminal: phi tiêu, kunai liên tục ghim vào bia  ·  đọc, tìm, chat: trải cuộn bí kíp
//   progress: thanh chakra chạy  ·  alert: bia nháy đỏ, cần bạn xử lý  ·  idle: bia yên  ·  off: bia tối
import type { Rect, ScreenMode } from './api';

type Ctx = CanvasRenderingContext2D;

const READING: ReadonlySet<ScreenMode> = new Set<ScreenMode>(['browser', 'search', 'chat', 'docs', 'tasks']);
const HIT_MS = 420;
const MAX_HITS = 6;

function hash(a: number, b: number): number {
  let x = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  return (x ^ (x >>> 13)) >>> 0;
}

export function drawTrainingBoard(ctx: Ctx, r: Rect, mode: ScreenMode, t: number, seed: number): void {
  const x = Math.round(r.x);
  const y = Math.round(r.y);
  const w = Math.round(r.w);
  const h = Math.round(r.h);
  if (w <= 0 || h <= 0) return;
  const s = seed >>> 0;
  /** Khối màu, luôn nằm trong khung bia. */
  const fill = (px: number, py: number, pw: number, ph: number, c: string): void => {
    const x0 = Math.max(px, x);
    const y0 = Math.max(py, y);
    const x1 = Math.min(px + pw, x + w);
    const y1 = Math.min(py + ph, y + h);
    if (x1 <= x0 || y1 <= y0) return;
    ctx.fillStyle = c;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  /** Hình bầu dục đặc, vẽ từng hàng. */
  const oval = (cx: number, cy: number, rx: number, ry: number, c: string): void => {
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.01))));
      fill(cx - half, cy + dy, half * 2 + 1, 1, c);
    }
  };

  const cx = x + (w >> 1);
  const cy = y + (h >> 1);
  const off = mode === 'off';
  fill(x, y, w, h, off ? '#8d6b3e' : '#a97a3e');
  fill(x, y, w, 1, off ? '#9c7a4b' : '#c2935a');
  for (let i = 3; i < h; i += 4) fill(x, y + i, w, 1, off ? '#7f5f35' : '#976c35');

  if (READING.has(mode)) {
    // cuộn bí kíp trải ra, chữ hiện dần
    fill(x + 1, y + 2, w - 2, h - 4, '#f1e6c8');
    fill(x, y + 1, w, 1, '#7a4f2a');
    fill(x, y + h - 2, w, 1, '#7a4f2a');
    const lines = Math.floor(t / 300 + (s % 7)) % 5;
    for (let i = 0; i < 4; i++) {
      if (i > lines) break;
      const len = 4 + (hash(s, i) % (w - 7));
      fill(x + 3, y + 3 + i * 2, len, 1, i % 3 === 2 ? '#c8452f' : '#3a2c1c');
    }
    return;
  }

  if (mode === 'alert') {
    const on = Math.floor(t / 350) % 2 === 0;
    fill(x, y, w, h, on ? '#d8452f' : '#f2b33d');
    fill(cx, cy - 4, 2, 6, '#fff7e6');
    fill(cx, cy + 3, 2, 2, '#fff7e6');
    return;
  }

  // mặt bia đổi theo chỗ ngồi: bia tròn, cọc gỗ hoặc bùa giấy
  const face = s % 3;
  const rx = Math.max(2, (w >> 1) - 2);
  const ry = Math.max(2, (h >> 1) - 1);
  if (face === 1) {
    fill(cx - 3, y + 1, 7, h - 2, off ? '#5c4226' : '#6d4627');
    fill(cx - 7, cy - 3, 4, 2, off ? '#6b4d2c' : '#8a5a30');
    fill(cx + 4, cy, 4, 2, off ? '#6b4d2c' : '#8a5a30');
    fill(cx - 3, cy + 2, 7, 1, off ? '#a8966e' : '#d8c48f');
  } else if (face === 2) {
    fill(cx - 4, y + 1, 9, h - 2, off ? '#cfc6a8' : '#f1e6c8');
    fill(cx, y + 3, 1, h - 6, off ? '#96523c' : '#c8452f');
    fill(cx - 2, cy, 5, 1, off ? '#96523c' : '#c8452f');
  } else {
    oval(cx, cy, rx, ry, off ? '#cfc6a8' : '#f4efe2');
    oval(cx, cy, Math.max(1, rx - 2), Math.max(1, ry - 2), off ? '#96523c' : '#c8452f');
    oval(cx, cy, Math.max(1, rx - 4), Math.max(1, ry - 3), off ? '#cfc6a8' : '#f4efe2');
    fill(cx, cy, 1, 1, off ? '#96523c' : '#c8452f');
  }
  if (off || mode === 'standby') return;

  if (mode === 'code' || mode === 'terminal') {
    const step = Math.floor(t / HIT_MS);
    const age = (t % HIT_MS) / HIT_MS;
    const round = Math.floor(step / MAX_HITS);
    const hits = step % MAX_HITS;
    for (let i = 0; i <= hits; i++) {
      const k = hash(s + round, i);
      const hx = x + 2 + (k % Math.max(1, w - 4));
      const hy = y + 2 + ((k >>> 8) % Math.max(1, h - 4));
      const newest = i === hits && age < 0.3;
      if (mode === 'code') {
        // phi tiêu bốn cánh
        const c = newest ? '#ffffff' : '#475569';
        fill(hx - 1, hy, 3, 1, c);
        fill(hx, hy - 1, 1, 3, c);
        fill(hx, hy, 1, 1, newest ? '#fde047' : '#cbd5e1');
      } else {
        // kunai có đuôi đỏ
        fill(hx, hy, 1, 2, newest ? '#ffffff' : '#334155');
        fill(hx + 1, hy - 1, 1, 1, '#d8452f');
      }
    }
  } else if (mode === 'progress') {
    // thanh chakra chạy dọc chân bia trong lúc chờ lệnh
    fill(x + 1, y + h - 3, w - 2, 2, '#1e293b');
    const run = Math.floor(((t / 1400 + (s % 5) / 5) % 1) * (w - 2));
    fill(x + 1, y + h - 3, run, 2, '#38bdf8');
  }
}
