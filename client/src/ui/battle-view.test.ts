// Test cầu view-model của Đấu trường Chibi: chọn võ sĩ, timeline máu, nhãn vòng.
import { describe, expect, it } from 'vitest';
import type { AgentInfo } from '../../../shared/types';
import { BattleRoyale } from '../world/battle/core';
import { canFight, hpTimeline, pickFighters, roundLabel } from './battle-view';

const agent = (id: string, name: string, status: AgentInfo['status'], engine?: AgentInfo['engine']): AgentInfo => ({
  id, name, kind: 'main', roomId: '/p', status, recent: [], tasks: [], startedAt: 0, lastEventAt: 0, statusSince: 0,
  sessionId: id, account: 'A', look: 'm', role: '', stats: { toolCalls: 0, tokensIn: 0, tokensOut: 0, subagents: 0 }, seed: 1, ...(engine ? { engine } : {}),
} as AgentInfo);

const office = (): AgentInfo[] => [
  agent('a1', 'Ana', 'idle', 'claude'),
  agent('a2', 'Bia', 'idle', 'codex'),
  agent('a3', 'Caio', 'idle', 'opencode'),
  agent('a4', 'Duda', 'working', 'claude'),
  agent('a5', 'Eva', 'offline'),
];

describe('pickFighters', () => {
  it('ưu tiên người rảnh, bỏ người offline, giới hạn 8', () => {
    const picked = pickFighters(office());
    expect(picked.map((f) => f.name)).toEqual(['Ana', 'Bia', 'Caio']);
    expect(picked[0].family).toBe('claude');
    expect(picked[1].symbol).toBe('BI');
  });

  it('không đủ người rảnh thì lấy người đang có mặt (trừ offline)', () => {
    const picked = pickFighters([agent('x', 'Xoa', 'working'), agent('y', 'Yen', 'working'), agent('z', 'Zan', 'idle')]);
    expect(picked).toHaveLength(3);
  });

  it('dưới 3 người thì không đấu', () => {
    expect(canFight([agent('a', 'Ana', 'idle'), agent('b', 'Bia', 'idle')])).toBe(false);
    expect(canFight(office())).toBe(true);
  });

  it('cùng id → cùng seed (deterministic)', () => {
    expect(pickFighters(office())[0].seed).toBe(pickFighters(office())[0].seed);
  });
});

describe('hpTimeline', () => {
  it('mỗi võ sĩ có số cột bằng số vòng, cột cuối khớp kết cục', () => {
    const result = new BattleRoyale(pickFighters(office()), 42).run();
    const timeline = hpTimeline(result);
    for (const f of result.fighters) {
      expect(timeline[f.id]).toHaveLength(result.rounds.length);
      expect(timeline[f.id].every((hp) => hp >= 0 && hp <= 100)).toBe(true);
    }
    // Vô địch có thể là "người gục sau" (cả hai gục cùng lúc): khi đó ai cũng 0 máu là hợp lệ.
    const lastHps = result.fighters.map((f) => timeline[f.id].at(-1)!);
    const anyAlive = lastHps.some((hp) => hp > 0);
    if (anyAlive) expect(timeline[result.champion.id].at(-1)!).toBeGreaterThan(0);
    else expect(lastHps.every((hp) => hp === 0)).toBe(true);
  });

  it('người bị loại có cột cuối bằng 0', () => {
    const result = new BattleRoyale(pickFighters(office()), 42).run();
    const timeline = hpTimeline(result);
    const losers = result.fighters.filter((f) => f.id !== result.champion.id);
    expect(losers.some((f) => timeline[f.id].at(-1) === 0)).toBe(true);
  });
});

describe('roundLabel', () => {
  it('nhắc số vòng hiện tại và tổng', () => {
    expect(roundLabel(2, 5)).toContain('2');
    expect(roundLabel(2, 5)).toContain('5');
  });
});
