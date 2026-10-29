import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { WorkOrderError, WorkOrderStore } from './work-orders';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'habblaud-work-orders-'));
  const file = join(dir, 'nested', 'work-orders.ndjson');
  const store = new WorkOrderStore(file, () => 1_700_000_000_000);
  return { dir, file, store };
}

describe('WorkOrderStore', () => {
  it('cria, transiciona e recupera o journal', () => {
    const { dir, file, store } = fixture();
    try {
      const order = store.create({ objective: 'Corrigir o build', permissionMode: 'READ_ONLY', skills: ['dieu-phoi-ai'] });
      expect(order.status).toBe('PLANNED');
      expect(order.departmentId).toBe('opencode-9router');
      expect(order.headId).toBe('head:opencode-9router');
      const routed = store.selectRoute(order.id, { providerId: '9router', modelId: 'ag/gemini-3-flash', role: 'worker', policy: 'balanced-code', costClass: 'unknown', quotaState: 'unknown', health: 'ok', evidenceRefs: ['test:catalog'], degraded: 'cost-or-quota-unknown', selectedAt: 1_700_000_000_000 });
      expect(routed.routeDecision?.modelId).toBe('ag/gemini-3-flash');
      expect(store.transition(order.id, 'QUEUED').status).toBe('QUEUED');
      expect(store.transition(order.id, 'CANCELLED').status).toBe('CANCELLED');
      const restored = new WorkOrderStore(file, () => 1_700_000_000_001);
      restored.load();
      expect(restored.get(order.id)).toMatchObject({ order: { id: order.id, status: 'CANCELLED', revision: 3, routeDecision: { modelId: 'ag/gemini-3-flash' } } });
      expect(restored.get(order.id)?.events).toHaveLength(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('registra a sala e o trưởng phòng como evento replayável', () => {
    const { dir, file, store } = fixture();
    try {
      const order = store.create({ objective: 'Planejar revisão', requestedRuntime: 'claude', role: 'planner' });
      expect(order).toMatchObject({ departmentId: 'claude', headId: 'head:claude' });
      const assigned = store.assignHead(order.id, 'review');
      expect(assigned).toMatchObject({ departmentId: 'review', headId: 'head:review' });
      const restored = new WorkOrderStore(file);
      restored.load();
      expect(restored.get(order.id)?.order).toMatchObject({ departmentId: 'review', headId: 'head:review' });
      expect(restored.get(order.id)?.events.map((event) => event.type)).toEqual(['WORK_CREATED', 'HEAD_ASSIGNED']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('deriva phòng/trưởng phòng cho journal cũ sem esses campos', () => {
    const { dir, file, store } = fixture();
    try {
      const order = store.create({ objective: 'WorkOrder antigo', requestedRuntime: 'claude' });
      const event = JSON.parse(readFileSync(file, 'utf8')) as { payload: { order: Record<string, unknown> } };
      delete event.payload.order.departmentId;
      delete event.payload.order.headId;
      writeFileSync(file, `${JSON.stringify(event)}\n`);
      const restored = new WorkOrderStore(file);
      expect(restored.get(order.id)?.order).toMatchObject({ departmentId: 'claude', headId: 'head:claude' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('replay kế hoạch hai wave, review, evidence và approval stale-safe', () => {
    const { dir, file, store } = fixture();
    try {
      const order = store.create({ objective: 'Orchestrate', requestedRuntime: 'opencode', permissionMode: 'READ_ONLY' });
      store.selectRoute(order.id, { providerId: '9router', modelId: 'ag/gemini-3.8-flash-high', role: 'worker', policy: 'balanced-code', costClass: 'unknown', quotaState: 'unknown', health: 'ok', evidenceRefs: ['catalog'], degraded: 'unknown-cost', selectedAt: 1_700_000_000_000 });
      store.planTasks(order.id, [
        { taskId: 'worker-wave-1', wave: 1, role: 'worker', objective: 'Implementar', permissionMode: 'READ_ONLY', requestedModel: 'ag/gemini-3.8-flash-high', servedModel: 'unknown', status: 'planned', evidenceRefs: [] },
        { taskId: 'review-wave-2', wave: 2, role: 'reviewer', objective: 'Review', permissionMode: 'READ_ONLY', requestedModel: 'cx/gpt-6.1-sol', servedModel: 'unknown', status: 'planned', evidenceRefs: [] },
      ]);
      store.updateTask(order.id, 'worker-wave-1', { status: 'finished', servedModel: 'ag/gemini-3.8-flash-high', outputTail: 'ok', evidenceRefs: ['task:worker'] });
      store.recordReview(order.id, { taskId: 'worker-wave-1', reviewerTaskId: 'review-wave-2', verdict: 'pass', summary: 'REVIEW_VERDICT: PASS', evidenceRefs: ['review'], at: 1_700_000_000_001 });
      store.recordEvidence(order.id, ['task:worker', 'review']);
      store.transition(order.id, 'QUEUED'); store.transition(order.id, 'RUNNING'); store.transition(order.id, 'READY_FOR_REVIEW'); store.transition(order.id, 'VERIFIED');
      const approved = store.requestApproval(order.id, 'commit', ['review']);
      const revision = approved.approvals?.find((item) => item.kind === 'commit')?.requestedRevision;
      expect(revision).toBeTruthy();
      expect(store.decideApproval(order.id, 'commit', 'approved', revision!).approvals).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'commit', status: 'approved' })]));
      const restored = new WorkOrderStore(file); restored.load();
      expect(restored.get(order.id)?.order).toMatchObject({ tasks: [{ taskId: 'worker-wave-1', status: 'finished' }, { taskId: 'review-wave-2', role: 'reviewer' }], reviews: [{ verdict: 'pass' }], evidenceRefs: ['task:worker', 'review'], approvals: [expect.objectContaining({ status: 'approved' })] });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('bloqueia transições inválidas, segredos e payload excessivo', () => {
    const { dir, store } = fixture();
    try {
      expect(() => store.create({ objective: 'use access_token=abc' })).toThrow(WorkOrderError);
      expect(() => store.create({ objective: 'x'.repeat(8001) })).toThrow(/grande demais/);
      const order = store.create({ objective: 'ok' });
      expect(() => store.transition(order.id, 'VERIFIED')).toThrow(/transição inválida/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falha fechado quando o journal tem evento corrompido ou sequência quebrada', () => {
    const { dir, file, store } = fixture();
    try {
      const order = store.create({ objective: 'ok' });
      expect(order.id).toBeTruthy();
      mkdirSync(join(dir, 'nested'), { recursive: true });
      const raw = readFileSync(file, 'utf8').trimEnd();
      rmSync(file, { force: true });
      writeFileSync(file, `${raw}\n{\"sequence\":9}\n`);
      expect(() => new WorkOrderStore(file).load()).toThrow(/journal de WorkOrder inválido/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
