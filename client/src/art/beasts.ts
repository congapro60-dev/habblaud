// Vĩ thú, linh thú triệu hồi, Susanoo và Lục Đạo: sprite pixel lớn có khung hình, tự vẽ bằng code (fan art, không dùng
// hình gốc). Thuần dữ liệu (PixelBuf), không đụng DOM. Gốc toạ độ: chân nhân vật ở (AX, AY).
import { PixelBuf } from './core/pixbuf';

export type BeastKind =
  | 'shukaku' | 'matatabi' | 'isobu' | 'songoku' | 'kokuo' | 'saiken' | 'choumei' | 'gyuki' | 'kurama' | 'juubi'
  | 'gamabunta' | 'manda' | 'katsuyu' | 'enma'
  | 'susanoo_blue' | 'susanoo_purple' | 'susanoo_red'
  | 'hagoromo' | 'naruto_sixpaths';

export const BEAST_KINDS: readonly BeastKind[] = [
  'shukaku', 'matatabi', 'isobu', 'songoku', 'kokuo', 'saiken', 'choumei', 'gyuki', 'kurama', 'juubi',
  'gamabunta', 'manda', 'katsuyu', 'enma',
  'susanoo_blue', 'susanoo_purple', 'susanoo_red',
  'hagoromo', 'naruto_sixpaths',
];

export const BEAST_FRAMES = 4;
const W = 140;
const H = 124;
export const BEAST_AX = 70;
export const BEAST_AY = 116;

interface Pal {
  main: string;
  light: string;
  dark: string;
  accent: string;
  eye: string;
}

/** Khối tròn có bóng: tối ở dưới, sáng ở trên trái. */
function blob(b: PixelBuf, x: number, y: number, rx: number, ry: number, p: Pal): void {
  b.ellipse(x, y + 1, rx, ry, p.dark);
  b.ellipse(x, y, rx - 0.5, ry - 0.5, p.main);
  if (rx > 4) b.ellipse(x - rx * 0.28, y - ry * 0.32, rx * 0.42, ry * 0.36, p.light);
}

/** Một cái đuôi cong, phình ở giữa, chóp sáng, đung đưa theo khung hình. */
function tail(b: PixelBuf, x: number, y: number, angle: number, len: number, thick: number, sway: number, p: Pal, tip?: string): void {
  const steps = Math.max(10, Math.round(len / 2));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const a = angle + (sway * 0.5 + 0.35) * k * k * (angle < -Math.PI / 2 ? -1 : 1);
    const px = x + Math.cos(a) * len * k;
    const py = y + Math.sin(a) * len * k;
    const r = Math.max(1, thick * Math.sin(Math.PI * (0.18 + k * 0.78)));
    b.ellipse(px, py, r, r, k > 0.82 ? (tip ?? p.light) : k > 0.5 ? p.main : p.dark);
  }
}

/** Xoè `n` đuôi hình quạt phía sau thân. */
function tails(b: PixelBuf, n: number, x: number, y: number, len: number, thick: number, f: number, p: Pal, tip?: string): void {
  // xoè sang hai bên, chừa khoảng giữa để đầu không che mất đuôi
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2);
    const rows = Math.max(1, Math.ceil(n / 2) - 1);
    const lift = rows === 0 ? 0 : (rank / rows) * Math.PI * 0.42;
    const a = n === 1 ? -Math.PI / 2 : side < 0 ? -Math.PI * 1.04 + lift : Math.PI * 0.04 - lift;
    tail(b, x, y, a, len, thick, Math.sin((f * Math.PI) / 2 + i * 1.3), p, tip);
  }
}

function eye(b: PixelBuf, x: number, y: number, c: string, slit = true): void {
  b.rect(x - 2, y - 1, 5, 3, c);
  if (slit) b.vline(x, y - 1, y + 1, '#16110d');
  else b.rect(x, y, 1, 1, '#16110d');
}

/** Bốn chân to có móng. */
function legs(b: PixelBuf, cx: number, gy: number, spread: number, p: Pal, claw = '#f2ede0'): void {
  for (const dx of [-spread, -spread * 0.42, spread * 0.42, spread]) {
    const x = Math.round(cx + dx);
    b.rect(x - 5, gy - 14, 10, 14, p.dark);
    b.rect(x - 4, gy - 14, 8, 13, p.main);
    b.hline(x - 4, x + 3, gy - 1, claw);
    b.set(x - 2, gy - 2, claw);
    b.set(x + 1, gy - 2, claw);
  }
}

// ------------------------------------------------------------------ vĩ thú

function shukaku(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#c9a56a', light: '#e4c78e', dark: '#8d6f41', accent: '#3b5f93', eye: '#f2d94e' };
  tail(b, 60, 74, -Math.PI * 0.86, 56, 13, Math.sin((f * Math.PI) / 2), p, '#e4c78e');
  legs(b, 70, 116, 26, p);
  blob(b, 70, 78, 36, 34, p);
  blob(b, 70, 40, 24, 22, p);
  b.ellipse(50, 24, 7, 8, p.dark);
  b.ellipse(90, 24, 7, 8, p.dark);
  // vân ấn chú xanh trên người
  for (const [x0, y0, x1, y1] of [[48, 62, 62, 80], [92, 62, 78, 80], [58, 92, 82, 92], [52, 36, 60, 44], [88, 36, 80, 44]] as const) b.line(x0, y0, x1, y1, p.accent, 2);
  eye(b, 60, 40, p.eye);
  eye(b, 80, 40, p.eye);
  b.rect(62, 50, 16, 3, '#3a2510');
  for (let x = 63; x < 77; x += 4) b.rect(x, 50, 2, 2, '#f2ede0');
}

function matatabi(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#2c3f8f', light: '#5f7ce0', dark: '#121a4d', accent: '#7fd6ff', eye: '#f4e04d' };
  tails(b, 2, 48, 72, 52, 9, f, p, p.accent);
  legs(b, 66, 116, 28, p, '#cfe7ff');
  blob(b, 62, 80, 36, 22, p);
  blob(b, 96, 58, 20, 18, p);
  // tai nhọn và lửa xanh
  b.line(84, 44, 80, 26, p.dark, 4);
  b.line(108, 44, 112, 26, p.dark, 4);
  for (let i = 0; i < 7; i++) {
    const x = 34 + i * 10;
    const up = 8 + ((i * 7 + f * 3) % 6);
    b.ellipse(x, 62 - up / 2, 3, up / 2 + 1, p.accent);
  }
  eye(b, 90, 56, p.eye);
  eye(b, 104, 56, p.eye);
  b.rect(90, 66, 16, 2, '#f2ede0');
}

function isobu(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#7b8a78', light: '#a9b5a0', dark: '#4c584b', accent: '#c9d3c0', eye: '#e8452f' };
  tails(b, 3, 40, 86, 42, 8, f, p);
  legs(b, 68, 116, 30, p);
  blob(b, 66, 76, 42, 30, p);
  for (let i = 0; i < 6; i++) {
    const x = 34 + i * 12;
    const top = 46 + Math.abs(i - 2.5) * 5;
    b.line(x, top + 8, x + 2, top - 8, p.accent, 3);
  }
  b.line(30, 86, 102, 86, p.dark, 2);
  blob(b, 106, 80, 15, 13, p);
  eye(b, 110, 78, p.eye, false);
  b.rect(102, 88, 14, 2, '#2a2a22');
}

function songoku(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#a8392c', light: '#d6604a', dark: '#6d1f18', accent: '#f0b13a', eye: '#f5e05a' };
  tails(b, 4, 52, 66, 50, 8, f, p, p.accent);
  blob(b, 70, 72, 30, 34, p);
  const arm = Math.sin((f * Math.PI) / 2) * 3;
  b.line(46, 56, 28, 90 + arm, p.main, 9);
  b.line(94, 56, 112, 90 - arm, p.main, 9);
  b.rect(52, 100, 14, 16, p.dark);
  b.rect(76, 100, 14, 16, p.dark);
  blob(b, 70, 36, 20, 18, p);
  b.line(58, 22, 50, 6, p.accent, 3);
  b.line(82, 22, 90, 6, p.accent, 3);
  b.ellipse(70, 44, 12, 7, '#e6c7a0');
  eye(b, 62, 32, p.eye);
  eye(b, 78, 32, p.eye);
  b.rect(62, 44, 16, 2, '#3a1510');
}

function kokuo(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#e6e2d3', light: '#fbf8ec', dark: '#a9a48f', accent: '#d9534f', eye: '#c8452f' };
  tails(b, 5, 46, 70, 50, 8, f, p, p.accent);
  legs(b, 66, 116, 26, p, '#6d6a5c');
  blob(b, 62, 76, 34, 22, p);
  b.line(84, 66, 100, 42, p.main, 14);
  blob(b, 108, 38, 15, 13, p);
  for (const [x0, x1] of [[100, 92], [106, 104], [114, 120]] as const) b.line(x0, 28, x1, 10, p.accent, 3);
  eye(b, 112, 36, p.eye, false);
  b.rect(112, 44, 8, 2, '#6d6a5c');
}

function saiken(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#bcd3dd', light: '#e8f3f6', dark: '#7d9aa8', accent: '#e8f06c', eye: '#3b3a2c' };
  tails(b, 6, 44, 88, 40, 7, f, p, p.accent);
  blob(b, 72, 94, 46, 20, p);
  blob(b, 96, 66, 20, 24, p);
  b.line(88, 44, 82, 26, p.main, 4);
  b.line(106, 44, 112, 26, p.main, 4);
  b.ellipse(82, 24, 3, 3, p.accent);
  b.ellipse(112, 24, 3, 3, p.accent);
  for (let i = 0; i < 4; i++) b.ellipse(42 + i * 15, 86 - (i % 2) * 3, 4, 3, p.accent);
  eye(b, 90, 62, p.eye, false);
  eye(b, 104, 62, p.eye, false);
}

function choumei(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#3f8f6f', light: '#6fc79f', dark: '#1f5540', accent: '#f2c14e', eye: '#f25f4c' };
  const flap = f % 2 === 0 ? 0 : 5;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = 70 + side * (30 + i * 4);
      const y = 44 + i * 16 - flap;
      b.ellipse(x, y, 26 - i * 3, 9, 'rgba(159,226,214,0.75)');
      b.ellipse(x + side * 6, y, 14 - i, 4, 'rgba(95,180,170,0.75)');
    }
  }
  tail(b, 70, 92, Math.PI / 2 - 0.5, 20, 5, 0.2, p, p.accent);
  blob(b, 70, 78, 19, 28, p);
  blob(b, 70, 44, 15, 13, p);
  b.line(64, 32, 54, 14, p.accent, 2);
  b.line(76, 32, 86, 14, p.accent, 2);
  b.hline(52, 88, 70, p.accent);
  b.hline(53, 87, 84, p.accent);
  eye(b, 63, 42, p.eye, false);
  eye(b, 77, 42, p.eye, false);
  for (const x of [52, 62, 78, 88]) b.rect(x, 104, 4, 12, p.dark);
}

function gyuki(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#6a4a78', light: '#94709f', dark: '#3b2645', accent: '#f0e6d2', eye: '#f2d94e' };
  // tám xúc tu toả xuống và sang hai bên, có giác hút
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI * 1.02 + (Math.PI * 1.04 * i) / 7;
    tail(b, 70, 78, a, 54, 8, Math.sin((f * Math.PI) / 2 + i), p, p.light);
  }
  blob(b, 70, 74, 30, 28, p);
  blob(b, 70, 40, 19, 17, p);
  for (const side of [-1, 1]) {
    b.line(70 + side * 16, 30, 70 + side * 32, 22, p.accent, 4);
    b.line(70 + side * 32, 22, 70 + side * 36, 8, p.accent, 3);
  }
  eye(b, 62, 38, p.eye);
  eye(b, 78, 38, p.eye);
  b.ellipse(70, 50, 8, 4, '#3b2645');
  b.rect(52, 100, 12, 16, p.dark);
  b.rect(76, 100, 12, 16, p.dark);
}

function kurama(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#e8742c', light: '#f7a24b', dark: '#a8430f', accent: '#1e1410', eye: '#d92c2c' };
  tails(b, 9, 72, 66, 64, 10, f, p, '#ffd27a');
  legs(b, 72, 116, 26, p, '#1e1410');
  blob(b, 72, 76, 32, 28, p);
  blob(b, 72, 40, 25, 21, p);
  // tai cáo nhọn, viền đen
  b.line(54, 26, 46, 4, p.accent, 7);
  b.line(54, 26, 47, 8, p.main, 4);
  b.line(90, 26, 98, 4, p.accent, 7);
  b.line(90, 26, 97, 8, p.main, 4);
  // vân đen quanh mắt, ức sáng
  b.line(48, 34, 60, 42, p.accent, 2);
  b.line(96, 34, 84, 42, p.accent, 2);
  b.ellipse(72, 84, 15, 14, '#f9c98a');
  eye(b, 60, 40, p.eye);
  eye(b, 84, 40, p.eye);
  b.rect(56, 52, 32, 5, '#2a0f08');
  for (let x = 57; x < 87; x += 4) b.rect(x, 52, 2, 3, '#f7f1e3');
}

function juubi(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#4a4640', light: '#6e6960', dark: '#25221e', accent: '#7a8a6a', eye: '#d92c2c' };
  tails(b, 10, 70, 74, 66, 9, f, p, p.accent);
  blob(b, 70, 86, 38, 30, p);
  b.rect(38, 96, 16, 20, p.dark);
  b.rect(86, 96, 16, 20, p.dark);
  blob(b, 70, 48, 24, 24, p);
  for (const side of [-1, 1]) b.line(70 + side * 16, 30, 70 + side * 30, 8, p.accent, 4);
  // một con mắt đỏ giữa trán, có các vòng tròn đồng tâm
  b.ellipse(70, 42, 12, 10, '#f2d0c8');
  b.ellipse(70, 42, 10, 9, p.eye);
  b.ellipse(70, 42, 7, 6, '#16110d');
  b.ellipse(70, 42, 6, 5, p.eye);
  b.ellipse(70, 42, 3, 3, '#16110d');
  b.ellipse(70, 42, 2, 2, p.eye);
  b.rect(54, 62, 32, 5, '#16110d');
  for (let x = 55; x < 85; x += 4) b.rect(x, 62, 2, 3, '#e8e2d2');
}

// ------------------------------------------------------------------ linh thú

function gamabunta(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#c9552e', light: '#e8804f', dark: '#84321a', accent: '#2f5f8f', eye: '#f2d94e' };
  b.ellipse(40, 110, 18, 7, p.dark);
  b.ellipse(100, 110, 18, 7, p.dark);
  blob(b, 70, 78, 44, 34, p);
  // áo khoác xanh
  b.ellipse(70, 88, 40, 24, p.accent);
  b.ellipse(70, 86, 36, 20, '#3f7ab0');
  b.line(70, 66, 70, 110, '#f2ede0', 2);
  blob(b, 70, 44, 32, 20, p);
  b.ellipse(50, 28, 9, 8, p.light);
  b.ellipse(90, 28, 9, 8, p.light);
  eye(b, 50, 28, p.eye);
  eye(b, 90, 28, p.eye);
  b.rect(46, 54, 48, 3, '#3a1208');
  // tẩu thuốc có khói
  b.line(92, 56, 118, 48, '#5c3d24', 3);
  b.rect(116, 42, 6, 6, '#3a2614');
  const puff = f % BEAST_FRAMES;
  b.ellipse(120, 36 - puff * 3, 3 + puff, 3 + puff, 'rgba(240,240,235,0.7)');
  // dao lớn đeo bên hông
  b.line(24, 70, 8, 34, '#cfd6de', 4);
  b.line(26, 74, 34, 92, '#3a2614', 5);
}

function manda(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#6d3f96', light: '#9a6cc4', dark: '#3f1f5e', accent: '#2a1a3a', eye: '#f2d94e' };
  const s = Math.sin((f * Math.PI) / 2) * 3;
  blob(b, 70, 100, 50, 15, p);
  blob(b, 66, 84, 38, 14, p);
  blob(b, 74, 68, 26, 12, p);
  for (const [x, y] of [[36, 100], [60, 104], [90, 102], [108, 98], [48, 84], [80, 86], [66, 68], [86, 66]] as const) b.ellipse(x, y, 4, 3, p.accent);
  b.line(78, 62, 92 + s, 34, p.main, 16);
  blob(b, 98 + s, 28, 22, 14, p);
  eye(b, 92 + s, 22, p.eye);
  eye(b, 108 + s, 24, p.eye);
  b.line(118 + s, 34, 132 + s, 34 + (f % 2) * 3, '#d92c2c', 2);
  b.rect(90 + s, 36, 26, 2, '#2a1a3a');
}

function katsuyu(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#e8eef0', light: '#ffffff', dark: '#aab9c2', accent: '#5b8ec9', eye: '#2a2a35' };
  const s = (f % 2) * 2;
  blob(b, 66, 92, 54, 22 + s, p);
  blob(b, 100, 60, 20, 28, p);
  for (let i = 0; i < 4; i++) b.line(30 + i * 22, 74, 30 + i * 22, 110, p.accent, 3);
  b.line(92, 40, 86, 16, p.main, 5);
  b.line(108, 40, 114, 16, p.main, 5);
  b.ellipse(86, 14, 4, 4, p.accent);
  b.ellipse(114, 14, 4, 4, p.accent);
  eye(b, 94, 58, p.eye, false);
  eye(b, 108, 58, p.eye, false);
  b.rect(96, 72, 10, 2, p.accent);
}

function enma(b: PixelBuf, f: number): void {
  const p: Pal = { main: '#4f4a45', light: '#7a736a', dark: '#2a2622', accent: '#e8e0cf', eye: '#f2d94e' };
  const staff = (f % 2) * 2;
  b.line(112, 12 + staff, 104, 116, '#2a2622', 7);
  b.ellipse(112, 12 + staff, 7, 7, '#d9a441');
  blob(b, 68, 76, 30, 32, p);
  b.line(92, 58, 106, 76, p.main, 9);
  b.line(44, 58, 30, 92, p.main, 9);
  b.rect(50, 100, 14, 16, p.dark);
  b.rect(74, 100, 14, 16, p.dark);
  b.ellipse(68, 80, 18, 20, '#8f2f26');
  blob(b, 68, 38, 21, 20, p);
  b.ellipse(68, 18, 21, 6, p.accent);
  b.ellipse(68, 44, 13, 8, '#d8b08a');
  eye(b, 60, 34, p.eye, false);
  eye(b, 76, 34, p.eye, false);
  b.rect(60, 46, 16, 2, '#2a1510');
}

// ------------------------------------------------------------------ Susanoo, Lục Đạo

function susanoo(b: PixelBuf, f: number, glow: string, core: string, edge: string): void {
  const rib = (x0: number, y0: number, x1: number, y1: number, size = 3) => {
    b.line(x0, y0, x1, y1, edge, size + 2);
    b.line(x0, y0, x1, y1, glow, size);
  };
  // vỏ giáp chakra trong suốt
  b.ellipse(70, 66, 44, 50, core);
  // cánh tay và kiếm
  rib(32, 48, 16, 86);
  rib(108, 48, 126, 78);
  rib(126, 78, 134, 8 + (f % 2) * 2, 4);
  b.line(134, 8 + (f % 2) * 2, 134, 2 + (f % 2) * 2, '#ffffff', 2);
  // xương sườn
  for (let i = 0; i < 5; i++) {
    const y = 52 + i * 11;
    rib(70, y, 40 + i * 2, y + 6, 2);
    rib(70, y, 100 - i * 2, y + 6, 2);
  }
  rib(70, 44, 70, 112);
  // đầu giáp, sừng
  b.ellipse(70, 28, 20, 20, core);
  rib(52, 24, 40, 4);
  rib(88, 24, 100, 4);
  rib(52, 36, 88, 36, 2);
  b.rect(58, 24, 8, 4, '#fff7c2');
  b.rect(74, 24, 8, 4, '#fff7c2');
  // lửa chakra ở chân, đổi theo khung hình
  for (let i = 0; i < 8; i++) {
    const x = 28 + i * 12;
    const h = 6 + ((i * 5 + f * 3) % 7);
    b.ellipse(x, 114 - h / 2, 4, h / 2 + 1, glow);
  }
}

function hagoromo(b: PixelBuf, f: number): void {
  const float = Math.sin((f * Math.PI) / 2) * 2;
  const y = (v: number) => Math.round(v + float);
  // vầng hào quang và áo choàng trắng
  b.ellipse(70, y(40), 32, 32, 'rgba(255,240,170,0.35)');
  for (let i = 0; i < 9; i++) {
    const a = (i * Math.PI * 2) / 9 + (f * Math.PI) / 18;
    b.ellipse(70 + Math.cos(a) * 42, y(52) + Math.sin(a) * 18, 4, 4, '#16110d');
  }
  b.ellipse(70, y(78), 21, 34, '#b9b3a2');
  b.ellipse(70, y(76), 19, 32, '#f4efe2');
  b.line(70, y(50), 70, y(108), '#c8452f', 2);
  b.line(50, y(60), 34, y(78), '#f4efe2', 8);
  b.line(90, y(60), 104, y(72), '#f4efe2', 8);
  // gậy
  b.line(106, y(16), 104, y(112), '#3a2614', 4);
  b.ellipse(106, y(14), 7, 7, '#d9a441');
  b.ellipse(106, y(14), 3, 3, '#16110d');
  // đầu: tóc và râu trắng, hai sừng, mắt Rinnegan
  b.ellipse(70, y(36), 16, 15, '#e6c7a0');
  b.line(58, y(26), 50, y(8), '#d8d2c2', 4);
  b.line(82, y(26), 90, y(8), '#d8d2c2', 4);
  b.ellipse(70, y(24), 16, 8, '#e8e4d8');
  b.ellipse(70, y(50), 10, 12, '#e8e4d8');
  b.rect(62, y(34), 5, 3, '#9d7fd4');
  b.rect(74, y(34), 5, 3, '#9d7fd4');
  b.set(64, y(35), '#16110d');
  b.set(76, y(35), '#16110d');
  b.set(70, y(29), '#c8452f');
}

function narutoSixPaths(b: PixelBuf, f: number): void {
  const gold = '#f7d24a';
  const light = '#fff3b0';
  const dark = '#c78f1e';
  // hào quang và tám quả cầu cầu đạo đen bay quanh
  b.ellipse(70, 72, 26, 44, 'rgba(255,220,120,0.35)');
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + (f * Math.PI) / 8;
    b.ellipse(70 + Math.cos(a) * 34, 60 + Math.sin(a) * 12, 3, 3, '#16110d');
  }
  b.rect(62, 92, 7, 24, dark);
  b.rect(72, 92, 7, 24, dark);
  b.ellipse(70, 76, 14, 22, dark);
  b.ellipse(70, 75, 12, 20, gold);
  b.line(58, 62, 48, 86, gold, 5);
  b.line(82, 62, 92, 86, gold, 5);
  b.hline(60, 80, 76, '#16110d');
  b.ellipse(70, 74, 3, 3, '#16110d');
  b.ellipse(70, 44, 11, 11, light);
  // tóc nhọn và hai sừng tóc
  for (const [x0, x1, y1] of [[60, 54, 28], [66, 62, 24], [74, 78, 24], [80, 86, 28], [64, 56, 16], [76, 84, 16]] as const) b.line(x0, 38, x1, y1, gold, 3);
  b.rect(64, 44, 3, 2, '#d9571f');
  b.rect(73, 44, 3, 2, '#d9571f');
  for (const dy of [0, 3]) {
    b.hline(58, 62, 47 + dy, '#16110d');
    b.hline(78, 82, 47 + dy, '#16110d');
  }
}

// ------------------------------------------------------------------ xuất

const SOFT: ReadonlySet<BeastKind> = new Set<BeastKind>(['choumei', 'susanoo_blue', 'susanoo_purple', 'susanoo_red', 'hagoromo', 'naruto_sixpaths']);

export function renderBeast(kind: BeastKind, frame: number): PixelBuf {
  const b = new PixelBuf(W, H);
  const f = ((frame % BEAST_FRAMES) + BEAST_FRAMES) % BEAST_FRAMES;
  switch (kind) {
    case 'shukaku': shukaku(b, f); break;
    case 'matatabi': matatabi(b, f); break;
    case 'isobu': isobu(b, f); break;
    case 'songoku': songoku(b, f); break;
    case 'kokuo': kokuo(b, f); break;
    case 'saiken': saiken(b, f); break;
    case 'choumei': choumei(b, f); break;
    case 'gyuki': gyuki(b, f); break;
    case 'kurama': kurama(b, f); break;
    case 'juubi': juubi(b, f); break;
    case 'gamabunta': gamabunta(b, f); break;
    case 'manda': manda(b, f); break;
    case 'katsuyu': katsuyu(b, f); break;
    case 'enma': enma(b, f); break;
    case 'susanoo_blue': susanoo(b, f, '#6fb6ff', 'rgba(70,140,255,0.32)', '#1f4f9e'); break;
    case 'susanoo_purple': susanoo(b, f, '#bb7cff', 'rgba(150,80,240,0.32)', '#54208f'); break;
    case 'susanoo_red': susanoo(b, f, '#ff6b5e', 'rgba(240,70,60,0.32)', '#8f1f18'); break;
    case 'hagoromo': hagoromo(b, f); break;
    case 'naruto_sixpaths': narutoSixPaths(b, f); break;
  }
  // viền tối như các sprite khác; hình có vầng sáng trong suốt thì không viền
  if (!SOFT.has(kind)) b.outline();
  return b;
}
