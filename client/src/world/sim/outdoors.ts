// Lộ trình ngoài toà nhà (tính bằng tile). Lưới đi lại (WalkGrid) chỉ phủ trong nhà; ngoài nhà là cảnh không có vật cản,
// nên nhân vật đi thẳng theo các điểm mốc, vòng quanh toà nhà chứ không xuyên qua. Lối ra duy nhất ở đầu tây hành lang.
import { BUILDING_H, COL_W, CORRIDOR_Y, EXT_EAST, EXT_SOUTH, EXT_WEST } from '../constants';

export interface TilePoint {
  x: number;
  y: number;
}

export type OutdoorZone = 'road' | 'southForest' | 'westForest' | 'eastForest' | 'northForest';

/** Trong nhà, ngay sau vách kính đầu tây hành lang. */
export const DOOR_IN: TilePoint = { x: 1, y: CORRIDOR_Y + 2 };
/** Ngoài nhà, trên đường đá cuội dẫn vào cửa tây. */
export const DOOR_OUT: TilePoint = { x: -3, y: CORRIDOR_Y + 2 };

/** Vành đi quanh toà nhà: bắc dưới chân vách núi, nam trên vỉa hè. */
function ringOf(cols: number) {
  return { x0: -3, x1: cols * COL_W + 2, y0: -2, y1: BUILDING_H + 3 };
}

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** Điểm trên vành gần `p` nhất. */
function project(p: TilePoint, r: ReturnType<typeof ringOf>): TilePoint {
  const x = clamp(p.x, r.x0, r.x1);
  const y = clamp(p.y, r.y0, r.y1);
  const d = [x - r.x0, r.x1 - x, y - r.y0, r.y1 - y];
  const min = Math.min(...d);
  if (min === d[0]) return { x: r.x0, y };
  if (min === d[1]) return { x: r.x1, y };
  if (min === d[2]) return { x, y: r.y0 };
  return { x, y: r.y1 };
}

/** Hai điểm cùng nằm ngoài vành về một phía thì đi thẳng được, không xuyên toà nhà. */
function sameSide(a: TilePoint, b: TilePoint, r: ReturnType<typeof ringOf>): boolean {
  return (a.y >= r.y1 && b.y >= r.y1) || (a.y <= r.y0 && b.y <= r.y0) || (a.x <= r.x0 && b.x <= r.x0) || (a.x >= r.x1 && b.x >= r.x1);
}

/** Các điểm mốc từ `from` tới `to` (không gồm `from`), đi theo vành theo chiều ngắn hơn. */
export function outdoorRoute(from: TilePoint, to: TilePoint, cols: number): TilePoint[] {
  const r = ringOf(cols);
  if (sameSide(from, to, r)) return [to];
  const W = r.x1 - r.x0;
  const H = r.y1 - r.y0;
  const L = 2 * (W + H);
  // vị trí dọc vành theo chiều kim đồng hồ, bắt đầu từ góc tây bắc
  const pos = (p: TilePoint): number => {
    if (p.y === r.y0) return p.x - r.x0;
    if (p.x === r.x1) return W + (p.y - r.y0);
    if (p.y === r.y1) return W + H + (r.x1 - p.x);
    return 2 * W + H + (r.y1 - p.y);
  };
  const corners: { p: TilePoint; t: number }[] = [
    { p: { x: r.x0, y: r.y0 }, t: 0 },
    { p: { x: r.x1, y: r.y0 }, t: W },
    { p: { x: r.x1, y: r.y1 }, t: W + H },
    { p: { x: r.x0, y: r.y1 }, t: 2 * W + H },
  ];
  const a = project(from, r);
  const b = project(to, r);
  const ta = pos(a);
  const cw = (pos(b) - ta + L) % L;
  const forward = cw <= L / 2;
  const span = forward ? cw : L - cw;
  const along = corners
    .map((c) => ({ p: c.p, d: forward ? (c.t - ta + L) % L : (ta - c.t + L) % L }))
    .filter((c) => c.d > 0 && c.d < span)
    .sort((m, n) => m.d - n.d)
    .map((c) => c.p);
  return [a, ...along, b, to];
}

/** Một điểm ngẫu nhiên trong khu vực ngoài nhà. */
export function outdoorSpot(zone: OutdoorZone, cols: number, rng: () => number): TilePoint {
  const w = cols * COL_W;
  const south = BUILDING_H;
  const between = (a: number, b: number): number => Math.floor(a + rng() * (b - a));
  switch (zone) {
    case 'road': {
      const lanes = [south + 3, south + 6, south + 10];
      return { x: between(-EXT_WEST + 2, w + EXT_EAST - 2), y: lanes[Math.floor(rng() * lanes.length)] };
    }
    case 'southForest':
      return { x: between(-EXT_WEST + 2, w + EXT_EAST - 2), y: between(south + 12, south + EXT_SOUTH - 2) };
    case 'westForest':
      return { x: between(-EXT_WEST + 2, -5), y: between(1, south) };
    case 'eastForest':
      return { x: between(w + 4, w + EXT_EAST - 2), y: between(1, south) };
    case 'northForest':
      return { x: between(-EXT_WEST + 2, w + EXT_EAST - 2), y: -2 };
  }
}
