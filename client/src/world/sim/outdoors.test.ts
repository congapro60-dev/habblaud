import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../../../shared/hash';
import { BUILDING_H, COL_W } from '../constants';
import { DOOR_OUT, outdoorRoute, outdoorSpot, type OutdoorZone, type TilePoint } from './outdoors';

const COLS = 7;
const W = COLS * COL_W;

/** Đoạn thẳng có đi vào bên trong toà nhà không (lấy mẫu dày). */
function crossesBuilding(a: TilePoint, b: TilePoint): boolean {
  for (let i = 0; i <= 200; i++) {
    const x = a.x + ((b.x - a.x) * i) / 200;
    const y = a.y + ((b.y - a.y) * i) / 200;
    if (x > 0 && x < W && y > 0 && y < BUILDING_H) return true;
  }
  return false;
}

describe('lộ trình ngoài nhà', () => {
  const zones: OutdoorZone[] = ['road', 'southForest', 'westForest', 'eastForest', 'northForest'];

  it('mọi lộ trình giữa các khu đều vòng quanh, không xuyên toà nhà, và tới đúng đích', () => {
    const rng = mulberry32(42);
    for (let n = 0; n < 500; n++) {
      const from = outdoorSpot(zones[Math.floor(rng() * zones.length)], COLS, rng);
      const to = outdoorSpot(zones[Math.floor(rng() * zones.length)], COLS, rng);
      const route = outdoorRoute(from, to, COLS);
      expect(route[route.length - 1]).toEqual(to);
      let prev = from;
      for (const p of route) {
        expect(crossesBuilding(prev, p), `${JSON.stringify(prev)} -> ${JSON.stringify(p)}`).toBe(false);
        prev = p;
      }
    }
  });

  it('từ cửa tây đi được tới mọi khu', () => {
    const rng = mulberry32(7);
    for (const zone of zones) {
      const to = outdoorSpot(zone, COLS, rng);
      let prev = DOOR_OUT;
      for (const p of outdoorRoute(DOOR_OUT, to, COLS)) {
        expect(crossesBuilding(prev, p)).toBe(false);
        prev = p;
      }
    }
  });

  it('các khu đều nằm ngoài toà nhà', () => {
    const rng = mulberry32(3);
    for (let n = 0; n < 300; n++) {
      const p = outdoorSpot(zones[n % zones.length], COLS, rng);
      expect(p.x > 0 && p.x < W && p.y > 0 && p.y < BUILDING_H).toBe(false);
    }
  });
});
