import { describe, expect, it } from 'vitest';
import { CLASSIC_SCENARIOS, NinjaWarDirector } from './ninja-war-director';

describe('NinjaWarDirector', () => {
  it('định nghĩa đầy đủ 6 kịch bản đại chiến kinh điển', () => {
    expect(CLASSIC_SCENARIOS.length).toBe(6);
    expect(CLASSIC_SCENARIOS.map((s) => s.id)).toEqual([
      'konoha-golden',
      'sannin-clash',
      'akatsuki-vs-kage',
      'valley-of-the-end',
      'tailed-beast-war',
      'fourth-shinobi-war',
    ]);
  });

  it('khởi tạo với trạng thái ban đầu idle', () => {
    const mockSim = { chars: new Map(), building: { grid: { nearestWalkable: () => ({ x: 20, y: 15 }) } } } as any;
    const director = new NinjaWarDirector(mockSim, 100_000);
    expect(director.getState()).toBeNull();
    expect(director.getNextBattleTime()).toBe(125_000);
  });
});
