import { describe, expect, it } from 'vitest';
import type { Appearance, ArtModule, RoomTheme } from '../../art/api';
import { DEFAULT_WORLD_OPTIONS } from '../api';
import { ALL_JUTSU_KINDS, CAST_MS, castAt, hasOwnJutsu, jutsuOf } from '../sim/jutsu';
import { Sim } from '../sim/sim';
import { drawJutsu } from './jutsu-fx';

/** Canvas giả: ghi lại mọi lệnh vẽ để so sánh giữa các chiêu và các pha. */
function fakeCtx(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(t, k: string) {
      if (k === 'measureText') return () => ({ width: 40 });
      if (k in t) return t[k];
      return (...args: unknown[]) => {
        if (k !== 'save' && k !== 'restore') log.push(`${k}(${args.map((v) => (typeof v === 'number' ? v.toFixed(1) : v)).join()})`);
      };
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

const A = { x: 100, y: 200 };
const B = { x: 180, y: 206 };

function shot(kind: (typeof ALL_JUTSU_KINDS)[number], p: number): string[] {
  const { ctx, log } = fakeCtx();
  drawJutsu(ctx, kind, 'x', A, B, p, 12_345);
  return log;
}

describe('bộ nhẫn thuật', () => {
  it('có nhiều chiêu khác nhau, chiêu nào cũng vẽ được ở mọi pha và không có giá trị lỗi', () => {
    expect(ALL_JUTSU_KINDS.length).toBeGreaterThanOrEqual(30);
    for (const kind of ALL_JUTSU_KINDS) {
      for (const p of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.999]) {
        const log = shot(kind, p);
        expect(log.length, `${kind} @${p}`).toBeGreaterThan(0);
        expect(log.join(), `${kind} @${p}`).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it('mỗi chiêu có dáng riêng và đổi hình theo từng pha, không phải một đốm sáng đứng yên', () => {
    const seen = new Set<string>();
    for (const kind of ALL_JUTSU_KINDS) {
      const phases = [0.2, 0.5, 0.8].map((p) => shot(kind, p).join());
      expect(new Set(phases).size, kind).toBeGreaterThan(1);
      seen.add(phases[1]);
    }
    expect(seen.size).toBe(ALL_JUTSU_KINDS.length);
  });

  it('không còn dùng gradient (đắt và làm hiệu ứng nhoè thành "sáng sáng")', () => {
    for (const kind of ALL_JUTSU_KINDS) {
      expect(shot(kind, 0.5).join()).not.toMatch(/createRadialGradient|createLinearGradient/);
    }
  });

  it('toàn bộ dàn nhân vật trong toà nhà đều có chiêu riêng theo đúng tên, kể cả các Kage', () => {
    const theme = { carpet: '#000000', carpet2: '#000000', wall: { base: '#000000', trim: '#000000', pattern: 'plain' }, accent: '#000000', deskVariant: 'wood', chairVariant: 'black' } as RoomTheme;
    const art = { appearanceFromSeed: () => ({ look: 'm' }) as unknown as Appearance, roomTheme: () => theme } as unknown as ArtModule;
    const sim = new Sim(art, () => ({ ...DEFAULT_WORLD_OPTIONS, liveliness: 'calm' }), null, { heads: true });
    const missing = [...sim.chars.values()]
      .filter((c) => sim.isLocalCast(c) && !sim.isOutdoorPatrol(c))
      .map((c) => c.info.name)
      .filter((n) => !hasOwnJutsu(n));
    expect(missing).toEqual([]);
  });

  it('khớp nguyên từ: tên có chữ "ay" hay "mei" ở giữa không bị nhận nhầm là Kage', () => {
    expect(jutsuOf('Raikage Ay (Lôi Độn)')[0].kind).toBe('lightning_rush');
    expect(jutsuOf('Mizukage Mei Terumi (Dung Độn)')[0].kind).toBe('lava_release');
    expect(hasOwnJutsu('Maya Nobody')).toBe(false);
    expect(hasOwnJutsu('Tomei Nobody')).toBe(false);
  });

  it('hai bên thay phiên ra chiêu, và người có nhiều chiêu sẽ đổi chiêu qua các lượt', () => {
    const naruto = 'Uzumaki Naruto';
    const sasuke = 'Uchiha Sasuke';
    const turns = Array.from({ length: 8 }, (_, i) => castAt(i * CAST_MS + 10, 0, naruto, sasuke));
    expect(turns.map((c) => c.attacker)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    const narutoMoves = new Set(turns.filter((c) => c.attacker === 0).map((c) => c.jutsu.kind));
    expect(narutoMoves.size).toBe(3);
    for (const c of turns) {
      expect(c.p).toBeGreaterThanOrEqual(0);
      expect(c.p).toBeLessThan(1);
    }
  });
});
