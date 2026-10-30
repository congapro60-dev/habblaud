import { describe, expect, it } from 'vitest';
import { departmentForRuntime, departmentSnapshot } from './departments';
import type { RouterService } from './router';

const router = { snapshot: () => ({ baseUrl: 'http://127.0.0.1:20128', checkedAt: 1, health: 'ok', quotaState: 'unknown', models: [] }) } as unknown as RouterService;

describe('department registry', () => {
  it('giữ ánh xạ runtime → phòng ổn định', () => {
    expect(departmentForRuntime('claude', 'planner')).toBe('claude');
    expect(departmentForRuntime('codex', 'worker')).toBe('codex');
    expect(departmentForRuntime('antigravity', 'planner')).toBe('gemini-antigravity');
    expect(departmentForRuntime('opencode', 'worker')).toBe('opencode-9router');
    expect(departmentForRuntime('unknown', 'reviewer')).toBe('review');
  });

  it('trả phòng, trưởng phòng, biểu tượng và số task đang hoạt động', () => {
    const rooms = departmentSnapshot(router, [
      { departmentId: 'claude', status: 'RUNNING' },
      { departmentId: 'claude', status: 'VERIFIED' },
    ]);
    expect(rooms).toHaveLength(7);
    expect(rooms.find((room) => room.id === 'claude')).toMatchObject({ roomId: 'core:claude', headId: 'head:claude', headName: 'Hokage Tsunade (Tam Nin)', headSymbol: '🍃', activeWorkOrders: 1 });
    expect(new Set(rooms.map((room) => room.roomId)).size).toBe(rooms.length);
    expect(new Set(rooms.map((room) => room.headId)).size).toBe(rooms.length);
  });
});
