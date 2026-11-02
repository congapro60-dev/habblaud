// Sprites procedurais da área externa (árvores, arbustos, postes, casas da vila...) e utilitários
// visuais do mundo (sombra, brilhos). Mesma direção de arte do módulo de arte: contorno
// cinza-azulado escuro, 3–4 tons por material, luz vinda de cima/esquerda.
import { mulberry32 } from '../../../../shared/hash';
import type { ExteriorProp } from '../layout/types';

export interface PropSprite {
  canvas: HTMLCanvasElement;
  ax: number;
  ay: number;
}

const cache = new Map<string, PropSprite>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Pintor por pixel (ImageData) para formas orgânicas. */
class Painter {
  readonly data: ImageData;
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly w: number,
    readonly h: number,
  ) {
    // parte do conteúdo já desenhado (ex.: sombra) para não apagá-lo no putImageData
    this.data = ctx.getImageData(0, 0, w, h);
  }
  set(x: number, y: number, color: string, a = 255): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b] = hex(color);
    const i = (y * this.w + x) * 4;
    this.data.data[i] = r;
    this.data.data[i + 1] = g;
    this.data.data[i + 2] = b;
    this.data.data[i + 3] = a;
  }
  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data.data[(y * this.w + x) * 4 + 3];
  }
  flush(): void {
    this.ctx.putImageData(this.data, 0, 0);
  }
}

function shadowEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a = 0.22): void {
  ctx.fillStyle = `rgba(28,36,52,${a})`;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    ctx.fillRect(cx - half, cy + y, half * 2, 1);
  }
}

/** Copa arredondada: união de círculos com sombreamento por luz superior-esquerda. */
function canopy(p: Painter, rng: () => number, cx: number, cy: number, r: number, tones: string[], outline: string): void {
  const blobs: [number, number, number][] = [[cx, cy, r]];
  for (let i = 0; i < 4; i++) {
    const a = rng() * Math.PI * 2;
    const d = r * (0.35 + rng() * 0.35);
    blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * (0.55 + rng() * 0.25)]);
  }
  const inside = (x: number, y: number) => blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br);
  const x0 = Math.floor(cx - r * 1.8);
  const x1 = Math.ceil(cx + r * 1.8);
  const y0 = Math.floor(cy - r * 1.6);
  const y1 = Math.ceil(cy + r * 1.6);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
      if (edge) {
        p.set(x, y, outline);
        continue;
      }
      // luz: topo-esquerda mais claro; ruído para "folhas"
      const nx = (x - cx) / r;
      const ny = (y - cy) / r;
      const light = -nx * 0.45 - ny * 0.75 + (rng() - 0.5) * 0.55;
      const k = light > 0.55 ? 3 : light > 0.05 ? 2 : light > -0.5 ? 1 : 0;
      p.set(x, y, tones[k]);
    }
  }
}

function treeSprite(seed: number): PropSprite {
  const rng = mulberry32(seed);
  const [c, ctx] = makeCanvas(36, 48);
  shadowEllipse(ctx, 18, 45, 12, 3, 0.25);
  const p = new Painter(ctx, 36, 48);
  // tronco
  for (let y = 30; y < 46; y++) {
    for (let x = 16; x < 21; x++) {
      const col = x === 16 ? '#8a6243' : x === 20 ? '#4a3222' : '#6b4a32';
      p.set(x, y, col);
    }
  }
  p.set(15, 45, '#4a3222');
  p.set(21, 45, '#4a3222');
  const variants = [
    ['#2f6a43', '#3f8550', '#5aa45d', '#86c873'],
    ['#356b3c', '#4b8a45', '#6aa956', '#9fcf74'],
    ['#2c6250', '#3a7e5f', '#53a071', '#82c489'],
  ];
  canopy(p, rng, 18, 18, 11 + Math.floor(rng() * 3), variants[Math.floor(rng() * variants.length)], '#25463a');
  p.flush();
  return { canvas: c, ax: 18, ay: 45 };
}

function pineSprite(seed: number): PropSprite {
  const rng = mulberry32(seed);
  const [c, ctx] = makeCanvas(28, 48);
  shadowEllipse(ctx, 14, 45, 9, 3, 0.25);
  const p = new Painter(ctx, 28, 48);
  for (let y = 38; y < 46; y++) for (let x = 12; x < 16; x++) p.set(x, y, x === 12 ? '#8a6243' : x === 15 ? '#4a3222' : '#6b4a32');
  const tones = ['#24533f', '#2f6b4f', '#3f8a5f', '#62ab79'];
  const layers = 4;
  for (let l = 0; l < layers; l++) {
    const top = 4 + l * 8;
    const bottom = top + 14;
    for (let y = top; y < bottom; y++) {
      const half = Math.round(((y - top) / (bottom - top)) * (5 + l * 2.2));
      for (let x = 14 - half; x <= 14 + half; x++) {
        const edge = x === 14 - half || x === 14 + half || y === bottom - 1;
        const light = (14 - x) / (half + 1) - (y - top) / (bottom - top) + (rng() - 0.5) * 0.5;
        p.set(x, y, edge ? '#1d3f33' : tones[light > 0.5 ? 3 : light > -0.1 ? 2 : light > -0.6 ? 1 : 0]);
      }
    }
  }
  p.flush();
  return { canvas: c, ax: 14, ay: 45 };
}

function bushSprite(seed: number): PropSprite {
  const rng = mulberry32(seed);
  const [c, ctx] = makeCanvas(22, 16);
  shadowEllipse(ctx, 11, 14, 9, 2, 0.22);
  const p = new Painter(ctx, 22, 16);
  canopy(p, rng, 11, 9, 6, ['#34663f', '#47864c', '#62a45a', '#8cc66f'], '#264a36');
  // florzinhas
  if (rng() < 0.6) {
    const col = ['#f2d14b', '#f28aa5', '#ffffff'][Math.floor(rng() * 3)];
    for (let i = 0; i < 4; i++) p.set(6 + Math.floor(rng() * 10), 5 + Math.floor(rng() * 6), col);
  }
  p.flush();
  return { canvas: c, ax: 11, ay: 14 };
}

function flowersSprite(seed: number): PropSprite {
  const rng = mulberry32(seed);
  const [c, ctx] = makeCanvas(30, 14);
  const p = new Painter(ctx, 30, 14);
  // canteiro: borda de pedra + terra
  for (let y = 4; y < 13; y++) {
    for (let x = 1; x < 29; x++) {
      const border = y === 4 || y === 12 || x === 1 || x === 28;
      p.set(x, y, border ? (y === 12 ? '#8d8a82' : '#b9b5aa') : '#6a4b35');
    }
  }
  const cols = ['#e8574a', '#f2c94c', '#f08bb0', '#ffffff', '#9b7be0'];
  for (let i = 0; i < 26; i++) {
    const x = 3 + Math.floor(rng() * 24);
    const y = 2 + Math.floor(rng() * 9);
    p.set(x, y + 1, '#3f8550');
    p.set(x, y, rng() < 0.75 ? cols[Math.floor(rng() * cols.length)] : '#5aa45d');
  }
  p.flush();
  return { canvas: c, ax: 15, ay: 13 };
}

function hedgeSprite(seed: number): PropSprite {
  const rng = mulberry32(seed);
  const [c, ctx] = makeCanvas(34, 16);
  shadowEllipse(ctx, 17, 14, 15, 2, 0.2);
  const p = new Painter(ctx, 34, 16);
  for (let y = 3; y < 14; y++) {
    for (let x = 1; x < 33; x++) {
      const r = y === 3 ? 2 : y === 4 ? 1 : 0;
      if (x < 1 + r || x > 32 - r) continue;
      const edge = y === 3 || y === 13 || x === 1 + r || x === 32 - r;
      const light = -(y - 3) / 10 + (rng() - 0.5) * 0.6;
      p.set(x, y, edge ? '#264a36' : light > 0 ? '#6aa956' : light > -0.4 ? '#4b8a45' : '#356b3c');
    }
  }
  p.flush();
  return { canvas: c, ax: 17, ay: 14 };
}

/** Đèn lồng đá Tōrō truyền thống Nhật Bản của Làng Ninja. */
function lampSprite(): PropSprite {
  const [c, ctx] = makeCanvas(14, 36);
  shadowEllipse(ctx, 7, 34, 5, 2, 0.3);
  // Cột trụ đá
  ctx.fillStyle = '#475569';
  ctx.fillRect(5, 12, 4, 20);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(5, 12, 2, 20);
  // Bệ đỡ đá dưới chân
  ctx.fillStyle = '#334155';
  ctx.fillRect(3, 30, 8, 4);
  // Buồng đèn lồng đá phát sáng vàng ấm
  ctx.fillStyle = '#334155';
  ctx.fillRect(3, 8, 8, 6);
  ctx.fillStyle = '#fde047';
  ctx.fillRect(4, 9, 6, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(5, 10, 2, 2);
  // Mái ngói đá cong vút đỉnh Tōrō
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(1, 6, 12, 3);
  ctx.fillRect(3, 4, 8, 2);
  ctx.fillRect(5, 2, 4, 2);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(6, 1, 2, 2); // Chóp ngọn
  return { canvas: c, ax: 7, ay: 34 };
}

/** Ghế dài gỗ ninja mộc mạc. */
function benchSprite(): PropSprite {
  const [c, ctx] = makeCanvas(26, 14);
  shadowEllipse(ctx, 13, 12, 11, 2, 0.22);
  ctx.fillStyle = '#451a03';
  ctx.fillRect(3, 8, 3, 4);
  ctx.fillRect(20, 8, 3, 4);
  // Nan gỗ mộc đậm chất làng ninja
  ctx.fillStyle = '#78350f';
  ctx.fillRect(1, 1, 24, 3);
  ctx.fillRect(1, 6, 24, 3);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(1, 1, 24, 1);
  ctx.fillRect(1, 6, 24, 1);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(1, 8, 24, 1);
  return { canvas: c, ax: 13, ay: 12 };
}

function rockSprite(seed: number): PropSprite {
  const rng = mulberry32(seed);
  const [c, ctx] = makeCanvas(16, 12);
  const p = new Painter(ctx, 16, 12);
  canopy(p, rng, 8, 7, 4, ['#7d8590', '#959da8', '#b3bac4', '#d3d8de'], '#4d5562');
  p.flush();
  return { canvas: c, ax: 8, ay: 11 };
}

/** Mesa de jardim com guarda-sol listrado (vista de cima, 3/4) e duas cadeirinhas. */
function parasolSprite(seed: number): PropSprite {
  const [c, ctx] = makeCanvas(32, 34);
  const palettes: [string, string, string][] = [
    ['#e8574a', '#f6efe2', '#a83a33'],
    ['#2fb3a3', '#f6efe2', '#1f8579'],
    ['#f2b33d', '#fbf4e4', '#c88a1f'],
  ];
  const [a, b, dk] = palettes[seed % palettes.length];
  // sombra do guarda-sol no chão
  shadowEllipse(ctx, 16, 29, 12, 3, 0.24);
  // cadeirinhas (laterais) e mesa
  ctx.fillStyle = '#5b3c25';
  ctx.fillRect(2, 24, 6, 5);
  ctx.fillRect(24, 24, 6, 5);
  ctx.fillStyle = '#a0703f';
  ctx.fillRect(2, 24, 6, 2);
  ctx.fillRect(24, 24, 6, 2);
  ctx.fillStyle = '#d8dde3';
  ctx.fillRect(10, 24, 12, 5);
  ctx.fillStyle = '#f4f6f8';
  ctx.fillRect(10, 24, 12, 2);
  ctx.fillStyle = '#8d96a3';
  ctx.fillRect(10, 28, 12, 1);
  // haste
  ctx.fillStyle = '#4a5468';
  ctx.fillRect(15, 11, 2, 14);
  // lona: octógono achatado com gomos alternados e borda escura
  const p = new Painter(ctx, 32, 34);
  const cx = 15.5;
  const cy = 8;
  for (let y = 0; y <= 15; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = (x - cx) / 14.5;
      const dy = (y - cy) / 7.5;
      const d = Math.abs(dx) + Math.abs(dy) * 0.55 + Math.hypot(dx, dy) * 0.45;
      if (d > 1) continue;
      const ang = Math.atan2(y - cy, x - cx);
      const gomo = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 8) % 2;
      const edge = d > 0.86;
      const lit = y < cy - 1;
      p.set(x, y, edge ? dk : gomo ? (lit ? '#ffffff' : b) : lit ? a : dk);
    }
  }
  p.set(15, 8, '#2e3648');
  p.set(16, 8, '#2e3648');
  p.flush();
  return { canvas: c, ax: 16, ay: 29 };
}

/** Cổng Torii / Cột mốc Làng Lá Konohagakure tại lối vào chính. */
function totemSprite(): PropSprite {
  const [c, ctx] = makeCanvas(16, 36);
  shadowEllipse(ctx, 8, 33, 7, 2, 0.3);
  // Trụ cổng đỏ son thần đạo
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(2, 6, 3, 26);
  ctx.fillRect(11, 6, 3, 26);
  // Xà ngang Torii cong màu đen/đỏ son
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 4, 16, 3);
  ctx.fillRect(1, 10, 14, 2);
  // Biểu tượng Làng Lá 🍃 mạ vàng ở giữa cổng
  ctx.fillStyle = '#fde047';
  ctx.fillRect(7, 8, 2, 2);
  ctx.fillStyle = '#15803d';
  ctx.fillRect(7, 7, 2, 1);
  // Chân đế đá
  ctx.fillStyle = '#475569';
  ctx.fillRect(1, 30, 5, 3);
  ctx.fillRect(10, 30, 5, 3);
  return { canvas: c, ax: 8, ay: 32 };
}

/** Vẽ nhanh một khối màu đặc. */
function block(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Vòng xoáy đỏ, hoạ tiết quen thuộc trên tường nhà làng ninja. */
function swirl(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  block(ctx, color, cx - 2, cy - 3, 5, 1);
  block(ctx, color, cx + 2, cy - 2, 1, 4);
  block(ctx, color, cx - 2, cy + 2, 5, 1);
  block(ctx, color, cx - 3, cy - 2, 1, 4);
  block(ctx, color, cx, cy - 1, 1, 2);
}

/** Nhà dân làng ninja: tường trắng ngà, mái ngói nhiều tầng, cửa gỗ. */
function ninjaHouseSprite(seed: number): PropSprite {
  const [c, ctx] = makeCanvas(56, 50);
  const roofs: [string, string, string][] = [
    ['#b4532a', '#d9713f', '#7c3518'],
    ['#2f7f79', '#43a39b', '#1f5552'],
    ['#6b5a8e', '#8877ad', '#463a60'],
  ];
  const [roof, roofLight, roofDark] = roofs[seed % roofs.length];
  shadowEllipse(ctx, 28, 47, 25, 3, 0.25);
  block(ctx, '#e8dcc3', 7, 22, 42, 25);
  block(ctx, '#cfbf9f', 7, 42, 42, 5);
  block(ctx, '#f4ead4', 7, 22, 42, 2);
  block(ctx, '#5c3d24', 7, 22, 2, 25);
  block(ctx, '#5c3d24', 47, 22, 2, 25);
  // mái ngói ba tầng, nhô ra hai bên
  block(ctx, roofDark, 2, 17, 52, 6);
  block(ctx, roof, 3, 16, 50, 5);
  block(ctx, roofLight, 3, 16, 50, 1);
  block(ctx, roofDark, 9, 10, 38, 6);
  block(ctx, roof, 10, 9, 36, 6);
  block(ctx, roofLight, 10, 9, 36, 1);
  block(ctx, roofDark, 18, 4, 20, 5);
  block(ctx, roof, 19, 3, 18, 5);
  block(ctx, roofLight, 19, 3, 18, 1);
  // cửa và cửa sổ
  block(ctx, '#4a2f1b', 24, 32, 9, 15);
  block(ctx, '#6d4627', 25, 33, 7, 14);
  block(ctx, '#3b5b78', 12, 29, 7, 6);
  block(ctx, '#5c3d24', 15, 29, 1, 6);
  block(ctx, '#3b5b78', 38, 29, 7, 6);
  block(ctx, '#5c3d24', 41, 29, 1, 6);
  swirl(ctx, 42, 40, '#c8452f');
  return { canvas: c, ax: 28, ay: 47 };
}

/** Quầy hàng ven đường: mái sọc, rèm vải, quầy gỗ và hai ghế đẩu. */
function marketStallSprite(seed: number): PropSprite {
  const [c, ctx] = makeCanvas(46, 36);
  const stripes: [string, string][] = [
    ['#d8542f', '#f3e3c3'],
    ['#2f8a6b', '#f3e3c3'],
    ['#c79a2c', '#7a3b1e'],
  ];
  const [a, b] = stripes[seed % stripes.length];
  shadowEllipse(ctx, 23, 33, 21, 2, 0.25);
  block(ctx, '#5c3d24', 5, 8, 2, 25);
  block(ctx, '#5c3d24', 39, 8, 2, 25);
  for (let x = 2; x < 44; x += 6) {
    block(ctx, (x - 2) % 12 === 0 ? a : b, x, 2, 6, 7);
  }
  block(ctx, '#3a2614', 2, 9, 42, 1);
  for (let x = 8; x < 38; x += 6) block(ctx, '#e9ddc2', x, 10, 5, 7);
  // quầy gỗ
  block(ctx, '#8a5a30', 5, 22, 36, 4);
  block(ctx, '#a97544', 5, 22, 36, 1);
  block(ctx, '#6d4627', 7, 26, 32, 7);
  // bát trên quầy
  block(ctx, '#f4ead4', 12, 20, 5, 2);
  block(ctx, '#c8452f', 28, 20, 5, 2);
  // ghế đẩu
  block(ctx, '#5c3d24', 13, 32, 5, 2);
  block(ctx, '#5c3d24', 28, 32, 5, 2);
  return { canvas: c, ax: 23, ay: 33 };
}

/** Cổng làng lớn: hai trụ gỗ, xà và mái xanh, giữa để trống cho đường đi qua. */
function villageGateSprite(): PropSprite {
  const [c, ctx] = makeCanvas(88, 68);
  shadowEllipse(ctx, 12, 64, 9, 2, 0.28);
  shadowEllipse(ctx, 76, 64, 9, 2, 0.28);
  for (const x of [6, 70]) {
    block(ctx, '#4a2f1b', x, 18, 12, 47);
    block(ctx, '#6d4627', x + 1, 18, 9, 47);
    block(ctx, '#8a5a30', x + 1, 18, 2, 47);
    block(ctx, '#2f5d46', x - 1, 58, 14, 7);
    block(ctx, '#3f7a5c', x - 1, 58, 14, 2);
  }
  // xà ngang và bảng tên
  block(ctx, '#4a2f1b', 6, 24, 76, 6);
  block(ctx, '#7a4f2a', 6, 24, 76, 2);
  block(ctx, '#2c2118', 30, 30, 28, 11);
  block(ctx, '#e8dcc3', 32, 32, 24, 7);
  swirl(ctx, 44, 35, '#c8452f');
  // mái xanh hai tầng cong nhẹ ở hai đầu
  block(ctx, '#1f4d39', 0, 14, 88, 7);
  block(ctx, '#2f6d50', 1, 12, 86, 7);
  block(ctx, '#4b9672', 1, 12, 86, 1);
  block(ctx, '#1f4d39', 10, 6, 68, 6);
  block(ctx, '#2f6d50', 11, 4, 66, 7);
  block(ctx, '#4b9672', 11, 4, 66, 1);
  return { canvas: c, ax: 44, ay: 64 };
}

/** Cổng đền đỏ giữa rừng. */
function toriiSprite(): PropSprite {
  const [c, ctx] = makeCanvas(38, 38);
  shadowEllipse(ctx, 19, 35, 15, 2, 0.25);
  block(ctx, '#a02c20', 8, 8, 4, 28);
  block(ctx, '#c8452f', 9, 8, 2, 28);
  block(ctx, '#a02c20', 26, 8, 4, 28);
  block(ctx, '#c8452f', 27, 8, 2, 28);
  block(ctx, '#2c2118', 1, 2, 36, 2);
  block(ctx, '#c8452f', 2, 4, 34, 4);
  block(ctx, '#e0614a', 2, 4, 34, 1);
  block(ctx, '#a02c20', 6, 13, 26, 3);
  block(ctx, '#8a5a30', 17, 8, 4, 5);
  return { canvas: c, ax: 19, ay: 35 };
}

/** Bãi cọc tập: ba khúc gỗ dựng, có dây quấn ở cọc giữa. */
function trainingLogSprite(): PropSprite {
  const [c, ctx] = makeCanvas(34, 28);
  shadowEllipse(ctx, 17, 25, 15, 2, 0.25);
  for (const [x, top] of [[4, 11], [14, 4], [24, 11]] as const) {
    block(ctx, '#4a2f1b', x, top, 7, 25 - top);
    block(ctx, '#7a4f2a', x + 1, top, 5, 25 - top);
    block(ctx, '#9a6c3e', x + 1, top, 2, 25 - top);
    block(ctx, '#b58a5c', x, top, 7, 2);
  }
  block(ctx, '#e8dcc3', 14, 11, 7, 2);
  block(ctx, '#e8dcc3', 14, 15, 7, 2);
  return { canvas: c, ax: 17, ay: 25 };
}

export function propSprite(prop: ExteriorProp): PropSprite {
  const key = prop.kind === 'lamp' || prop.kind === 'bench' || prop.kind === 'totem' ? prop.kind : `${prop.kind}:${prop.seed % 7}`;
  let s = cache.get(key);
  if (s) return s;
  switch (prop.kind) {
    case 'tree':
      s = treeSprite(prop.seed % 7);
      break;
    case 'pine':
      s = pineSprite(prop.seed % 7);
      break;
    case 'bush':
      s = bushSprite(prop.seed % 7);
      break;
    case 'flowers':
      s = flowersSprite(prop.seed % 7);
      break;
    case 'hedge':
      s = hedgeSprite(prop.seed % 7);
      break;
    case 'lamp':
      s = lampSprite();
      break;
    case 'bench':
      s = benchSprite();
      break;
    case 'rock':
      s = rockSprite(prop.seed % 7);
      break;
    case 'parasol':
      s = parasolSprite(prop.seed % 7);
      break;
    case 'totem':
      s = totemSprite();
      break;
    case 'ninja_house':
      s = ninjaHouseSprite(prop.seed % 7);
      break;
    case 'market_stall':
      s = marketStallSprite(prop.seed % 7);
      break;
    case 'village_gate':
      s = villageGateSprite();
      break;
    case 'torii':
      s = toriiSprite();
      break;
    case 'training_log':
      s = trainingLogSprite();
      break;
    default:
      // 'paving' e outros tipos desenhados pelo próprio renderer
      s = { canvas: makeCanvas(1, 1)[0], ax: 0, ay: 0 };
  }
  cache.set(key, s);
  return s;
}

/** Sombra de contato sob os personagens. */
export function shadowSprite(): PropSprite {
  const hit = cache.get('shadow');
  if (hit) return hit;
  const [c, ctx] = makeCanvas(14, 6);
  shadowEllipse(ctx, 7, 3, 6, 2, 0.28);
  const s = { canvas: c, ax: 7, ay: 3 };
  cache.set('shadow', s);
  return s;
}

/** Brilho radial (desenhado com composição aditiva). */
export function glowSprite(color: string, size = 64): HTMLCanvasElement {
  const key = `glow:${color}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit.canvas;
  const [c, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const [r, gg, b] = hex(color);
  g.addColorStop(0, `rgba(${r},${gg},${b},0.9)`);
  g.addColorStop(0.4, `rgba(${r},${gg},${b},0.35)`);
  g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cache.set(key, { canvas: c, ax: size / 2, ay: size / 2 });
  return c;
}
