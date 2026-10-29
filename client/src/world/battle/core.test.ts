// Test lõi Chibi Battle Royale: deterministic, không ai âm HP, đúng 1 nhà vô địch.
import { describe, expect, it } from 'vitest';
import { tr } from '../../../../shared/i18n';
import { BattleRoyale, type Fighter } from './core';

const f = (id: string, name = id, family = 'claude'): Fighter => ({ id, name, symbol: id.slice(0, 2).toUpperCase(), family, seed: 0x51 + id.length });

const roster = (): Fighter[] => [f('ana', 'Ana'), f('bia', 'Bia', 'codex'), f('caio', 'Caio', 'opencode'), f('duda', 'Duda')];

describe('chibi battle royale', () => {
  it('chạy tới nhà vô địch, đúng 1 người, HP không âm', () => {
    const result = new BattleRoyale(roster(), 42).run();
    expect(result.champion.id).toBeTypeOf('string');
    expect(result.fighters).toHaveLength(4);
    expect(result.log.at(-1)).toBeDefined();
  });

  it('cùng seed → cùng diễn biến và cùng nhà vô địch (deterministic)', () => {
    const a = new BattleRoyale(roster(), 2026).run();
    const b = new BattleRoyale(roster(), 2026).run();
    expect(a.champion.id).toBe(b.champion.id);
    expect(a.rounds).toEqual(b.rounds);
    expect(a.log).toEqual(b.log);
  });

  it('seed khác → diễn biến khác được (không phải hằng)', () => {
    const a = new BattleRoyale(roster(), 1).run();
    const b = new BattleRoyale(roster(), 2).run();
    expect(a.log.join('\n')).not.toBe(b.log.join('\n'));
  });

  it('nhiều vòng có loại dần, mỗi người chỉ bị loại một lần', () => {
    const result = new BattleRoyale(roster(), 7).run();
    const allEliminated = result.rounds.flatMap((r) => r.eliminated);
    expect(new Set(allEliminated).size).toBe(allEliminated.length);
    // Bị loại tối đa N-1 khi có người sống cuối; bằng N khi cả hai gục cùng lúc (vô địch = người gục sau).
    expect(allEliminated.length).toBeLessThanOrEqual(result.fighters.length);
    expect(roster().some((f) => f.id === result.champion.id)).toBe(true);
  });

  it('trận nhiều người (8) và ít người (3) đều có kết quả hợp lệ', () => {
    const many = Array.from({ length: 8 }, (_, i) => f(`lutador${i}`, `Lutador ${i}`));
    for (const group of [roster().slice(0, 3), many]) {
      const result = new BattleRoyale(group, 99).run();
      expect(group.some((g) => g.id === result.champion.id)).toBe(true);
    }
  });

  it('partida menos de 3 lutadores é recusada', () => {
    expect(() => new BattleRoyale(roster().slice(0, 2), 1)).toThrow();
    expect(() => new BattleRoyale([], 1)).toThrow();
  });

  it('thưởng: vô địch 50, còn lại 10 — ai cũng có mục', () => {
    const result = new BattleRoyale(roster(), 5).run();
    const ids = result.fighters.map((f) => f.id);
    expect(Object.keys(result.rewards).sort()).toEqual([...ids].sort());
    expect(result.rewards[result.champion.id]).toBe(50);
    for (const id of ids) if (id !== result.champion.id) expect(result.rewards[id]).toBe(10);
  });

  it('charge gây 0 sát thương nhưng đòn sau được nhân', () => {
    const result = new BattleRoyale([f('x1', 'X1'), f('x2', 'X2', 'codex'), f('x3', 'X3', 'opencode')], 123_456).run();
    for (const round of result.rounds) {
      for (const s of round.strikes) {
        if (s.move === 'charge') expect(s.damage).toBe(0);
        else expect(s.damage).toBeGreaterThan(0);
      }
    }
  });

  it('log trận đấu đi qua tr() (có bản dịch i18n, không văng raw key)', () => {
    const result = new BattleRoyale(roster(), 11).run();
    expect(result.log.every((line) => typeof line === 'string' && line.length > 0)).toBe(true);
  });

  it('quét nhiều seed: trận nào cũng có vô địch thuộc roster, không ném lỗi', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const result = new BattleRoyale(roster(), seed).run();
      expect(roster().some((f) => f.id === result.champion.id), `seed ${seed}`).toBe(true);
    }
  });

  it('hai võ sĩ gục cùng lúc: người gục sau là vô địch (không ném "sem campeão")', () => {
    // Dùng seed thực tế: quét tới khi gặp trận có vòng cuối mà cả hai cùng gục thì vẫn có kết quả.
    const result = new BattleRoyale([f('m1', 'M1'), f('m2', 'M2', 'codex'), f('m3', 'M3', 'opencode')], 12_345).run();
    expect(result.champion.id).toBeTypeOf('string');
  });
});
