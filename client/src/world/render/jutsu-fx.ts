// Vẽ nhẫn thuật: mỗi chiêu một dáng riêng, chia pha tụ lực, bay tới và trúng đòn theo tiến độ p (0..1).
// Vẽ bằng khối đặc, không dùng gradient, để nét rõ và nhẹ khi nhiều trận diễn cùng lúc.
import type { JutsuKind } from '../sim/jutsu';

type Ctx = CanvasRenderingContext2D;

export interface Fighter {
  x: number;
  y: number;
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Tiến độ cục bộ trong đoạn [a, b] của chiêu. */
const seg = (p: number, a: number, b: number): number => clamp01((p - a) / (b - a));
/** Số giả ngẫu nhiên ổn định theo chỉ số, để mảnh vỡ không nhảy loạn giữa các khung. */
const rnd = (i: number): number => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function disc(ctx: Ctx, x: number, y: number, r: number, c: string, a = 1): void {
  if (r <= 0 || a <= 0) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ring(ctx: Ctx, x: number, y: number, rx: number, ry: number, c: string, w: number, a = 1): void {
  if (rx <= 0 || ry <= 0 || a <= 0) return;
  ctx.globalAlpha = a;
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string, w: number, a = 1): void {
  if (a <= 0) return;
  ctx.globalAlpha = a;
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, c: string, a = 1): void {
  if (a <= 0) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Sét gấp khúc từ A tới B, đổi hình theo thời gian. */
function bolt(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string, w: number, a: number, tick: number): void {
  ctx.globalAlpha = a;
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  const n = 6;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    ctx.lineTo(lerp(x0, x1, k) + (rnd(i + tick) - 0.5) * 12, lerp(y0, y1, k) + (rnd(i * 3 + tick) - 0.5) * 12);
  }
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** Mảnh vỡ bắn tung ra từ điểm trúng đòn. */
function burst(ctx: Ctx, x: number, y: number, k: number, colors: readonly string[], count = 14, reach = 34): void {
  for (let i = 0; i < count; i++) {
    const a = rnd(i) * Math.PI * 2;
    const d = reach * (0.4 + rnd(i + 40) * 0.6) * k;
    const s = 2 + Math.floor(rnd(i + 80) * 2);
    box(ctx, x + Math.cos(a) * d - s / 2, y + Math.sin(a) * d * 0.7 - s / 2 + k * k * 8, s, s, colors[i % colors.length], 1 - k);
  }
}

/** Rồng nhiều đốt uốn lượn từ A tới B, đầu đi trước. */
function dragon(ctx: Ctx, a: Fighter, b: Fighter, k: number, now: number, body: string, dark: string, eye: string): void {
  const n = 12;
  for (let i = n; i >= 0; i--) {
    const q = clamp01(k - (i / n) * 0.5) / Math.max(0.01, 1);
    const x = lerp(a.x, b.x, q);
    const y = lerp(a.y - 6, b.y - 14, q) - Math.sin(q * Math.PI) * 26 + Math.sin(now / 90 + i) * 3;
    const r = i === 0 ? 8 : 7 - i * 0.28;
    disc(ctx, x, y + 1, r, dark);
    disc(ctx, x, y, r - 1, body);
    if (i === 0) {
      box(ctx, x - 3, y - 3, 2, 2, eye);
      box(ctx, x + 2, y - 3, 2, 2, eye);
    }
  }
}

type Draw = (ctx: Ctx, a: Fighter, b: Fighter, p: number, now: number) => void;

const hand = (a: Fighter, b: Fighter): { x: number; y: number } => ({ x: a.x + (b.x >= a.x ? 9 : -9), y: a.y - 13 });

const DRAW: Record<JutsuKind, Draw> = {
  rasengan(ctx, a, b, p, now) {
    const h = hand(a, b);
    const k = seg(p, 0.3, 0.68);
    const x = lerp(h.x, b.x, k);
    const y = lerp(h.y, b.y - 13, k);
    if (p < 0.68) {
      const r = 3 + seg(p, 0, 0.3) * 7;
      disc(ctx, x, y, r + 2, '#1d6fd1');
      disc(ctx, x, y, r, '#7fd0ff');
      for (let i = 0; i < 3; i++) {
        const ang = now / 45 + (i * Math.PI * 2) / 3;
        line(ctx, x, y, x + Math.cos(ang) * r, y + Math.sin(ang) * r, '#ffffff', 1.5);
      }
    } else {
      const q = seg(p, 0.68, 1);
      disc(ctx, b.x, b.y - 13, 14 * (1 - q) + 2, '#7fd0ff', 1 - q);
      for (let i = 0; i < 2; i++) ring(ctx, b.x, b.y - 13, 8 + q * (30 + i * 12), 5 + q * (18 + i * 8), i ? '#1d6fd1' : '#ffffff', 2, 1 - q);
      burst(ctx, b.x, b.y - 8, q, ['#ffffff', '#7fd0ff', '#8d8d8d']);
    }
  },
  rasenshuriken(ctx, a, b, p, now) {
    const h = hand(a, b);
    const k = seg(p, 0.28, 0.66);
    const x = lerp(h.x, b.x, k);
    const y = lerp(h.y - 8, b.y - 13, k);
    if (p < 0.66) {
      const r = 3 + seg(p, 0, 0.28) * 5;
      for (let i = 0; i < 4; i++) {
        const ang = now / 28 + (i * Math.PI) / 2;
        line(ctx, x, y, x + Math.cos(ang) * (r * 3.2), y + Math.sin(ang) * (r * 3.2) * 0.8, '#ffffff', 3);
        line(ctx, x, y, x + Math.cos(ang) * (r * 3.2), y + Math.sin(ang) * (r * 3.2) * 0.8, '#a8e6ff', 1);
      }
      disc(ctx, x, y, r, '#7fd0ff');
    } else {
      const q = seg(p, 0.66, 1);
      disc(ctx, b.x, b.y - 13, 20 + q * 22, '#d6f3ff', (1 - q) * 0.7);
      for (let i = 0; i < 24; i++) {
        const ang = rnd(i) * Math.PI * 2;
        const d = 8 + (now / 14 + i * 9) % 38;
        line(ctx, b.x + Math.cos(ang) * d, b.y - 13 + Math.sin(ang) * d, b.x + Math.cos(ang + 0.5) * (d + 5), b.y - 13 + Math.sin(ang + 0.5) * (d + 5), '#ffffff', 1, 1 - q);
      }
    }
  },
  shadow_clones(ctx, a, b, p) {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const born = (i / count) * 0.3;
      if (p < born) continue;
      const row = i % 3;
      const hx = a.x + (rnd(i) - 0.5) * 70;
      const hy = a.y + (row - 1) * 9 + (rnd(i + 9) - 0.5) * 6;
      const rush = seg(p, 0.42 + rnd(i + 20) * 0.1, 0.78);
      const x = lerp(hx, b.x + (rnd(i + 3) - 0.5) * 26, rush);
      const y = lerp(hy, b.y + (rnd(i + 6) - 0.5) * 12, rush);
      const fade = 1 - seg(p, 0.84, 0.96);
      box(ctx, x - 3, y - 14, 6, 6, '#f5c542', fade);
      box(ctx, x - 3, y - 9, 6, 2, '#2b3a55', fade);
      box(ctx, x - 3, y - 7, 6, 5, '#ea6a1f', fade);
      box(ctx, x - 3, y - 2, 2, 2, '#2b2b35', fade);
      box(ctx, x + 1, y - 2, 2, 2, '#2b2b35', fade);
      const smoke = seg(p, born, born + 0.08);
      if (smoke < 1) disc(ctx, hx, hy - 8, 4 + smoke * 7, '#f4f2ea', (1 - smoke) * 0.9);
      const pop = seg(p, 0.84, 0.96);
      if (pop > 0 && pop < 1) disc(ctx, x, y - 8, 3 + pop * 7, '#f4f2ea', (1 - pop) * 0.8);
    }
    const q = seg(p, 0.76, 1);
    if (q > 0) burst(ctx, b.x, b.y - 8, q, ['#ea6a1f', '#ffffff', '#f5c542'], 18);
  },
  chidori(ctx, a, b, p, now) {
    const tick = Math.floor(now / 55);
    const k = seg(p, 0.42, 0.62);
    const x = lerp(a.x, b.x, k);
    const y = lerp(a.y, b.y, k) - 13;
    if (p < 0.62) {
      disc(ctx, x, y, 5, '#ffffff');
      for (let i = 0; i < 6; i++) {
        const ang = rnd(i + tick) * Math.PI * 2;
        const l = 10 + rnd(i * 2 + tick) * 12;
        bolt(ctx, x, y, x + Math.cos(ang) * l, y + Math.sin(ang) * l, i % 2 ? '#8fd8ff' : '#ffffff', 1.5, 1, tick + i);
      }
      if (k > 0) line(ctx, a.x, a.y - 13, x, y, '#bfe9ff', 3, 0.6);
    } else {
      const q = seg(p, 0.62, 1);
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2 + rnd(i) * 0.5;
        const l = 18 + q * 34;
        bolt(ctx, b.x, b.y - 13, b.x + Math.cos(ang) * l, b.y - 13 + Math.sin(ang) * l * 0.8, '#8fd8ff', 2, 1 - q, tick + i);
      }
      disc(ctx, b.x, b.y - 13, 10 * (1 - q), '#ffffff', 1 - q);
    }
  },
  amaterasu(ctx, a, b, p, now) {
    const start = seg(p, 0, 0.22);
    if (p < 0.3) {
      // mắt người thi triển loé đỏ
      disc(ctx, a.x, a.y - 22, 3 + start * 2, '#d92c2c', 1 - seg(p, 0.22, 0.3));
      box(ctx, a.x - 1, a.y - 23, 2, 2, '#16110d');
      return;
    }
    const fade = 1 - seg(p, 0.86, 1);
    const grow = seg(p, 0.3, 0.55);
    for (let i = 0; i < 16; i++) {
      const ox = (rnd(i) - 0.5) * 28 * grow;
      const t = ((now / 420 + rnd(i + 5)) % 1);
      const h = (10 + rnd(i + 9) * 22) * grow;
      const x = b.x + ox + Math.sin(now / 90 + i) * 2;
      const y = b.y - t * h;
      disc(ctx, x, y, (4.5 + rnd(i + 2) * 3) * (1 - t * 0.7), '#120c18', fade);
      if (i % 3 === 0) disc(ctx, x, y - 1, 2 * (1 - t), '#6a2ca8', fade);
    }
  },
  fireball(ctx, a, b, p, now) {
    const h = hand(a, b);
    const k = seg(p, 0.2, 0.68);
    const x = lerp(h.x, b.x, k);
    const y = lerp(a.y - 18, b.y - 15, k);
    if (p < 0.68) {
      for (let i = 5; i >= 1; i--) {
        const q = clamp01(k - i * 0.05);
        disc(ctx, lerp(h.x, b.x, q), lerp(a.y - 18, b.y - 15, q) + Math.sin(now / 60 + i) * 2, 6 + (5 - i) * 2, i % 2 ? '#f05a22' : '#ffb02e', 0.9 - i * 0.1);
      }
      const r = 6 + seg(p, 0, 0.2) * 10;
      disc(ctx, x, y, r + 2, '#d9361a');
      disc(ctx, x, y, r, '#ff8a1f');
      disc(ctx, x - 2, y - 2, r * 0.55, '#ffe07a');
    } else {
      const q = seg(p, 0.68, 1);
      disc(ctx, b.x, b.y - 12, 16 + q * 26, '#ff8a1f', (1 - q) * 0.85);
      disc(ctx, b.x, b.y - 12, 8 + q * 16, '#ffe07a', 1 - q);
      burst(ctx, b.x, b.y - 10, q, ['#ff8a1f', '#d9361a', '#4a4640'], 18, 44);
    }
  },
  sand_coffin(ctx, a, b, p, now) {
    const rise = seg(p, 0.08, 0.5);
    const close = seg(p, 0.5, 0.72);
    for (let i = 0; i < 26; i++) {
      const k = clamp01(rise * 1.3 - rnd(i) * 0.3);
      const q = lerp(a.x, b.x, k);
      const stream = i % 2 === 0;
      if (rise < 1) box(ctx, q + (rnd(i + 4) - 0.5) * 16, lerp(a.y, b.y, k) + (rnd(i + 8) - 0.5) * 6 - Math.sin(k * Math.PI) * 6, stream ? 3 : 2, 2, stream ? '#d9b36a' : '#a8854b');
    }
    if (rise > 0.6 && p < 0.72) {
      const r = 18 * (1 - close * 0.35);
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2 + now / 300;
        disc(ctx, b.x + Math.cos(ang) * r, b.y - 12 + Math.sin(ang) * r * 1.1, 4, i % 2 ? '#d9b36a' : '#c29a5a');
      }
      disc(ctx, b.x, b.y - 12, r * close, '#c29a5a');
    }
    if (p >= 0.72) {
      const q = seg(p, 0.72, 1);
      burst(ctx, b.x, b.y - 12, q, ['#d9b36a', '#a8854b', '#8d6f41'], 28, 46);
      ring(ctx, b.x, b.y, 10 + q * 30, 4 + q * 12, '#d9b36a', 2, 1 - q);
    }
  },
  shadow_bind(ctx, a, b, p, now) {
    const k = seg(p, 0.1, 0.5);
    const fade = 1 - seg(p, 0.88, 1);
    const n = 16;
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#14121c';
    for (let i = 0; i <= n * k; i++) {
      const q = i / n;
      const x = lerp(a.x, b.x, q);
      const y = lerp(a.y, b.y, q);
      const w = 3 + Math.sin(i * 1.7 + now / 120) * 2;
      ctx.fillRect(x - 3, y - w / 2, Math.abs(b.x - a.x) / n + 3, w + 1);
    }
    disc(ctx, a.x, a.y, 8, '#14121c', fade);
    if (k >= 1) {
      disc(ctx, b.x, b.y, 11, '#14121c', fade);
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2 + 0.6;
        line(ctx, b.x, b.y, b.x + Math.cos(ang) * 8, b.y - 18 + Math.sin(ang) * 7, '#14121c', 2.5, fade);
      }
    }
  },
  shinra_tensei(ctx, a, _b, p) {
    if (p < 0.3) {
      const k = seg(p, 0, 0.3);
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const d = 40 * (1 - k);
        box(ctx, a.x + Math.cos(ang) * d, a.y - 12 + Math.sin(ang) * d, 2, 2, '#f4e9c8', k);
      }
      return;
    }
    const q = seg(p, 0.3, 1);
    disc(ctx, a.x, a.y - 12, 6 + q * 70, '#f7f3e6', (1 - q) * 0.28);
    for (let i = 0; i < 3; i++) {
      const w = clamp01(q - i * 0.12);
      ring(ctx, a.x, a.y - 8, w * 96, w * 62, i === 0 ? '#ffffff' : '#d9d2bb', 3 - i * 0.7, 1 - w);
    }
    burst(ctx, a.x, a.y - 6, q, ['#8d8678', '#c9c2ad', '#5f5a50'], 26, 90);
  },
  chibaku_tensei(ctx, a, b, p, now) {
    const cx = lerp(a.x, b.x, 0.5);
    const cy = Math.min(a.y, b.y) - 70;
    const k = seg(p, 0.1, 0.65);
    const fade = 1 - seg(p, 0.88, 1);
    disc(ctx, cx, cy, 4 + k * 13, '#0c0a14', fade);
    ring(ctx, cx, cy, 6 + k * 15, 6 + k * 15, '#7a6aa8', 1.5, fade);
    for (let i = 0; i < 24; i++) {
      const t = clamp01(k * 1.5 - rnd(i) * 0.5);
      const sx = cx + (rnd(i + 2) - 0.5) * 130;
      const sy = Math.max(a.y, b.y) + (rnd(i + 3) - 0.5) * 18;
      const ang = now / 500 + i;
      const ox = Math.cos(ang) * (18 + rnd(i + 5) * 8);
      const oy = Math.sin(ang) * (15 + rnd(i + 6) * 7);
      const s = 3 + Math.floor(rnd(i + 7) * 4);
      box(ctx, lerp(sx, cx + ox, t), lerp(sy, cy + oy, t), s, s, i % 3 ? '#7d6a52' : '#5a4b39', fade);
    }
    // đối thủ bị hút lên
    if (k > 0.4) line(ctx, b.x, b.y - 18, cx, cy, '#7a6aa8', 1, 0.35 * fade);
  },
  wood_dragon(ctx, a, b, p, now) {
    const k = seg(p, 0.05, 0.72);
    const fade = 1 - seg(p, 0.9, 1);
    ctx.save();
    if (fade > 0) dragon(ctx, a, b, k, now, '#8a5f33', '#4a2f1b', '#d9f06c');
    ctx.restore();
    if (k > 0.25) {
      for (let i = 0; i < 4; i++) {
        const x = lerp(a.x, b.x, 0.2 + i * 0.2);
        const y = lerp(a.y, b.y, 0.2 + i * 0.2);
        const h = 18 * seg(k, 0.25 + i * 0.1, 0.5 + i * 0.1);
        box(ctx, x - 3, y - h, 6, h, '#6d4627', fade);
        box(ctx, x - 3, y - h, 2, h, '#9a6c3e', fade);
        box(ctx, x - 5, y - h, 10, 2, '#4f7a3a', fade);
      }
    }
    const q = seg(p, 0.72, 1);
    if (q > 0) burst(ctx, b.x, b.y - 8, q, ['#8a5f33', '#4f7a3a'], 16);
  },
  water_dragon(ctx, a, b, p, now) {
    const k = seg(p, 0.08, 0.72);
    disc(ctx, a.x, a.y - 4, 14 * (1 - seg(p, 0.6, 0.8)), '#3f8fd8', 0.5);
    if (p < 0.8) dragon(ctx, a, b, k, now, '#4fa8e8', '#1d5f9e', '#ffffff');
    const q = seg(p, 0.72, 1);
    if (q > 0) {
      for (let i = 0; i < 3; i++) ring(ctx, b.x, b.y, 10 + clamp01(q - i * 0.15) * 46, 4 + clamp01(q - i * 0.15) * 16, '#7fd0ff', 2, 1 - q);
      burst(ctx, b.x, b.y - 12, q, ['#7fd0ff', '#ffffff', '#3f8fd8'], 22, 42);
    }
  },
  ice_mirrors(ctx, _a, b, p, now) {
    const k = seg(p, 0, 0.3);
    const fade = 1 - seg(p, 0.9, 1);
    const n = 8;
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const x = b.x + Math.cos(ang) * 28;
      const y = b.y - 12 + Math.sin(ang) * 18;
      positions.push({ x, y });
      const h = 22 * k;
      box(ctx, x - 5, y - h / 2, 10, h, '#a8e4f2', 0.75 * fade);
      box(ctx, x - 5, y - h / 2, 2, h, '#ffffff', fade);
    }
    if (p > 0.3) {
      for (let i = 0; i < 16; i++) {
        const from = positions[i % n];
        const t = (now / 260 + rnd(i)) % 1;
        const x = lerp(from.x, b.x, t);
        const y = lerp(from.y, b.y - 12, t);
        line(ctx, x, y, lerp(x, b.x, 0.14), lerp(y, b.y - 12, 0.14), '#ffffff', 1.5, fade);
      }
    }
  },
  clay_bomb(ctx, a, b, p, now) {
    const k = seg(p, 0.12, 0.66);
    if (p < 0.66) {
      const x = lerp(a.x, b.x, k);
      const y = lerp(a.y - 26, b.y - 40, k) - Math.sin(k * Math.PI) * 24;
      const flap = Math.sin(now / 50) * 5;
      box(ctx, x - 3, y - 2, 7, 5, '#f4efe2');
      line(ctx, x, y, x - 9, y - flap, '#f4efe2', 2);
      line(ctx, x, y, x + 9, y - flap, '#f4efe2', 2);
      box(ctx, x + 3, y - 3, 3, 2, '#d8d2c0');
    } else {
      const q = seg(p, 0.66, 1);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const d = q * 20;
        disc(ctx, b.x + Math.cos(ang) * d, b.y - 14 + Math.sin(ang) * d, 12 + q * 8, i % 2 ? '#ffb02e' : '#f05a22', 1 - q);
      }
      disc(ctx, b.x, b.y - 14, 20 * (1 - q), '#fff3b0', 1 - q);
      ring(ctx, b.x, b.y - 4, 12 + q * 58, 5 + q * 22, '#ffffff', 3, 1 - q);
      burst(ctx, b.x, b.y - 14, q, ['#4a4640', '#f05a22', '#f4efe2'], 22, 56);
    }
  },
  puppet_strings(ctx, a, b, p, now) {
    const fade = 1 - seg(p, 0.9, 1);
    const k = seg(p, 0.05, 0.6);
    for (let i = 0; i < 3; i++) {
      const q = clamp01(k - i * 0.08);
      const px = lerp(a.x, b.x + (i - 1) * 16, q);
      const py = lerp(a.y - 8, b.y - 18 + (i - 1) * 6, q) + Math.sin(now / 130 + i * 2) * 2;
      line(ctx, a.x, a.y - 16, px, py - 8, '#7fd0ff', 1, 0.85 * fade);
      box(ctx, px - 4, py - 12, 8, 6, '#d8c9a8', fade);
      box(ctx, px - 5, py - 6, 10, 9, i === 1 ? '#7a2f2a' : '#2f2a3a', fade);
      box(ctx, px - 8, py - 5, 3, 2, '#8d8d8d', fade);
      box(ctx, px + 5, py - 5, 3, 2, '#8d8d8d', fade);
      box(ctx, px - 2, py - 10, 1, 1, '#d92c2c', fade);
      box(ctx, px + 1, py - 10, 1, 1, '#d92c2c', fade);
    }
    const q = seg(p, 0.6, 0.85);
    if (q > 0 && q < 1) burst(ctx, b.x, b.y - 12, q, ['#c7d1dc', '#6d2fa8'], 12);
  },
  paper_storm(ctx, a, b, p, now) {
    const fade = 1 - seg(p, 0.9, 1);
    const k = seg(p, 0.08, 0.7);
    for (let i = 0; i < 34; i++) {
      const q = clamp01(k * 1.5 - rnd(i) * 0.5);
      const swirl = Math.sin(now / 130 + i) * (1 - q) * 22;
      const x = lerp(a.x + (rnd(i + 1) - 0.5) * 28, b.x + (rnd(i + 2) - 0.5) * 20, q) + swirl;
      const y = lerp(a.y - 18 + (rnd(i + 3) - 0.5) * 28, b.y - 14 + (rnd(i + 4) - 0.5) * 18, q) + Math.cos(now / 110 + i) * 3;
      box(ctx, x, y, 3, 2, i % 5 === 0 ? '#d8cdf0' : '#f7f3e6', fade);
    }
    // đôi cánh giấy sau lưng
    const open = seg(p, 0, 0.2) * fade;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) box(ctx, a.x + side * (7 + i * 5) - 2, a.y - 24 + i * 3, 5, 10 - i, '#f7f3e6', 0.9 * open);
    }
  },
  eight_gates(ctx, a, b, p, now) {
    const aura = seg(p, 0, 0.25);
    const k = seg(p, 0.3, 0.45);
    const x = lerp(a.x, b.x, k);
    const y = lerp(a.y, b.y, k);
    const fade = 1 - seg(p, 0.9, 1);
    // hơi nước xanh đỏ của bát môn
    for (let i = 0; i < 14; i++) {
      const t = (now / 420 + rnd(i)) % 1;
      const ox = (rnd(i + 3) - 0.5) * 22 + Math.sin(now / 120 + i) * 2;
      disc(ctx, x + ox, y - t * 34, 4 * (1 - t) * aura, i % 2 ? '#35d07f' : '#e8452f', (1 - t) * fade);
    }
    if (k > 0) line(ctx, a.x, a.y - 12, x, y - 12, '#35d07f', 4, 0.5 * (1 - seg(p, 0.45, 0.6)));
    if (p > 0.45) {
      // loạt đấm: các vệt liên tục quanh đối thủ
      const q = seg(p, 0.45, 0.9);
      const tick = Math.floor(now / 70);
      for (let i = 0; i < 7; i++) {
        const ang = rnd(i + tick) * Math.PI * 2;
        const r0 = 8 + rnd(i + tick + 3) * 6;
        const r1 = 24 + rnd(i + tick + 5) * 12;
        line(ctx, b.x + Math.cos(ang) * r1, b.y - 13 + Math.sin(ang) * r1, b.x + Math.cos(ang) * r0, b.y - 13 + Math.sin(ang) * r0, i % 2 ? '#ffffff' : '#ffb02e', 2.5, (1 - q * 0.4) * fade);
      }
    }
  },
  chakra_punch(ctx, a, b, p, now) {
    const k = seg(p, 0.25, 0.48);
    if (p < 0.5) {
      const h = hand({ x: lerp(a.x, b.x, k * 0.8), y: lerp(a.y, b.y, k * 0.8) }, b);
      disc(ctx, h.x, h.y, 4 + seg(p, 0, 0.25) * 4, '#35d07f', 0.5 + Math.sin(now / 50) * 0.3);
      disc(ctx, h.x, h.y, 3, '#e6fff0');
      return;
    }
    const q = seg(p, 0.5, 1);
    // nứt đất toả ra từ điểm đấm, đá bật lên
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2 + rnd(i);
      const l = 14 + rnd(i + 3) * 36;
      const mx = b.x + Math.cos(ang) * l * 0.55 + (rnd(i + 6) - 0.5) * 8;
      const my = b.y + Math.sin(ang) * l * 0.25;
      const ex = b.x + Math.cos(ang) * l;
      const ey = b.y + Math.sin(ang) * l * 0.45;
      line(ctx, b.x, b.y, mx, my, '#2a2118', 2.5, 1 - q * 0.8);
      line(ctx, mx, my, ex, ey, '#2a2118', 1.5, 1 - q * 0.8);
    }
    for (let i = 0; i < 12; i++) {
      const ang = rnd(i + 11) * Math.PI * 2;
      const d = 12 + rnd(i + 12) * 26;
      const lift = Math.sin(q * Math.PI) * (18 + rnd(i + 13) * 26);
      const s = 3 + Math.floor(rnd(i + 14) * 4);
      box(ctx, b.x + Math.cos(ang) * d * q, b.y + Math.sin(ang) * d * 0.4 * q - lift, s, s, i % 2 ? '#7d6a52' : '#5a4b39', 1 - seg(q, 0.7, 1));
    }
    ring(ctx, b.x, b.y, 8 + q * 44, 3 + q * 16, '#35d07f', 2.5, 1 - q);
  },
  hiraishin(ctx, a, b, p, now) {
    const t = seg(p, 0.05, 0.3);
    if (p < 0.34) {
      // kunai ba mũi bay tới cắm cạnh đối thủ
      const x = lerp(a.x, b.x - 10, t);
      const y = lerp(a.y - 14, b.y - 2, t);
      line(ctx, x - 5, y, x + 5, y, '#cfd6de', 2);
      line(ctx, x + 2, y - 3, x + 5, y, '#cfd6de', 1.5);
      line(ctx, x + 2, y + 3, x + 5, y, '#cfd6de', 1.5);
      return;
    }
    const tick = Math.floor(now / 60);
    const q = seg(p, 0.34, 0.5);
    // tia chớp vàng từ chỗ cũ tới sau lưng đối thủ
    bolt(ctx, a.x, a.y - 12, b.x, b.y - 12, '#ffe14d', 3, (1 - q) * 0.95, tick);
    bolt(ctx, a.x, a.y - 12, b.x, b.y - 12, '#ffffff', 1, 1 - q, tick + 7);
    if (p > 0.45) {
      const w = seg(p, 0.45, 1);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + w * 3;
        bolt(ctx, b.x, b.y - 13, b.x + Math.cos(ang) * (10 + w * 30), b.y - 13 + Math.sin(ang) * (8 + w * 22), '#ffe14d', 1.5, 1 - w, tick + i);
      }
      disc(ctx, b.x, b.y - 13, 10 * (1 - w), '#fff7c2', 1 - w);
    }
  },
  kamui(ctx, _a, b, p, now) {
    const k = seg(p, 0.1, 0.55);
    const fade = 1 - seg(p, 0.86, 1);
    const cx = b.x;
    const cy = b.y - 13;
    disc(ctx, cx, cy, 6 + k * 12, '#120c18', 0.85 * fade);
    // các vệt xoáy hút vào tâm
    for (let arm = 0; arm < 3; arm++) {
      ctx.globalAlpha = fade;
      ctx.strokeStyle = arm === 0 ? '#c8452f' : '#6a4a8f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        const q = i / 18;
        const ang = now / 170 + (arm * Math.PI * 2) / 3 + q * 5.2;
        const r = (6 + q * 30) * (0.4 + k * 0.6);
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r * 0.75;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
  gentle_fist(ctx, a, b, p, now) {
    const fade = 1 - seg(p, 0.9, 1);
    const k = seg(p, 0, 0.25);
    // đồ hình bát quái dưới chân
    ring(ctx, a.x, a.y, 34 * k, 14 * k, '#8fd8ff', 1.5, fade);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      box(ctx, a.x + Math.cos(ang) * 28 * k - 3, a.y + Math.sin(ang) * 11 * k - 1, 6, 2, '#bfe9ff', fade);
    }
    if (p > 0.3) {
      // chuỗi điểm huyệt: các chấm sáng lần lượt hiện trên người đối thủ
      const n = Math.floor(seg(p, 0.3, 0.86) * 16);
      for (let i = 0; i < n; i++) {
        const x = b.x + (rnd(i) - 0.5) * 16;
        const y = b.y - 4 - rnd(i + 30) * 20;
        const fresh = i === n - 1;
        disc(ctx, x, y, fresh ? 4 : 1.5, fresh ? '#ffffff' : '#7fd0ff', fade);
      }
      const palm = Math.floor(now / 90) % 2 === 0;
      line(ctx, a.x, a.y - 13, b.x + (palm ? -3 : 3), b.y - 13, '#bfe9ff', 2, 0.55 * fade);
    }
  },
  wind_scythe(ctx, a, b, p) {
    const dir = b.x >= a.x ? 1 : -1;
    for (let i = 0; i < 4; i++) {
      const k = seg(p, 0.12 + i * 0.1, 0.62 + i * 0.1);
      if (k <= 0 || k >= 1) continue;
      const x = lerp(a.x, b.x, k);
      const y = lerp(a.y - 12, b.y - 12, k) + (i - 1.5) * 6;
      ctx.globalAlpha = 1 - k * 0.4;
      ctx.strokeStyle = i % 2 ? '#d6f3e6' : '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 14, dir > 0 ? -1.1 : Math.PI - 1.1, dir > 0 ? 1.1 : Math.PI + 1.1);
      ctx.stroke();
    }
    const q = seg(p, 0.7, 1);
    if (q > 0) {
      for (let i = 0; i < 5; i++) {
        const ang = rnd(i + 3) * Math.PI;
        line(ctx, b.x - Math.cos(ang) * 22, b.y - 13 - Math.sin(ang) * 16, b.x + Math.cos(ang) * 22, b.y - 13 + Math.sin(ang) * 16, '#ffffff', 2, 1 - q);
      }
    }
  },
  lightning_rush(ctx, a, b, p, now) {
    const tick = Math.floor(now / 55);
    const k = seg(p, 0.25, 0.42);
    const x = lerp(a.x, b.x, k);
    const y = lerp(a.y, b.y, k);
    if (p < 0.5) {
      // áo giáp sét vàng quanh thân
      for (let i = 0; i < 5; i++) {
        const ang = rnd(i + tick) * Math.PI * 2;
        bolt(ctx, x, y - 13, x + Math.cos(ang) * 16, y - 13 + Math.sin(ang) * 18, '#ffe14d', 1.5, 1, tick + i);
      }
      if (k > 0) line(ctx, a.x, a.y - 12, x, y - 12, '#fff3b0', 5, 0.7);
    } else {
      const q = seg(p, 0.5, 1);
      line(ctx, b.x - 34, b.y - 13, b.x + 34, b.y - 13, '#ffe14d', 6 * (1 - q), 1 - q);
      for (let i = 0; i < 6; i++) bolt(ctx, b.x, b.y - 60, b.x + (i - 2.5) * 12, b.y, i % 2 ? '#ffe14d' : '#ffffff', 2, 1 - q, tick + i);
    }
  },
  snake_strike(ctx, a, b, p, now) {
    const fade = 1 - seg(p, 0.88, 1);
    const k = seg(p, 0.08, 0.6);
    for (let s = 0; s < 4; s++) {
      const q = clamp01(k * 1.2 - s * 0.06);
      const tx = lerp(a.x, b.x, q);
      const ty = lerp(a.y - 12 + (s - 1.5) * 4, b.y - 12 + (s - 1.5) * 7, q);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = s % 2 ? '#6d3f96' : '#4f8a5b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 12);
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const x = lerp(a.x, tx, t);
        const y = lerp(a.y - 12, ty, t) + Math.sin(t * 9 + now / 80 + s) * 4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      box(ctx, tx - 3, ty - 3, 6, 5, s % 2 ? '#6d3f96' : '#4f8a5b', fade);
      box(ctx, tx, ty - 2, 1, 1, '#f2d94e', fade);
      if (q >= 1) line(ctx, tx, ty + 1, tx + 5, ty + 3, '#d92c2c', 1, fade);
    }
  },
  shuriken_storm(ctx, a, b, p, now) {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const start = (i / n) * 0.5;
      const k = seg(p, start, start + 0.32);
      if (k <= 0 || k >= 1) continue;
      const x = lerp(a.x, b.x + (rnd(i + 1) - 0.5) * 22, k) + (1 - k) * (rnd(i) - 0.5) * 40;
      const y = lerp(a.y - 14, b.y - 12 + (rnd(i + 2) - 0.5) * 20, k) + (1 - k) * (rnd(i + 3) - 0.5) * 30;
      const spin = Math.floor(now / 60 + i) % 2 === 0;
      if (spin) {
        box(ctx, x - 3, y, 7, 1, '#cfd6de');
        box(ctx, x, y - 3, 1, 7, '#cfd6de');
      } else {
        line(ctx, x - 2, y - 2, x + 2, y + 2, '#cfd6de', 1.5);
        line(ctx, x - 2, y + 2, x + 2, y - 2, '#cfd6de', 1.5);
      }
      box(ctx, x, y, 1, 1, '#4a505c');
    }
    const q = seg(p, 0.75, 1);
    if (q > 0) burst(ctx, b.x, b.y - 10, q, ['#cfd6de', '#ffffff'], 10, 22);
  },
  jashin_ritual(ctx, a, b, p, now) {
    const k = seg(p, 0, 0.3);
    const fade = 1 - seg(p, 0.9, 1);
    ring(ctx, a.x, a.y, 24 * k, 10 * k, '#c8201c', 2, fade);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#c8201c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const ang = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const x = a.x + Math.cos(ang) * 22 * k;
      const y = a.y + Math.sin(ang) * 9 * k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (p > 0.3) {
      // sợi máu nối hai người và các giọt nhỏ theo nhịp tim
      line(ctx, a.x, a.y - 13, b.x, b.y - 13, '#8f1410', 1.5, fade);
      const beat = Math.floor(now / 340) % 2 === 0;
      for (const f of [a, b]) {
        disc(ctx, f.x, f.y - 14, beat ? 4 : 2.5, '#c8201c', fade);
        for (let i = 0; i < 4; i++) {
          const t = (now / 500 + i * 0.25) % 1;
          box(ctx, f.x - 6 + i * 4, f.y - 10 + t * 12, 2, 3, '#c8201c', (1 - t) * fade);
        }
      }
    }
  },
  dust_release(ctx, a, b, p, now) {
    const k = seg(p, 0.1, 0.42);
    const h = hand(a, b);
    if (p < 0.5) {
      // khối trong suốt nối hai tay, nén lại rồi bắn đi
      const x = lerp(h.x, b.x, k);
      const y = lerp(h.y, b.y - 13, k);
      const s = 12 - seg(p, 0, 0.1) * 4;
      box(ctx, x - s / 2, y - s / 2, s, s, '#dff4ff', 0.75);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - s / 2, y - s / 2, s, s);
      line(ctx, x, y, b.x, b.y - 13, '#dff4ff', 1, 0.5 + Math.sin(now / 60) * 0.3);
    } else {
      // khối lập phương nở ra rồi xoá sạch bên trong
      const q = seg(p, 0.5, 1);
      const s = 16 + seg(q, 0, 0.4) * 44;
      box(ctx, b.x - s / 2, b.y - 13 - s / 2, s, s, '#ffffff', (1 - q) * 0.8);
      ctx.globalAlpha = 1 - q;
      ctx.strokeStyle = '#8fd8ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - s / 2, b.y - 13 - s / 2, s, s);
    }
  },
  lava_release(ctx, a, b, p, now) {
    const k = seg(p, 0.12, 0.62);
    for (let i = 0; i < 10; i++) {
      const q = clamp01(k - i * 0.03);
      const x = lerp(a.x, b.x, q);
      const y = lerp(a.y - 16, b.y - 14, q) - Math.sin(q * Math.PI) * 30;
      if (p < 0.72) disc(ctx, x, y + (i % 2) * 2, 7 - i * 0.4, i % 2 ? '#d9361a' : '#ff8a1f');
    }
    const q = seg(p, 0.62, 1);
    if (q > 0) {
      disc(ctx, b.x, b.y, 10 + q * 16, '#7a1a10', 1 - q * 0.4);
      for (let i = 0; i < 7; i++) {
        const t = (now / 360 + i * 0.14) % 1;
        disc(ctx, b.x + (rnd(i) - 0.5) * 26, b.y - t * 14, 3 * (1 - t), '#ffb02e', (1 - t) * (1 - q * 0.5));
      }
      disc(ctx, b.x, b.y, 6 + q * 8, '#ff8a1f', 1 - q);
    }
  },
  mist_slash(ctx, a, b, p, now) {
    const fog = seg(p, 0, 0.3);
    const fade = 1 - seg(p, 0.9, 1);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2 - 10;
    for (let i = 0; i < 14; i++) {
      const x = cx + (rnd(i) - 0.5) * 110 + Math.sin(now / 900 + i) * 8;
      const y = cy + (rnd(i + 8) - 0.5) * 42;
      disc(ctx, x, y, 12 + rnd(i + 4) * 10, '#dfe9ee', 0.3 * fog * fade);
    }
    // nhát chém lớn
    const s = seg(p, 0.5, 0.68);
    if (s > 0 && s < 1) {
      const ang = -0.9 + s * 1.9;
      const r = 34;
      line(ctx, b.x - Math.cos(ang) * r, b.y - 13 - Math.sin(ang) * r, b.x + Math.cos(ang) * r, b.y - 13 + Math.sin(ang) * r, '#ffffff', 5);
      line(ctx, b.x - Math.cos(ang) * r, b.y - 13 - Math.sin(ang) * r, b.x + Math.cos(ang) * r, b.y - 13 + Math.sin(ang) * r, '#5f7f9c', 2);
    }
    const q = seg(p, 0.68, 1);
    if (q > 0) burst(ctx, b.x, b.y - 13, q, ['#c8201c', '#dfe9ee'], 12, 26);
  },
  needle_hair(ctx, a, b, p) {
    const k = seg(p, 0.1, 0.45);
    const dir = b.x >= a.x ? 1 : -1;
    // tóc trắng dài bung ra rồi cắm kim xuống
    for (let i = 0; i < 14; i++) {
      const l = 14 + k * 26 + rnd(i) * 8;
      const ang = -Math.PI / 2 + dir * (0.3 + (i / 14) * 1.5);
      line(ctx, a.x, a.y - 22, a.x + Math.cos(ang) * l, a.y - 22 + Math.sin(ang) * l, '#ecebe2', 2, 1 - seg(p, 0.9, 1));
    }
    const n = 18;
    for (let i = 0; i < n; i++) {
      const start = 0.42 + (i / n) * 0.3;
      const t = seg(p, start, start + 0.12);
      if (t <= 0 || t >= 1) continue;
      const tx = b.x + (rnd(i + 1) - 0.5) * 34;
      const ty = b.y + (rnd(i + 2) - 0.5) * 14;
      const sx = lerp(a.x, tx, t);
      const sy = lerp(a.y - 24, ty, t);
      line(ctx, sx, sy, lerp(sx, tx, 0.25), lerp(sy, ty, 0.25), '#ecebe2', 1.5);
    }
  },
  earth_grudge(ctx, a, b, p, now) {
    const fade = 1 - seg(p, 0.9, 1);
    const k = seg(p, 0.08, 0.62);
    for (let i = 0; i < 6; i++) {
      const q = clamp01(k * 1.2 - i * 0.04);
      const tx = lerp(a.x, b.x, q);
      const ty = lerp(a.y - 12 + (i - 2.5) * 2, b.y - 13 + (i - 2.5) * 5, q);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = i % 2 ? '#1a1a22' : '#3a3442';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 12);
      for (let t = 1; t <= 7; t++) {
        const w = t / 7;
        ctx.lineTo(lerp(a.x, tx, w) + Math.sin(w * 11 + now / 70 + i) * 3, lerp(a.y - 12, ty, w) + Math.cos(w * 13 + i) * 3);
      }
      ctx.stroke();
    }
    if (k >= 1) {
      const pulse = Math.floor(now / 300) % 2 === 0;
      disc(ctx, b.x, b.y - 13, pulse ? 4 : 3, '#c8201c', fade);
    }
  },
};

/** Tên chiêu hiện trong phần đầu của lượt để người xem biết ai đang ra chiêu gì. */
function caption(ctx: Ctx, x: number, y: number, text: string, a: number): void {
  if (a <= 0) return;
  ctx.globalAlpha = a;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = 'rgba(16,19,28,0.85)';
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - 6), Math.round(w), 12);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(text, x, y);
}

export function drawJutsu(ctx: Ctx, kind: JutsuKind, label: string, attacker: Fighter, target: Fighter, p: number, now: number): void {
  ctx.save();
  DRAW[kind](ctx, attacker, target, p, now);
  caption(ctx, attacker.x, attacker.y - 44, label, 1 - seg(p, 0.6, 0.75));
  ctx.restore();
}
