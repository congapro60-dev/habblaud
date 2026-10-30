// Móveis das salas de projeto: mesas (frente e traseira), cadeiras, estantes, arquivo, impressora,
// lixeira, plantas, divisórias de vidro, mesa de reunião, banqueta, luminária e bebedouro.
// Coordenadas de desenho = footprint (0,0 no canto superior esquerdo; base em y = h*TILE).
import { mix, ramp, shade, type Ramp } from '../core/color';
import { floorSheet, rectAt, type BufFurniture, type BufSprite } from '../core/sprite';
import type { PixelBuf } from '../core/pixbuf';
import {
  ACCENTS, M, bigLeaf, book, contact, foliage, frontFace, keyboard, leafBlade, monitorBack, monitorFront, mouse, mug,
  papers, pencilCup, photoFrame, pick, pot, rngOf, smallSucculent, staticScreen, topFace, underRect, woodGrain,
  type DeskItemTone,
} from './kit';

type Box = { x: number; y: number; w: number; h: number };

// ------------------------------------------------------------------ mesas

interface DeskMats {
  top: Ramp;
  edge: Ramp;
  legs: Ramp;
  ped: Ramp;
}

function deskMats(variant: string | undefined): DeskMats {
  switch (variant) {
    case 'white':
      return { top: M.white, edge: ramp('#d7d6d1', 0.05), legs: M.steel, ped: ramp('#dcdbd6', 0.05) };
    case 'dark':
      return { top: M.walnut, edge: ramp('#5f4535', 0.06), legs: M.graphite, ped: ramp('#5a4334', 0.06) };
    default:
      return { top: M.oak, edge: M.oakDark, legs: ramp('#e9e8e4', 0.05), ped: ramp('#e6e4de', 0.05) };
  }
}

const MUG_COLORS = ['#e2604f', '#3f7fd8', '#f2c14e', '#4cae6a', '#f4f2ee', '#8d66cf'] as const;

/** Sombra de contato da mesa e sombra do vão sob o tampo (compostas por baixo, após o contorno). */
function deskShadow(b: PixelBuf): void {
  underRect(b, 3, 8, 26, 7, 'rgba(30,34,52,0.2)');
  contact(b, -1, 13, 34, 4, 0.2);
}

/** Tampo + bordas + pernas + gaveteiro (comum a desk e desk_back). */
function deskBody(s: BufSprite, m: DeskMats, seed: number, back: boolean): void {
  const b = s.buf;
  if (back) {
    // Painel frontal (lado de quem olha) cobrindo o vão.
    frontFace(b, 1, 8, 30, 6, m.ped);
    b.hline(1, 30, 8, m.ped.dk);
    b.hline(2, 29, 11, m.ped.lt);
  }
  // Pernas (laterais) com brilho.
  for (const x of [0, 29]) {
    b.rect(x, 8, 3, 8, m.legs.base);
    b.vline(x, 8, 15, m.legs.lt);
    b.vline(x + 2, 8, 15, m.legs.dk);
    b.hline(x, x + 2, 15, m.legs.dd);
  }
  if (!back) {
    // Gaveteiro sob o lado direito.
    frontFace(b, 19, 8, 10, 8, m.ped);
    b.hline(19, 28, 11, m.ped.dk);
    b.hline(19, 28, 12, m.ped.lt);
    b.hline(22, 25, 9, m.ped.dd);
    b.hline(22, 25, 13, m.ped.dd);
  }
  // Tampo (12 linhas) + espessura da borda (2 linhas).
  topFace(b, 0, -6, 32, 12, m.top);
  woodGrain(b, 1, -5, 30, 10, m.top, seed);
  b.hline(0, 31, 6, m.edge.base);
  b.hline(0, 31, 7, m.edge.dk);
  b.set(0, 6, m.edge.lt);
}

/** Objetos sobre a mesa (Bãi tập ném phi tiêu, bia Shuriken, cuộn bí kíp nhẫn thuật, giá kiếm Katana & bùa nổ). */
function deskTop(s: BufSprite, seed: number, tone: DeskItemTone): { screen: Box; screen2?: Box } {
  const b = s.buf;
  const r = rngOf(seed, 11);
  const v = seed % 6;
  const mugC = pick(r, MUG_COLORS);
  let screen: Box;
  let screen2: Box | undefined;
  switch (v) {
    case 1: {
      screen = monitorFront(b, 2, -17, 16, 11);
      screen2 = monitorFront(b, 18, -16, 13, 10);
      staticScreen(b, screen2, 'sheet', seed);
      keyboard(b, 6, -1, 11, tone);
      mouse(b, 20, 0, tone);
      mug(b, 26, -2, mugC);
      break;
    }
    case 2: {
      screen = monitorFront(b, 5, -17, 16, 11);
      b.rect(22, -9, 9, 6, '#3a404d');
      b.hline(22, 30, -9, '#4d5464');
      screen2 = { x: 23, y: -8, w: 7, h: 4 };
      staticScreen(b, screen2, 'ide', seed);
      b.rect(21, -3, 11, 2, '#c9ced6');
      b.hline(21, 31, -2, '#9aa1ad');
      b.hline(22, 31, -1, tone === 'onLight' ? 'rgba(40,46,70,0.3)' : 'rgba(60,40,40,0.2)');
      keyboard(b, 8, -1, 10, tone);
      smallSucculent(b, 1, -3);
      break;
    }
    case 3: {
      screen = monitorFront(b, 8, -17, 16, 11);
      b.rect(22, -15, 2, 2, '#f7d154');
      b.rect(9, -15, 2, 2, '#ff9fb2');
      keyboard(b, 11, -1, 10, tone);
      mouse(b, 23, 0, tone);
      photoFrame(b, 2, -5);
      papers(b, 24, -4, 6, 4, tone);
      mug(b, 3, 0, mugC);
      break;
    }
    case 4: {
      screen = monitorFront(b, 4, -17, 15, 11);
      screen2 = monitorFront(b, 19, -17, 12, 10);
      staticScreen(b, screen2, 'chart', seed);
      keyboard(b, 7, -1, 11, tone);
      mouse(b, 21, 0, tone);
      papers(b, 1, -2, 5, 4, tone);
      break;
    }
    case 5: {
      screen = monitorFront(b, 8, -17, 16, 11);
      keyboard(b, 11, -1, 10, tone);
      mouse(b, 23, 0, tone);
      b.hline(2, 6, -4, '#3a3f4b');
      b.set(1, -3, '#3a3f4b');
      b.set(7, -3, '#3a3f4b');
      b.rect(1, -2, 2, 2, '#e2604f');
      b.rect(6, -2, 2, 2, '#e2604f');
      mug(b, 26, -3, mugC);
      pencilCup(b, 28, 2);
      break;
    }
    default: {
      screen = monitorFront(b, 8, -17, 16, 11);
      keyboard(b, 11, -1, 10, tone);
      mouse(b, 23, 0, tone);
      mug(b, 3, -2, mugC);
      papers(b, 25, -4, 6, 4, tone);
      smallSucculent(b, 26, 2);
      break;
    }
  }

  // BIẾN THÀNH BÃI TẬP NÉM PHI TIÊU & BIA LUYỆN VÕ NINJA (SHURIKEN TARGET & SHINOBI WEAPON STATION)
  const scx = screen.x;
  const scy = screen.y;
  const scw = screen.w;
  const sch = screen.h;

  // 1. Bia tập ném phi tiêu bằng gỗ (Shuriken Target) phủ lên khung
  // Vành bia gỗ sồi dày dặn
  b.rect(scx, scy, scw, sch, '#854d0e');
  b.rect(scx + 1, scy + 1, scw - 2, sch - 2, '#a16207');
  // Vòng tròn đồng tâm hồng tâm tập ném phi tiêu (trắng - đỏ - vàng)
  const tcx = scx + Math.floor(scw / 2);
  const tcy = scy + Math.floor(sch / 2);
  b.ellipse(tcx, tcy, 5, 3.5, '#f8fafc');
  b.ellipse(tcx, tcy, 3, 2, '#dc2626');
  b.set(tcx, tcy, '#fde047'); // Hồng tâm vàng

  // 2. Phi tiêu Shuriken 4 cánh bằng thép sắc bén cắm ngập vào bia
  b.set(tcx - 3, tcy - 1, '#cbd5e1'); // tâm phi tiêu
  b.set(tcx - 4, tcy - 1, '#64748b'); // 4 cánh sắt
  b.set(tcx - 2, tcy - 1, '#64748b');
  b.set(tcx - 3, tcy - 2, '#64748b');
  b.set(tcx - 3, tcy, '#64748b');

  // Dao găm Kunai cắm chéo vào góc bia gỗ
  b.line(tcx + 2, tcy - 2, tcx + 5, tcy - 4, '#cbd5e1');
  b.set(tcx + 6, tcy - 5, '#ef4444'); // dây đỏ đuôi Kunai

  // 3. Cuộn Bí Kíp Nhẫn Thuật (Shinobi Jutsu Scroll) trải trên mặt bàn
  b.rect(3, -2, 11, 4, '#fef08a'); // giấy da cổ
  b.hline(3, 13, -2, '#ca8a04'); // mép cuộn trục
  b.hline(3, 13, 1, '#ca8a04');
  b.vline(3, -2, 1, '#78350f'); // trục gỗ hai bên
  b.vline(13, -2, 1, '#78350f');
  // Phù chú ký tự phong ấn màu đỏ/đen
  b.set(5, -1, '#dc2626');
  b.set(7, -1, '#09090b');
  b.set(9, -1, '#dc2626');
  b.set(11, -1, '#09090b');

  // 4. Giá gác kiếm Katana Ninja hoặc Bùa Nổ (Kibaku Fuda)
  if (v % 2 === 0) {
    // Giá gác bảo kiếm Katana/Tanto sơn mài đen
    b.rect(17, -3, 11, 2, '#18181b');
    b.set(18, -4, '#18181b'); // mấu gác kiếm
    b.set(26, -4, '#18181b');
    // Thanh kiếm Katana vỏ đen tuyền chuôi quấn băng trắng
    b.hline(16, 27, -5, '#09090b');
    b.hline(16, 19, -5, '#f8fafc'); // chuôi kiếm
    b.set(20, -5, '#f59e0b'); // tsuba kiếm vàng
  } else {
    // Bùa nổ Kibaku Fuda (Explosive Tag)
    b.rect(19, -3, 6, 4, '#fef9c3');
    b.rect(20, -2, 4, 2, '#dc2626');
    b.set(21, -2, '#fef9c3'); // chữ "Bộc" (爆)
    b.set(22, -1, '#fef9c3');
  }

  // 5. Hồ Lô thuốc võ đạo (Gourd) đựng tiên dược hồi phục Chakra
  b.ellipse(28, -2, 2, 2.5, '#78350f');
  b.set(28, -5, '#dc2626'); // nút thắt đỏ

  return { screen, screen2 };
}

/** Tom dos objetos conforme o tampo: no branco, um degrau mais escuros e com sombra firme. */
function itemTone(variant: string | undefined): DeskItemTone {
  return variant === 'white' ? 'onLight' : 'light';
}

export function desk(variant: string | undefined, seed: number): BufFurniture {
  const s = floorSheet(2, 1, 20);
  const m = deskMats(variant);
  deskBody(s, m, seed, false);
  const scr = deskTop(s, seed, itemTone(variant));
  s.buf.outline();
  deskShadow(s.buf);
  s.rects = { screen: rectAt(s, scr.screen.x, scr.screen.y, scr.screen.w, scr.screen.h) };
  if (scr.screen2) s.rects.screen2 = rectAt(s, scr.screen2.x, scr.screen2.y, scr.screen2.w, scr.screen2.h);
  return { base: s };
}

export function deskBack(variant: string | undefined, seed: number): BufFurniture {
  const s = floorSheet(2, 1, 12);
  const m = deskMats(variant);
  const b = s.buf;
  deskBody(s, m, seed, true);
  const r = rngOf(seed, 12);
  const v = seed % 4;
  const mugC = pick(r, MUG_COLORS);
  const tone = itemTone(variant);
  // Verso em plástico claro / gỗ mộc sáng đảm bảo độ sáng
  const plastic = variant === 'dark' ? 'mid' : 'light';
  if (v === 1) {
    monitorBack(b, 2, -7, 15, 10, plastic);
    monitorBack(b, 17, -6, 13, 9, plastic);
  } else {
    monitorBack(b, 8, -7, 16, 10, plastic);
    if (v === 2) smallSucculent(b, 26, 0);
    else papers(b, 25, -1, 6, 4, tone);
    if (v === 3) photoFrame(b, 2, -3);
    else mug(b, 2, 0, mugC);
  }

  // KHUNG ĐỠ BIA PHI TIÊU GỖ & CỌC TẬP VÕ NINJA TỪ PHÍA SAU
  // 1. Chân chống chữ A bằng gỗ đỡ mặt sau bia
  b.line(9, 2, 11, -5, '#78350f');
  b.line(22, 2, 20, -5, '#78350f');
  // 2. Mũi phi tiêu Shuriken cắm xuyên thủng qua lưng bia
  b.set(15, -4, '#94a3b8');
  b.set(16, -4, '#cbd5e1');
  b.set(18, -2, '#94a3b8');
  // 3. Ống tre cắm phi tiêu Shuriken rèn luyện
  b.rect(2, 0, 3, 4, '#15803d');
  b.set(3, -1, '#94a3b8');
  // 4. Cuộn bí kíp đã cuộn tròn buộc dây đỏ
  b.rect(25, 0, 6, 2, '#fef08a');
  b.set(27, 0, '#dc2626');

  b.outline();
  deskShadow(b);
  return { base: s };
}

// ------------------------------------------------------------------ cadeiras

const CHAIR_COLORS: Readonly<Record<string, string>> = {
  black: '#41465a',
  blue: '#3f62a3',
  red: '#b44a4a',
  green: '#3f8a62',
  gray: '#8b929e',
};

function chairRamp(variant: string | undefined): Ramp {
  return ramp(CHAIR_COLORS[variant ?? 'black'] ?? CHAIR_COLORS.black, 0.07);
}

/** Chân đôn gỗ võ quán cổ truyền (thay thế chân xoay kim loại và bánh xe công sở). */
function starBase(b: BufSprite['buf']): void {
  const wood = '#78350f';
  const woodHi = '#a16207';
  b.hline(3, 12, 13, wood);
  b.hline(5, 10, 14, wood);
  b.set(3, 13, woodHi);
  for (const [x, y] of [[2, 14], [13, 14], [4, 15], [11, 15]] as const) {
    b.set(x, y, '#451a03'); // chân gỗ mun
    b.set(x + (x < 8 ? 1 : -1), y, '#451a03');
  }
  b.rect(7, 9, 2, 4, woodHi);
  b.vline(8, 9, 12, wood);
}

export function officeChair(variant: string | undefined): BufFurniture {
  const c = chairRamp(variant);
  // Base: assento visto por trás + base estrela (o encosto fica no `front`).
  const base = floorSheet(1, 1, 6);
  const b = base.buf;
  starBase(b);
  b.rect(2, 4, 12, 6, c.lt);
  b.hline(3, 12, 4, c.hi);
  b.hline(2, 13, 8, c.base);
  b.hline(2, 13, 9, c.dk);
  b.set(2, 4, c.base);
  b.set(13, 4, c.base);
  b.outline();
  contact(b, 1, 13, 14, 3, 0.22);
  // Frente: encosto baixo e estreito — cobre a lombar de quem senta e deixa ombros e braços à mostra.
  const front = floorSheet(1, 1, 6);
  const f = front.buf;
  f.rect(4, 7, 8, 6, c.base);
  f.hline(5, 10, 6, c.lt);
  f.hline(4, 11, 7, c.lt);
  f.set(5, 7, c.hi);
  f.set(6, 7, c.hi);
  f.vline(4, 8, 11, c.lt);
  f.vline(11, 7, 12, c.dk);
  f.hline(5, 10, 9, c.dk);
  f.hline(5, 10, 10, c.dk);
  f.hline(4, 11, 12, c.dd);
  f.rect(7, 13, 2, 1, '#4a505c');
  f.outline();
  return { base, front };
}

export function officeChairFront(variant: string | undefined): BufFurniture {
  const c = chairRamp(variant);
  const s = floorSheet(1, 1, 10);
  const b = s.buf;
  starBase(b);
  // Encosto ao norte (de frente para a câmera).
  b.rect(3, -6, 10, 10, c.base);
  b.hline(4, 11, -7, c.lt);
  b.rect(4, -5, 8, 7, c.lt);
  b.hline(5, 10, -5, c.hi);
  b.vline(12, -6, 3, c.dk);
  b.hline(3, 12, 3, c.dd);
  b.rect(7, 4, 2, 2, '#4a505c');
  // Assento.
  b.rect(2, 5, 12, 5, c.lt);
  b.hline(3, 12, 5, c.hi);
  b.hline(2, 13, 9, c.dk);
  b.hline(2, 13, 10, c.dd);
  for (const x of [1, 13]) {
    b.rect(x, 3, 2, 5, '#3a3f4b');
    b.set(x, 3, '#5a6070');
  }
  b.outline();
  contact(b, 1, 13, 14, 3, 0.22);
  return { base: s };
}

// ------------------------------------------------------------------ estantes e arquivos

export function bookshelf(seed: number): BufFurniture {
  const s = floorSheet(2, 1, 22);
  const b = s.buf;
  const w = M.oak;
  const r = rngOf(seed, 21);
  // Corpo: laterais, topo e fundo.
  topFace(b, 0, -21, 32, 3, w);
  b.rect(0, -18, 32, 34, w.dk);
  b.rect(2, -17, 28, 31, shade(w.dd, -0.12));
  b.vline(0, -18, 15, w.lt);
  b.vline(1, -18, 15, w.base);
  b.vline(30, -18, 15, w.base);
  b.vline(31, -18, 15, w.dd);
  // Prateleiras.
  const shelves = [-8, 3, 15];
  for (const y of shelves) {
    b.hline(1, 30, y, w.lt);
    b.hline(1, 30, y + 1, w.dk);
  }
  b.hline(0, 31, 15, w.dd);
  // Conteúdo de cada prateleira (apoiado na prateleira de baixo).
  shelves.forEach((shelf, i) => {
    const bottom = shelf - 1;
    let x = 3;
    while (x < 29) {
      const kind = r();
      if (kind < 0.12 && x < 25) {
        // Vaso pequeno com planta.
        pot(b, x, bottom - 3, 4, 4, M.ceramic);
        foliage(b, x + 2, bottom - 5, 2.5, 2, M.leaf, seed + x + i * 7);
        x += 5;
      } else if (kind < 0.2 && x < 24) {
        // Caixa de arquivo.
        const bc = pick(r, ['#e9e4d6', '#c9a46e', '#9fb6cf']);
        b.rect(x, bottom - 4, 5, 5, bc);
        b.hline(x, x + 4, bottom - 4, shade(bc, 0.1));
        b.rect(x + 1, bottom - 2, 3, 1, shade(bc, -0.2));
        x += 6;
      } else if (kind < 0.26 && x < 26) {
        // Tượng Linh Thú Cóc Vàng / Bình Rượu Thuốc
        b.rect(x + 1, bottom - 4, 3, 2, '#f2c14e');
        b.set(x, bottom - 4, '#d9a42e');
        b.set(x + 4, bottom - 4, '#d9a42e');
        b.set(x + 2, bottom - 2, '#d9a42e');
        b.rect(x + 1, bottom - 1, 3, 2, '#6b4a32');
        x += 6;
      } else {
        // Cuộn Trục Bí Kíp Nhẫn Thuật (Shinobi Scrolls) cuộn tròn nhiều màu
        const n = 2 + Math.floor(r() * 4);
        const scrollColors = ['#fef08a', '#dc2626', '#38bdf8', '#a855f7', '#22c55e', '#f97316'];
        for (let k = 0; k < n && x < 29; k++) {
          const bw = 1 + Math.floor(r() * 2);
          const bh = 6 + Math.floor(r() * 4);
          const sCol = pick(r, scrollColors);
          book(b, x, bottom - bh + 1, bw, bh, sCol);
          b.set(x, bottom - Math.floor(bh / 2), '#dc2626'); // Dây nơ đỏ buộc cuộn bí kíp
          x += bw;
        }
        if (r() < 0.3 && x < 26) {
          b.line(x, bottom, x + 3, bottom - 6, '#fef08a', 1); // cuộn bí kíp nghiêng
          b.line(x + 1, bottom, x + 4, bottom - 6, '#fef08a', 1);
          x += 5;
        } else x += 1;
      }
    }
  });
  b.outline();
  contact(b, -1, 13, 34, 4, 0.22);
  return { base: s };
}

export function binderShelf(seed: number): BufFurniture {
  const s = floorSheet(1, 1, 22);
  const b = s.buf;
  const w = ramp('#ecebe6', 0.05);
  const r = rngOf(seed, 23);
  topFace(b, 0, -21, 16, 3, w);
  b.rect(0, -18, 16, 34, w.dk);
  b.rect(1, -17, 14, 31, '#7d8592');
  b.vline(0, -18, 15, w.lt);
  b.vline(15, -18, 15, w.dd);
  const shelves = [-8, 3, 15];
  for (const y of shelves) {
    b.hline(1, 14, y, w.lt);
    b.hline(1, 14, y + 1, w.dk);
  }
  const tops = [-17, -6, 5];
  const binders = ['#3f7fd8', '#ec8a3c', '#4cae6a', '#3f7fd8', '#ec8a3c', '#e05a5a', '#f2c14e'];
  tops.forEach((top, i) => {
    const bottom = shelves[i] - 1;
    const h = bottom - top + 1;
    if (i === 2 && r() < 0.6) {
      // Caixas de papelão na prateleira de baixo.
      b.rect(2, bottom - 6, 6, 7, M.cardboard.base);
      b.hline(2, 7, bottom - 6, M.cardboard.lt);
      b.rect(3, bottom - 4, 4, 2, '#f4efe2');
      b.rect(8, bottom - 5, 6, 6, M.cardboard.dk);
      b.hline(8, 13, bottom - 5, M.cardboard.base);
      b.rect(9, bottom - 3, 4, 2, '#f4efe2');
      return;
    }
    let x = 2;
    while (x < 14) {
      const c = pick(r, binders);
      const bh = Math.min(h - 1, 8 + Math.floor(r() * 2));
      b.rect(x, bottom - bh + 1, 2, bh, c);
      b.vline(x, bottom - bh + 1, bottom, shade(c, 0.1));
      b.set(x, bottom - bh + 3, '#f4f2ee');
      b.set(x + 1, bottom - bh + 3, '#f4f2ee');
      b.set(x + 1, bottom - 1, shade(c, -0.2));
      x += 2;
      if (r() < 0.12) x += 1;
    }
  });
  b.outline();
  contact(b, 0, 13, 16, 4, 0.22);
  return { base: s };
}

export function filingCabinet(): BufFurniture {
  const s = floorSheet(1, 1, 8);
  const b = s.buf;
  const m = ramp('#c3c9d2', 0.06);
  topFace(b, 1, -7, 14, 4, m);
  frontFace(b, 1, -3, 14, 19, m);
  for (const y of [3, 9]) {
    b.hline(1, 14, y, m.dd);
    b.hline(1, 14, y + 1, m.lt);
  }
  for (const y of [-1, 5, 11]) {
    b.rect(6, y, 4, 1, '#7d8592');
    b.rect(6, y + 1, 4, 1, '#eef1f5');
    b.set(5, y + 1, '#9aa2ae');
  }
  b.set(2, -3, m.hi);
  // Planta pequena em cima.
  smallSucculent(b, 9, -9);
  b.outline();
  contact(b, 0, 13, 16, 4, 0.22);
  return { base: s };
}

export function printer(): BufFurniture {
  const s = floorSheet(1, 1, 14);
  const b = s.buf;
  const wood = ramp('#854d0e', 0.06);
  const iron = ramp('#475569', 0.06);

  // RƯƠNG VŨ KHÍ NHẪN CỤ NINJA (SHINOBI WEAPON CHEST)
  // Thân rương gỗ cổ nẹp đai sắt
  frontFace(b, 0, 2, 16, 14, wood);
  b.hline(0, 15, 2, iron.base);
  b.hline(0, 15, 8, iron.base);
  b.hline(0, 15, 15, iron.dk);
  b.vline(0, 2, 15, iron.base);
  b.vline(15, 2, 15, iron.base);
  b.rect(7, 5, 2, 3, '#f59e0b'); // Khóa đồng rương

  // Nắp rương hơi mở hé lộ phi tiêu & cuộn bí kíp
  topFace(b, 0, -11, 16, 6, wood);
  b.rect(1, -10, 14, 3, '#78350f');
  b.hline(1, 14, -8, iron.hi);
  frontFace(b, 0, -5, 16, 7, wood);

  // Phi tiêu Shuriken & Dao Kunai lấp lánh trong rương
  b.set(3, -4, '#cbd5e1');
  b.set(4, -4, '#64748b');
  b.set(7, -3, '#cbd5e1');
  b.set(8, -3, '#ef4444'); // đuôi Kunai đỏ
  b.rect(10, -5, 4, 3, '#fef08a'); // cuộn bí kíp vàng
  b.set(11, -4, '#dc2626');

  b.outline();
  contact(b, -1, 13, 18, 4, 0.22);
  return { base: s };
}

export function trashBin(): BufFurniture {
  const s = floorSheet(1, 1, 2);
  const b = s.buf;
  // ỐNG TRE CẮM PHI TIÊU SHURIKEN LUYỆN TẬP
  const bamboo = ramp('#15803d', 0.07);
  for (let y = 7; y <= 15; y++) {
    const inset = y > 13 ? 1 : 0;
    b.hline(4 + inset, 11 - inset, y, bamboo.base);
    b.set(4 + inset, y, bamboo.lt);
    b.set(11 - inset, y, bamboo.dk);
  }
  b.hline(5, 10, 11, bamboo.dk); // mắt tre
  b.hline(5, 10, 15, bamboo.dk);
  // Miệng ống cắm đầy phi tiêu Shuriken sắt
  b.ellipse(8, 6.5, 4.5, 2, bamboo.lt);
  b.ellipse(8, 6.6, 3.5, 1.3, '#14532d');
  b.rect(6, 4, 3, 3, '#94a3b8'); // phi tiêu Shuriken cắm bên trong
  b.set(7, 3, '#cbd5e1');
  b.set(9, 4, '#ef4444'); // bùa đỏ
  b.outline();
  contact(b, 3, 14, 10, 2, 0.22);
  return { base: s };
}

// ------------------------------------------------------------------ plantas

export function plantSmall(variant: string | undefined, seed: number): BufFurniture {
  const s = floorSheet(1, 1, 10);
  const b = s.buf;
  const v = variant ?? 'fern';
  if (v === 'succulent') {
    pot(b, 4, 9, 8, 7, M.ceramic);
    b.rect(5, 9, 6, 1, '#5b4636');
    // Roseta azulada: pétalas grossas em camadas.
    const g = ramp('#7fbf9f', 0.08);
    const petals: [number, number, number, number][] = [[3, 8, 6, 5], [13, 8, 10, 5], [5, 5, 7, 3], [11, 5, 9, 3], [8, 3, 8, 6], [4, 7, 8, 6], [12, 7, 8, 6]];
    petals.forEach(([x1, y1, x0, y0], i) => leafBlade(b, x0, y0 + 2, x1, y1, 3, i < 2 ? ramp(g.dk, 0.08) : g, true));
    b.set(8, 5, g.hi);
    b.set(7, 6, g.lt);
  } else if (v === 'flower') {
    pot(b, 4, 9, 8, 7, M.terracotta);
    b.rect(5, 9, 6, 1, '#5b4636');
    const g = M.leaf;
    for (const [x1, y1] of [[2, 6], [14, 5], [5, 2], [11, 2], [8, 4]] as const) leafBlade(b, 8, 9, x1, y1, 3, g, x1 < 8);
    const petals = pick(rngOf(seed, 5), ['#f26d8a', '#f2c14e', '#ffffff', '#b07ae8']);
    for (const [x, y] of [[4, 1], [10, 0], [7, 3], [12, 4], [3, 5]] as const) {
      b.set(x, y, petals);
      b.set(x + 1, y, shade(petals, 0.12));
      b.set(x, y + 1, shade(petals, -0.12));
      b.set(x + 1, y + 1, '#f7d154');
    }
  } else {
    pot(b, 4, 9, 8, 7, M.terracotta);
    b.rect(5, 9, 6, 1, '#5b4636');
    // Samambaia: frondes arqueadas em lâminas finas.
    const g = M.leaf;
    const fr: [number, number, number][] = [[0, 7, 0], [16, 7, 0], [2, 1, 1], [14, 1, 0], [5, -3, 1], [11, -3, 1], [8, -5, 1], [-1, 11, 0], [17, 11, 0]];
    fr.forEach(([x1, y1, light]) => leafBlade(b, 8, 9, x1, y1, 2.6, light ? g : ramp(g.dk, 0.07), x1 < 8));
    b.set(8, -5, g.hi);
  }
  b.outline();
  contact(b, 3, 14, 10, 2, 0.24);
  return { base: s };
}

export function plantTall(variant: string | undefined, seed: number): BufFurniture {
  const s = floorSheet(1, 1, 24, 6);
  const b = s.buf;
  const v = variant ?? 'ficus';
  if (v === 'bonsai') {
    // Bonsai: suporte baixo de madeira, vaso-bandeja cerâmico e copa em "nuvens".
    const st = M.walnut;
    topFace(b, 1, 7, 14, 3, st);
    frontFace(b, 1, 10, 14, 3, st);
    for (const x of [2, 12]) b.rect(x, 13, 2, 3, st.dd);
    const tray = ramp('#4f6a8f', 0.07);
    b.rect(3, 4, 10, 1, tray.lt);
    b.rect(3, 5, 10, 2, tray.base);
    b.hline(4, 11, 4, '#5b4636');
    b.vline(12, 5, 6, tray.dk);
    b.hline(4, 11, 6, tray.dk);
    // Tronco retorcido com raízes aparentes.
    const tr = ramp('#7a5a40', 0.08);
    b.line(7, 4, 6, 0, tr.base, 2);
    b.line(6, 0, 9, -4, tr.base, 2);
    b.line(9, -4, 8, -8, tr.base, 1);
    b.line(8, -3, 4, -5, tr.base, 1);
    b.line(9, -5, 12, -6, tr.base, 1);
    b.set(6, 3, tr.dk);
    b.set(9, 4, tr.lt);
    b.set(5, 4, tr.lt);
    foliage(b, 4, -6.5, 3.6, 2.2, M.leafDark, seed + 3);
    foliage(b, 12.5, -7.5, 3.2, 2, M.leafDark, seed + 4);
    foliage(b, 8.5, -10.5, 4, 2.4, M.leaf, seed + 5);
  } else if (v === 'palm') {
    pot(b, 3, 6, 10, 10, M.ceramic);
    b.rect(4, 6, 8, 1, '#5b4636');
    const g = M.leaf;
    const dark = ramp(M.leaf.dk, 0.07);
    for (const sx of [6, 8, 10]) b.line(8, 6, sx, -4, '#86a04f', 1);
    // Frondes pinadas (de trás, escuras; da frente, claras) abrindo em leque.
    const fronds: [number, number, number, number, Ramp][] = [
      [7, -3, -2, -20, dark], [9, -3, 17, -19, dark], [7, -2, -5, -8, g], [9, -2, 21, -8, g], [8, -3, 8, -23, g],
    ];
    for (const [x0, y0, x1, y1, m] of fronds) bigLeaf(b, x0, y0, x1, y1, 6, m, 'pinnate');
  } else if (v === 'monstera') {
    pot(b, 3, 6, 10, 10, M.terracotta);
    b.rect(4, 6, 8, 1, '#5b4636');
    const g = ramp('#43995a', 0.08);
    const dark = ramp('#2f7a45', 0.08);
    // Folhas grandes recortadas, das de trás para as da frente, com hastes.
    const leaves: [number, number, number, number, number, Ramp][] = [
      [7, -7, 1, -17, 9, dark], [9, -7, 16, -16, 9, dark], [8, -6, 9, -21, 9, g],
      [6, 1, -3, -6, 9, g], [10, 1, 19, -5, 9, g], [8, 3, 6, -5, 7, dark],
    ];
    for (const [x0, y0] of leaves) b.line(8, 6, x0, y0, '#2f6b3d');
    for (const [x0, y0, x1, y1, w, m] of leaves) bigLeaf(b, x0, y0, x1, y1, w, m, 'monstera');
  } else {
    // Ficus: copa cheia em camadas sobre tronco fino.
    pot(b, 3, 6, 10, 10, M.ceramic);
    b.rect(4, 6, 8, 1, '#5b4636');
    const tr = '#7a5a3c';
    b.line(8, 6, 8, -4, tr, 1);
    b.line(7, 6, 7, 0, '#8e6b48', 1);
    b.line(8, -1, 5, -5, tr, 1);
    b.line(8, -3, 11, -6, tr, 1);
    foliage(b, 8, -10, 7, 5.5, M.leafDark, seed + 7);
    foliage(b, 6, -13, 4.6, 3.6, M.leaf, seed + 8);
    foliage(b, 11.5, -9, 3.8, 3.2, M.leaf, seed + 9);
    foliage(b, 4, -7, 3.2, 2.6, M.leaf, seed + 10);
  }
  b.outline();
  contact(b, 2, 14, 12, 3, 0.24);
  return { base: s };
}

// ------------------------------------------------------------------ divisórias de vidro

export function glassPartition(variant: string | undefined): BufFurniture {
  const v = variant ?? 'h';
  const s = floorSheet(1, 1, 22, 2);
  const b = s.buf;
  const wall = ramp('#f1f1ee', 0.045);
  const metal = ramp('#c3cad4', 0.06);
  if (v === 'v') {
    // Corre norte-sul: de cima vemos uma faixa uniforme (topo branco da meia-parede com o vidro e o
    // trilho no meio). Sem contorno automático para os segmentos emendarem sem costura.
    const cols = ['#aab2be', '#fbfbf9', '#f0f0ec', '#dce9f3', 'rgba(130,190,230,0.75)', '#e1e1dc', '#d0d0cb', '#9aa2ae'];
    cols.forEach((c, i) => b.vline(4 + i, -16, 15, c));
    for (let y = -16; y < 16; y += 7) b.set(8, y, 'rgba(255,255,255,0.8)');
    underRect(b, 12, -16, 2, 32, 'rgba(30,34,52,0.12)');
    return { base: s };
  }
  if (v === 'end') {
    // Ponta: coluna de alumínio sobre a base branca da meia-parede.
    topFace(b, 4, 3, 8, 4, wall);
    frontFace(b, 4, 7, 8, 9, wall);
    b.hline(4, 11, 13, mix(wall.dk, '#9aa2ae', 0.5));
    b.rect(6, -18, 4, 22, metal.base);
    b.vline(6, -18, 3, metal.hi);
    b.vline(9, -18, 3, metal.dk);
    b.hline(6, 9, -18, metal.hi);
    b.outline();
    contact(b, 3, 13, 10, 4, 0.2);
    return { base: s };
  }
  // 'h': corre leste-oeste (meia-parede branca + vidro azulado com reflexo).
  // A área do vidro fica opaca durante o contorno (máscara) para não ganhar borda por dentro.
  b.rect(0, -14, 16, 20, '#000000');
  b.rect(0, -17, 16, 3, metal.lt);
  b.hline(0, 15, -17, metal.hi);
  b.hline(0, 15, -15, metal.dk);
  topFace(b, 0, 6, 16, 3, wall);
  frontFace(b, 0, 9, 16, 7, wall);
  b.hline(0, 15, 14, mix(wall.dk, '#9aa2ae', 0.5));
  b.outline();
  b.clearRect(0, -14, 16, 20);
  // Vidro com um reflexo diagonal suave por módulo, brilho no topo e montante.
  b.rect(0, -14, 16, 20, 'rgba(172,214,238,0.34)');
  b.rect(0, -14, 16, 3, 'rgba(255,255,255,0.22)');
  for (let i = 0; i < 20; i++) {
    const x = 13 - Math.floor(i * 0.6);
    b.set(x, -14 + i, 'rgba(255,255,255,0.3)');
    b.set(x - 2, -14 + i, 'rgba(255,255,255,0.14)');
  }
  b.vline(0, -14, 5, 'rgba(195,202,212,0.85)');
  b.hline(0, 15, 5, 'rgba(120,150,175,0.35)');
  // Remove o contorno lateral para segmentos contínuos.
  for (let y = 0; y < b.h; y++) {
    b.clear(-1, y - b.oy);
    b.clear(16, y - b.oy);
  }
  contact(b, 0, 14, 16, 3, 0.16);
  return { base: s };
}

// ------------------------------------------------------------------ reunião e apoio

export function meetingTable(seed: number): BufFurniture {
  const s = floorSheet(3, 2, 10);
  const b = s.buf;
  const m = M.oak;
  const r = rngOf(seed, 31);
  // BÀN SA BÀN CHỈ HUY TÁC CHIẾN NHẪN GIẢ (SHINOBI WAR TACTICS SAND TABLE)
  // Chân bàn gỗ sồi dày dặn
  for (const x of [2, 43]) {
    b.rect(x, 21, 3, 11, '#5c3d28');
    b.vline(x, 21, 31, '#78350f');
    b.vline(x + 2, 21, 31, '#451a03');
  }
  topFace(b, 0, -4, 48, 24, m);
  b.hline(0, 47, 20, m.base);
  b.hline(0, 47, 21, m.dk);

  // Vùng Sa bàn địa hình 5 Làng Ninja ở trung tâm bàn
  b.rect(4, 2, 40, 10, '#c7a36c'); // Cát sa bàn địa hình
  b.hline(4, 43, 2, '#a1784c');
  b.hline(4, 43, 11, '#e2d3b8');
  // Dòng sông Thủy Độn xanh biếc chạy ngang sa bàn
  b.line(6, 6, 20, 8, '#0284c7');
  b.line(20, 8, 42, 5, '#0284c7');
  // Mô hình núi non Đá & Rừng cây Làng Lá
  b.rect(10, 4, 3, 3, '#15803d');
  b.rect(26, 3, 4, 3, '#64748b');
  b.rect(34, 7, 3, 2, '#d97706');

  // Cờ hiệu các làng ninja cắm trên sa bàn
  b.vline(12, 1, 4, '#dc2626'); // Cờ Lửa Konoha
  b.set(13, 1, '#ef4444');
  b.vline(36, 4, 7, '#38bdf8'); // Cờ Lôi Kumogakure
  b.set(37, 4, '#0284c7');

  // Cuộn giấy phong ấn quân sự & hồ lô nước
  b.rect(6, 13, 10, 3, '#fef08a');
  b.hline(6, 15, 13, '#ca8a04');
  b.set(8, 14, '#dc2626');
  b.set(11, 14, '#09090b');

  // Hồ lô rượu thuốc (Gourd)
  b.ellipse(35, 13, 2.5, 3, '#78350f');
  b.set(35, 9, '#ef4444');

  b.outline();
  contact(b, -1, 28, 50, 5, 0.22);
  underRect(b, 4, 22, 40, 8, 'rgba(30,34,52,0.16)');
  return { base: s };
}

export function stool(): BufFurniture {
  const s = floorSheet(1, 1, 2);
  const b = s.buf;
  // ĐÔN GỖ VÕ ĐẠO / ĐỆM NGỒI CÓI TATAMI
  b.ellipse(8, 14.5, 4, 1.4, '#451a03');
  b.rect(7, 8, 2, 6, '#78350f');
  b.vline(8, 8, 13, '#5c3d28');
  b.hline(5, 10, 11, '#9a3412');
  // Đệm ngồi cói bọc vải đỏ/xanh võ quán
  const seat = ramp('#991b1b', 0.07);
  b.ellipse(8, 6, 5.5, 3, seat.dk);
  b.ellipse(8, 5.4, 5.5, 2.6, seat.lt);
  b.set(5, 4, seat.hi);
  b.set(6, 4, seat.hi);
  b.outline();
  contact(b, 3, 13, 10, 3, 0.22);
  return { base: s };
}

export function floorLamp(): BufFurniture {
  const s = floorSheet(1, 1, 26);
  const b = s.buf;
  // ĐÈN LỒNG TRUYỀN THỐNG NHẪN GIẢ (SHINOBI LANTERN)
  b.ellipse(8, 14, 4, 1.5, '#451a03');
  b.hline(6, 9, 13, '#78350f');
  b.vline(8, -17, 13, '#5c3d28');
  b.vline(7, -17, 13, '#78350f');
  // Khung lồng đèn giấy đỏ viền đen
  const sh = ramp('#ef4444', 0.05);
  for (let i = 0; i < 7; i++) {
    const half = 3 + Math.floor(i / 2);
    b.hline(8 - half, 7 + half, -24 + i, i === 0 ? sh.hi : sh.lt);
    b.set(8 - half, -24 + i, '#18181b');
    b.set(7 + half, -24 + i, '#18181b');
  }
  b.hline(3, 12, -17, '#18181b');
  b.hline(5, 10, -16, '#fef08a');
  b.outline();
  contact(b, 3, 13, 10, 3, 0.22);
  s.rects = { glow: rectAt(s, 4, -20, 8, 6) };
  return { base: s };
}

export function waterCooler(): BufFurniture {
  const s = floorSheet(1, 1, 20);
  const b = s.buf;
  // CHUM NƯỚC THỦY ĐỘN / BÌNH NƯỚC THÁNH NINJA (SHINOBI WATER URN)
  const clay = ramp('#78350f', 0.06);
  // Đế gỗ đỡ chum
  topFace(b, 3, -2, 10, 3, ramp('#451a03', 0.05));
  frontFace(b, 3, 1, 10, 15, ramp('#451a03', 0.05));
  b.vline(3, 1, 15, '#78350f');

  // Thân chum gốm đất nung cổ tròn bầu
  for (let y = -14; y <= 0; y++) {
    const hw = Math.round(Math.sqrt(Math.max(0, 25 - (y + 7) * (y + 7))) * 1.1) + 2;
    b.hline(8 - hw, 8 + hw, y, clay.base);
    b.set(8 - hw, y, clay.lt);
    b.set(8 + hw, y, clay.dk);
  }
  // Miệng chum và nắp gỗ
  b.rect(5, -16, 7, 2, '#ca8a04'); // nắp gỗ
  b.set(8, -17, '#78350f'); // núm nắp
  // Gáo tre múc nước gác ngang miệng chum
  b.line(4, -15, 13, -13, '#15803d');
  b.rect(12, -14, 2, 2, '#166534');

  b.outline();
  contact(b, 1, 13, 14, 4, 0.22);
  return { base: s };
}
