// Sprites procedurais da área externa (árvores, arbustos, postes, carros...) e utilitários
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
    default:
      // 'paving' e outros tipos desenhados pelo próprio renderer
      s = { canvas: makeCanvas(1, 1)[0], ax: 0, ay: 0 };
  }
  cache.set(key, s);
  return s;
}

const NINJA_SPRINT_STYLES: [string, string, string, string][] = [
  ['#ea580c', '#1e293b', '#facc15', '#f8fafc'], // Naruto (Cam / Lam / Tóc vàng / Băng trán)
  ['#1e293b', '#475569', '#171412', '#93c5fd'], // Sasuke (Áo chàm / Tóc đen / Chidori)
  ['#15803d', '#166534', '#171412', '#22c55e'], // Gai / Lee (Đồ bó xanh lá Mộc Diệp)
  ['#dc2626', '#171412', '#cbd5e1', '#ef4444'], // Akatsuki (Áo choàng đen mây đỏ)
  ['#0284c7', '#0369a1', '#e2e8f0', '#38bdf8'], // Ninja Làng Mây / Kirigakure
  ['#78350f', '#451a03', '#ca8a04', '#fed7aa'], // Ninja Làng Cát / Làng Đá
];

/** Nhẫn giả phi thân Naruto run (cúi thấp người, hai tay duỗi thẳng ra sau phóng như bay dọc đường). */
export function carSprite(variant: number, flip: boolean): PropSprite {
  const key = `car:${variant % NINJA_SPRINT_STYLES.length}:${flip ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [topCol, botCol, hairCol, fxCol] = NINJA_SPRINT_STYLES[variant % NINJA_SPRINT_STYLES.length];
  const [c, ctx] = makeCanvas(36, 20);
  if (flip) {
    ctx.translate(36, 0);
    ctx.scale(-1, 1);
  }
  // Vệt bóng mờ phi thân trên mặt đất
  shadowEllipse(ctx, 18, 17, 14, 2, 0.25);

  // 1. Luồng gió / Khói bụi lướt gió sau gót chân
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(4, 15, 6, 2);
  ctx.fillRect(2, 13, 5, 2);

  // 2. Hai cánh tay duỗi thẳng song song ra sau lưng (Naruto Run đặc trưng)
  ctx.fillStyle = topCol;
  ctx.fillRect(6, 9, 12, 3);
  ctx.fillStyle = '#fed7aa'; // Bàn tay
  ctx.fillRect(4, 9, 3, 2);

  // 3. Đôi chân sải bước thần tốc
  ctx.fillStyle = botCol;
  ctx.fillRect(13, 13, 8, 4); // Chân sau
  ctx.fillRect(23, 14, 7, 4); // Chân trước
  ctx.fillStyle = '#1e293b';  // Sandal ninja
  ctx.fillRect(28, 16, 4, 2);

  // 4. Thân mình cúi gập song song mặt đất phóng về phía trước
  ctx.fillStyle = topCol;
  ctx.fillRect(16, 7, 13, 7);

  // 5. Đầu & Tóc nhọn bay theo chiều gió
  ctx.fillStyle = '#fed7aa'; // Mặt
  ctx.fillRect(26, 5, 6, 6);
  ctx.fillStyle = hairCol;   // Mái tóc
  ctx.fillRect(23, 3, 8, 4);
  ctx.fillRect(20, 4, 4, 3); // Tóc vuốt ngược ra sau

  // 6. Băng bảo hộ trán ninja kim loại lấp lánh & Dải ruy băng bay phấp phới
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(28, 5, 4, 2);
  ctx.fillStyle = fxCol;     // Ruy băng bay ra sau
  ctx.fillRect(19, 6, 5, 1);
  ctx.fillRect(15, 7, 4, 1);

  const s = { canvas: c, ax: 18, ay: 17 };
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
