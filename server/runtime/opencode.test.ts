import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDir } from '../test/fixtures';
import { WorkOrderStore } from '../work-orders';
import { OpenCodeRuntime, openCodeArgs, type RuntimeProcess } from './opencode';

class Stream {
  private listeners: Array<(chunk: string) => void> = [];
  on(_event: 'data', listener: (chunk: string) => void): void { this.listeners.push(listener); }
  emit(chunk: string): void { for (const listener of this.listeners) listener(chunk); }
}

class Child implements RuntimeProcess {
  readonly stdout = new Stream();
  readonly stderr = new Stream();
  private readonly listeners = new Map<string, Array<(...args: any[]) => void>>();
  killed = false;
  kill(): boolean { this.killed = true; this.emit('close', null, 'SIGTERM'); return true; }
  once(event: 'error' | 'close', listener: (...args: any[]) => void): this { const list = this.listeners.get(event) ?? []; list.push(listener); this.listeners.set(event, list); return this; }
  emit(event: string, ...args: any[]): void { for (const listener of this.listeners.get(event) ?? []) listener(...args); }
}

function order(store: WorkOrderStore, root: string): string {
  const created = store.create({ objective: 'Sửa lỗi', projectPath: root, permissionMode: 'READ_ONLY', requestedRuntime: 'opencode' });
  store.selectRoute(created.id, { providerId: '9router', modelId: 'ag/gemini-3.8-flash-high', role: 'worker', policy: 'balanced-code', costClass: 'unknown', quotaState: 'unknown', health: 'ok', evidenceRefs: ['test'], degraded: 'candidate', selectedAt: 1 });
  return created.id;
}

describe('OpenCodeRuntime', () => {
  it.each(['close', 'restart'])('blocks department completion with unknown served identity on %s', (completion) => {
    const tmp = tempDir();
    try {
      const project = join(tmp.dir, 'repo'); mkdirSync(project); execFileSync('git', ['init', '-q', project], { windowsHide: true });
      const file = join(tmp.dir, 'orders.ndjson');
      const store = new WorkOrderStore(file, () => 1_000);
      const created = store.create({ objective: 'Department worker', projectPath: project, requestedRuntime: 'opencode', coordinationMode: 'department', departmentId: 'opencode-9router', servedFamily: 'claude' });
      store.selectRoute(created.id, { providerId: '9router', modelId: 'cc/claude-sonnet-5-5', servedModel: 'claude-sonnet-5-5', role: 'worker', policy: 'balanced-code', costClass: 'subscription', quotaState: 'usable', health: 'ok', evidenceRefs: ['fixture:prior-telemetry'], selectedAt: 1 });
      if (completion === 'close') {
        const child = new Child();
        const runtime = new OpenCodeRuntime({ store, resolveBin: () => 'opencode.exe', spawnImpl: () => child });
        expect(runtime.start(created.id).status).toBe('RUNNING');
        child.emit('close', 0, null);
      } else {
        store.transition(created.id, 'QUEUED');
        store.startExecution(created.id, { executionId: 'fixture-execution', transport: 'opencode-cli', requestedModel: 'cc/claude-sonnet-5-5', servedModel: 'unknown', status: 'running', startedAt: 1, evidenceRefs: ['fixture:runtime'] });
        store.transition(created.id, 'RUNNING');
        store.finishExecution(created.id, 'fixture-execution', { status: 'finished', exitCode: 0 });
      }
      const replay = new WorkOrderStore(file);
      new OpenCodeRuntime({ store: replay, resolveBin: () => undefined });
      expect(replay.get(created.id)?.order).toMatchObject({ status: 'BLOCKED', execution: { status: 'finished', servedModel: 'unknown' } });
    } finally { tmp.cleanup(); }
  });

  it('starts, captures bounded output, finishes and replays the receipt', () => {
    const tmp = tempDir();
    try {
      const project = join(tmp.dir, 'repo'); mkdirSync(project); execFileSync('git', ['init', '-q', project], { windowsHide: true });
      const file = join(tmp.dir, 'orders.ndjson');
      const store = new WorkOrderStore(file, () => 1_000);
      const id = order(store, project);
      const child = new Child();
      let args: string[] = [];
      const runtime = new OpenCodeRuntime({ store, env: { PATH: 'x' }, resolveBin: () => 'opencode.exe', spawnImpl: (_bin, got) => (args = got, child) });
      expect(runtime.startConfirmed(id, { unknownCostOrQuota: true, antigravityAccountSession: true }).status).toBe('RUNNING');
      expect(args).toEqual(['run', '-m', '9router-local/ag/gemini-3.8-flash-high', '--agent', 'plan', '--format', 'json', '--title', 'Sửa lỗi', expect.stringContaining('[Habblaud WorkOrder')]);
      child.stdout.emit('{"type":"text","part":{"type":"text","text":"OK\\nid_token=redacted"}}\n'); child.emit('close', 0, null);
      expect(store.get(id)?.order).toMatchObject({ status: 'READY_FOR_REVIEW', execution: { status: 'finished', exitCode: 0 }, report: 'OK' });
      expect(JSON.stringify(store.get(id))).not.toContain('id_token=redacted');
      const replay = new WorkOrderStore(file, () => 2_000); replay.load();
      expect(replay.get(id)?.order.execution).toMatchObject({ status: 'finished', requestedModel: 'ag/gemini-3.8-flash-high', servedModel: 'unknown' });
    } finally { tmp.cleanup(); }
  });

  it('cancels a running worker and rejects unsafe route/path', async () => {
    const tmp = tempDir();
    try {
      const project = join(tmp.dir, 'repo'); mkdirSync(project); execFileSync('git', ['init', '-q', project], { windowsHide: true });
      const store = new WorkOrderStore(join(tmp.dir, 'orders.ndjson'), () => 1_000);
      const id = order(store, project);
      const child = new Child();
      const runtime = new OpenCodeRuntime({ store, resolveBin: () => 'opencode.exe', spawnImpl: () => child });
      runtime.startConfirmed(id, { unknownCostOrQuota: true, antigravityAccountSession: true }); expect((await runtime.cancel(id)).status).toBe('CANCELLED');
      expect(() => openCodeArgs({ ...store.get(id)!.order, projectPath: 'relative' })).toThrow(/projectPath/);
      expect(() => openCodeArgs({ ...store.get(id)!.order, projectPath: project, routeDecision: { ...store.get(id)!.order.routeDecision!, modelId: 'ag/../bad' } })).toThrow(/route/);
      expect(() => openCodeArgs({ ...store.get(id)!.order, projectPath: project, routeDecision: { ...store.get(id)!.order.routeDecision!, modelId: 'gemini/gemini-4-argon' } })).toThrow(/route/);
    } finally { tmp.cleanup(); }
  });

  it('requires explicit confirmation for workspace-write and adds --auto only after confirmation', async () => {
    const tmp = tempDir();
    try {
      const project = join(tmp.dir, 'repo'); mkdirSync(project); execFileSync('git', ['init', '-q', project], { windowsHide: true });
      const store = new WorkOrderStore(join(tmp.dir, 'orders.ndjson'), () => 1_000);
      const id = store.create({ objective: 'Editar código', projectPath: project, permissionMode: 'WORKSPACE_WRITE', requestedRuntime: 'opencode' }).id;
      store.selectRoute(id, { providerId: '9router', modelId: 'ag/gemini-3.8-flash-high', role: 'worker', policy: 'balanced-code', costClass: 'unknown', quotaState: 'unknown', health: 'ok', evidenceRefs: ['test'], degraded: 'candidate', selectedAt: 1 });
      expect(openCodeArgs(store.get(id)!.order)).toContain('--auto');
      const child = new Child(); let args: string[] = [];
      const runtime = new OpenCodeRuntime({ store, resolveBin: () => 'opencode.exe', spawnImpl: (_bin, got) => (args = got, child) });
      expect(() => runtime.start(id)).toThrow(/chi phí\/quota/);
      expect(() => runtime.startConfirmed(id, { unknownCostOrQuota: true })).toThrow(/Antigravity/);
      expect(() => runtime.startConfirmed(id, { unknownCostOrQuota: true, antigravityAccountSession: true })).toThrow(/WORKSPACE_WRITE/);
      expect(runtime.startConfirmed(id, { unknownCostOrQuota: true, antigravityAccountSession: true, workspaceWrite: true }).status).toBe('RUNNING');
      expect(args).toContain('--auto');
      await runtime.cancel(id);
    } finally { tmp.cleanup(); }
  });

  it('blocks a replayed running worker after restart instead of pretending it is alive', async () => {
    const tmp = tempDir();
    try {
      const project = join(tmp.dir, 'repo'); mkdirSync(project); execFileSync('git', ['init', '-q', project], { windowsHide: true });
      const file = join(tmp.dir, 'orders.ndjson');
      const first = new WorkOrderStore(file, () => 1_000);
      const id = order(first, project);
      first.transition(id, 'QUEUED');
      first.startExecution(id, { executionId: 'exec-1', transport: 'opencode-cli', requestedModel: 'ag/gemini-3.8-flash-high', servedModel: 'unknown', status: 'running', startedAt: 1_000, evidenceRefs: ['test'] });
      first.transition(id, 'RUNNING');
      const replay = new WorkOrderStore(file, () => 2_000);
      const runtime = new OpenCodeRuntime({ store: replay, resolveBin: () => undefined });
      expect(replay.get(id)?.order).toMatchObject({ status: 'BLOCKED', execution: { status: 'failed', degraded: 'worker-state-unknown-after-restart' } });
      await expect(runtime.cancel(id)).rejects.toThrow(/worker/);
    } finally { tmp.cleanup(); }
  });

  it('runs a bounded orchestration task and preserves reviewer marker output', async () => {
    const tmp = tempDir();
    try {
      const project = join(tmp.dir, 'repo'); mkdirSync(project); execFileSync('git', ['init', '-q', project], { windowsHide: true });
      const store = new WorkOrderStore(join(tmp.dir, 'orders.ndjson'), () => 1_000);
      const id = order(store, project);
      const child = new Child();
      const runtime = new OpenCodeRuntime({ store, resolveBin: () => 'opencode.exe', spawnImpl: () => child });
      const task = { taskId: 'review-wave-2', wave: 2 as const, role: 'reviewer' as const, objective: 'Review', permissionMode: 'READ_ONLY' as const, requestedModel: 'cx/gpt-6.1-sol', servedModel: 'unknown', status: 'planned' as const, evidenceRefs: [] };
      const promise = runtime.runTask(store.get(id)!.order, task, { unknownCostOrQuota: true });
      child.stdout.emit('{"type":"text","part":{"type":"text","text":"REVIEW_VERDICT: PASS"}}\n'); child.emit('close', 0, null);
      await expect(promise).resolves.toMatchObject({ status: 'finished', requestedModel: 'cx/gpt-6.1-sol', outputTail: expect.stringContaining('REVIEW_VERDICT: PASS') });
    } finally { tmp.cleanup(); }
  });

  it('reconciles a finished receipt after restart when the final status write was interrupted', () => {
    const tmp = tempDir();
    try {
      const project = join(tmp.dir, 'repo'); mkdirSync(project); execFileSync('git', ['init', '-q', project], { windowsHide: true });
      const file = join(tmp.dir, 'orders.ndjson');
      const first = new WorkOrderStore(file, () => 1_000);
      const id = order(first, project);
      first.transition(id, 'QUEUED');
      first.startExecution(id, { executionId: 'exec-2', transport: 'opencode-cli', requestedModel: 'ag/gemini-3.8-flash-high', servedModel: 'unknown', status: 'running', startedAt: 1_000, evidenceRefs: ['test'] });
      first.transition(id, 'RUNNING');
      first.finishExecution(id, 'exec-2', { status: 'finished', finishedAt: 1_500, exitCode: 0, outputTail: 'результат' });
      const replay = new WorkOrderStore(file, () => 2_000);
      new OpenCodeRuntime({ store: replay, resolveBin: () => undefined });
      expect(replay.get(id)?.order).toMatchObject({ status: 'READY_FOR_REVIEW', report: 'результат', execution: { status: 'finished' } });
    } finally { tmp.cleanup(); }
  });
});
