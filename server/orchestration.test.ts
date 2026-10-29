import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { WorkOrderStore } from './work-orders';
import { WorkOrderOrchestrator } from './orchestration';

const catalog = {
  baseUrl: 'http://127.0.0.1:20128', checkedAt: 1, health: 'ok', quotaState: 'unknown',
  models: [
    { providerId: '9router', modelId: 'ag/gemini-3.8-flash-high', supportsTools: true, costClass: 'unknown', quotaState: 'unknown', health: 'ok' },
    { providerId: '9router', modelId: 'cx/gpt-6.1-sol', supportsTools: true, costClass: 'unknown', quotaState: 'unknown', health: 'ok' },
  ],
};

describe('WorkOrderOrchestrator', () => {
  it('chạy tối đa hai wave tuần tự, reviewer chéo, rồi VERIFIED', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'habblaud-orchestration-'));
    try {
      const store = new WorkOrderStore(join(dir, 'orders.ndjson'), () => 1000);
      const order = store.create({ objective: 'Orchestrate', requestedRuntime: 'opencode', projectPath: dir });
      store.selectRoute(order.id, { providerId: '9router', modelId: 'ag/gemini-3.8-flash-high', role: 'worker', policy: 'balanced-code', costClass: 'unknown', quotaState: 'unknown', health: 'ok', evidenceRefs: ['catalog'], selectedAt: 1000 });
      const router = { refresh: async () => catalog, snapshot: () => catalog } as any;
      const runtime = { runTask: async (_order: unknown, task: { role: string }) => ({ executionId: task.role, status: 'finished', requestedModel: 'unknown', servedModel: 'unknown', outputTail: task.role === 'reviewer' ? 'REVIEW_VERDICT: PASS' : 'worker ok', exitCode: 0, evidenceRefs: [`task:${task.role}`], degraded: 'served-model-unverified' }), cancelTask: () => true } as any;
      const orchestrator = new WorkOrderOrchestrator({ store, router, runtime, now: () => 1000 });
      const result = await orchestrator.start(order.id, { unknownCostOrQuota: true, antigravityAccountSession: true });
      expect(result.status).toBe('VERIFIED');
      expect(result.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'worker', status: 'finished' }), expect.objectContaining({ role: 'reviewer', status: 'finished' })]));
      expect(result.reviews).toEqual([expect.objectContaining({ verdict: 'pass' })]);
      expect(result.evidenceRefs).toEqual(expect.arrayContaining(['task:worker', 'task:reviewer']));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('reconcile task running sau restart thành BLOCKED', () => {
    const dir = mkdtempSync(join(tmpdir(), 'habblaud-orchestration-recovery-'));
    try {
      const file = join(dir, 'orders.ndjson');
      const store = new WorkOrderStore(file, () => 1000);
      const order = store.create({ objective: 'Recovery', requestedRuntime: 'opencode' });
      store.selectRoute(order.id, { providerId: '9router', modelId: 'ag/gemini-3.8-flash-high', role: 'worker', policy: 'balanced-code', costClass: 'unknown', quotaState: 'unknown', health: 'ok', evidenceRefs: ['catalog'], selectedAt: 1000 });
      store.planTasks(order.id, [{ taskId: 'worker-wave-1', wave: 1, role: 'worker', objective: 'Run', permissionMode: 'READ_ONLY', requestedModel: 'ag/gemini-3.8-flash-high', servedModel: 'unknown', status: 'planned', evidenceRefs: [] }, { taskId: 'review-wave-2', wave: 2, role: 'reviewer', objective: 'Review', permissionMode: 'READ_ONLY', requestedModel: 'cx/gpt-6.1-sol', servedModel: 'unknown', status: 'planned', evidenceRefs: [] }]);
      store.updateTask(order.id, 'worker-wave-1', { status: 'running' });
      store.transition(order.id, 'QUEUED'); store.transition(order.id, 'RUNNING');
      const replay = new WorkOrderStore(file, () => 2000); replay.load();
      new WorkOrderOrchestrator({ store: replay, router: { refresh: async () => catalog, snapshot: () => catalog } as any, runtime: {} as any, now: () => 2000 });
      const recovered = replay.get(order.id)?.order;
      expect(recovered?.status).toBe('BLOCKED');
      expect(recovered?.tasks?.find((task) => task.taskId === 'worker-wave-1')).toMatchObject({ status: 'blocked', degraded: 'worker-state-unknown-after-restart' });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
