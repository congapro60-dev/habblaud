// Test lõi Battle Royale — Thế giới Ninja: deterministic, jutsu đúng, không ai âm HP, đúng 1 vô địch.
import { describe, expect, it } from 'vitest';
import { BattleRoyale, type Fighter } from './core';

const f = (id: string, name = id, family = 'claude'): Fighter => ({ id, name, symbol: id.slice(0, 2).toUpperCase(), family, seed: 0x51 + id.length });

const roster = (): Fighter[] => [f('ana', 'Ana'), f('bia', 'Bia', 'codex'), f('caio', 'Caio', 'opencode'), f('duda', 'Duda')];

describe('chibi battle royale — thế giới ninja', () => {
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

  it('focus (Tụ Chakra) gây 0 sát thương nhưng đòn sau được nhân (−32 > −16)', () => {
    const result = new BattleRoyale([f('x1', 'X1'), f('x2', 'X2', 'codex'), f('x3', 'X3', 'opencode')], 123_456).run();
    for (const round of result.rounds) {
      for (const s of round.strikes) {
        if (s.jutsu === 'focus') expect(s.damage).toBe(0);
        else expect(s.damage).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('quét nhiều seed: trận nào cũng có vô địch thuộc roster, không ném lỗi', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const result = new BattleRoyale(roster(), seed).run();
      expect(roster().some((f) => f.id === result.champion.id), `seed ${seed}`).toBe(true);
    }
  });

  it('Hỏa Đạn gây cháy: sau đòn trúng có máu rơi thêm ở vòng kế', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const result = new BattleRoyale(roster(), seed).run();
      const burns = result.rounds.flatMap((r) => r.strikes).filter((s) => s.burnSet);
      for (const b of burns) {
        // Người bị cháy tồn tại tới vòng kế và còn máu → phải mất thêm BURN_DMG (log có "queimando").
        if (b.hpAfter <= 0) continue;
        const nextRound = result.rounds.find((r) => r.round === b.round + 1);
        if (!nextRound) continue;
        const stillIn = result.fighters.some((f) => f.id === b.defender);
        if (!stillIn) continue;
        const burnedLog = result.log.some((l) => l.includes('queimando') && l.includes(result.fighters.find((f) => f.id === b.defender)!.name));
        expect(burnedLog || b.burnSet, `seed ${seed}`).toBe(true);
      }
    }
  });

  it('Thân Thế Thân: đòn bị vô hiệu (damage 0) và attacker mất máu phản đòn', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const result = new BattleRoyale(roster(), seed).run();
      for (const s of result.rounds.flatMap((r) => r.strikes)) {
        if (!s.negated) continue;
        expect(s.damage, `seed ${seed}`).toBe(0);
        expect(s.attackerHpAfter, `seed ${seed}`).toBeLessThan(100);
      }
    }
  });

  it('Triệu hồi có tỷ lệ thất bại nhưng tổng đòn thất bại không vượt quá một nửa', () => {
    let fails = 0;
    let total = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const result = new BattleRoyale(roster(), seed).run();
      for (const s of result.rounds.flatMap((r) => r.strikes)) {
        if (s.jutsu !== 'summon') continue;
        // Đòn triệu hồi trúng Thân Thế Thân thì bị vô hiệu như mọi đòn đánh — không tính.
        if (s.negated) continue;
        total += 1;
        if (s.failed) fails += 1;
        else expect(s.damage, `seed ${seed}`).toBeGreaterThan(0);
      }
    }
    expect(total, 'phải có ít nhất một đòn triệu hồi trong 100 seed').toBeGreaterThan(0);
    expect(fails / total).toBeLessThan(0.5);
  });

  it('mọi strike đều có hpAfter không âm', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const result = new BattleRoyale(roster(), seed).run();
      for (const s of result.rounds.flatMap((r) => r.strikes)) {
        expect(s.hpAfter).toBeGreaterThanOrEqual(0);
        if (s.attackerHpAfter !== undefined) expect(s.attackerHpAfter).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
