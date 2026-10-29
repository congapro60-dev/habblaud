import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertDepartmentDispatch, modelFamily, type RouteDecision, type WorkOrder, type WorkOrderTask } from '../shared/work-orders';
import { WorkOrderStore } from './work-orders';
import { WorkOrderOrchestrator } from './orchestration';
import { RouterService, type RouterCatalog, type RouterModelInfo } from './router';
import { OpenCodeRuntime, openCodeArgs, type RuntimeTaskReceipt } from './runtime/opencode';
import { tempDir } from './test/fixtures';

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

const workerModel = 'cc/claude-sonnet-5-5';
const reviewerModel = 'ag/claude-opus-5-5';
const decision: RouteDecision = { providerId: '9router', modelId: workerModel, role: 'worker', policy: 'balanced-code', costClass: 'subscription', quotaState: 'usable', health: 'ok', evidenceRefs: ['fixture:catalog'], selectedAt: 1 };

function fixture(overrides: Record<string, unknown> = {}) {
  const tmp = tempDir();
  cleanups.push(() => tmp.cleanup());
  const file = join(tmp.dir, 'orders.ndjson');
  const store = new WorkOrderStore(file, () => 1);
  const order = store.create({ objective: 'Family routing', requestedRuntime: 'opencode', departmentId: 'claude', coordinationMode: 'department', servedFamily: 'claude', ...overrides });
  return { store, order, file };
}

function task(role: 'worker' | 'reviewer', requestedModel = role === 'worker' ? workerModel : reviewerModel): WorkOrderTask {
  return { taskId: role, wave: role === 'worker' ? 1 : 2, role, objective: role, permissionMode: 'READ_ONLY', requestedModel, servedModel: 'unknown', status: 'planned', evidenceRefs: [] };
}

function model(modelId: string, overrides: Partial<RouterModelInfo> = {}): RouterModelInfo {
  return { providerId: '9router', modelId, supportsTools: true, health: 'ok', costClass: 'subscription', quotaState: 'usable', servedModel: modelId, ...overrides };
}

function orchestration(models: RouterModelInfo[]) {
  const f = fixture();
  f.store.selectRoute(f.order.id, decision);
  const catalog: RouterCatalog = { baseUrl: 'http://127.0.0.1:20128', checkedAt: 1, health: 'ok', quotaState: 'usable', models };
  const refresh = vi.fn(async () => catalog);
  const router = { refresh, snapshot: () => catalog } as unknown as RouterService;
  const runTask = vi.fn(async (_order: WorkOrder, t: WorkOrderTask): Promise<RuntimeTaskReceipt> => ({ executionId: t.taskId, status: 'finished', requestedModel: t.requestedModel, servedModel: t.requestedModel, outputTail: t.role === 'reviewer' ? 'REVIEW_VERDICT: PASS' : 'checks passed', exitCode: 0, evidenceRefs: ['fixture:tests'] }));
  const runtime = { runTask } as unknown as OpenCodeRuntime;
  return { ...f, catalog, refresh, runTask, orchestrator: new WorkOrderOrchestrator({ store: f.store, router, runtime, now: () => 1 }) };
}

describe('P1D.1 model family classification', () => {
  it.each([
    ['cc/claude-sonnet-5-5', 'claude'], ['ag/claude-opus-5-5', 'claude'],
    ['9router-local/ag/claude-opus-5-5', 'claude'], ['anthropic/claude-sonnet-4-5', 'claude'],
    ['cx/gpt-6-astra', 'openai'], ['openai/o3-mini', 'openai'], ['ag/gpt-oss-120b', 'openai'],
    ['ag/gemini-3.8-flash-high', 'gemini'], ['gc/gemini-2.5-pro', 'gemini'],
    ['cx/gemini-2.5-pro', 'gemini'], ['cc/unknown', 'unknown'], ['ag/unknown', 'unknown'],
    ['opencode', 'unknown'], ['9router', 'unknown'], ['unknown', 'unknown'], ['', 'unknown'],
  ])('%s is %s regardless of transport', (id, expected) => expect(modelFamily(id)).toBe(expected));

  it('does not turn a requested ID into served telemetry', () => {
    const { order } = fixture();
    for (const observed of [undefined, 'unknown', 'ag/unknown', 'cx/gpt-6-astra']) expect(() => assertDepartmentDispatch(order, workerModel, observed)).toThrow();
    expect(() => assertDepartmentDispatch(order, workerModel, 'claude-sonnet-5-5')).not.toThrow();
  });
});

describe('P1D.1 scope, task restrictions and replay', () => {
  it.each([
    ['claude', 'claude'], ['codex', 'openai'], ['gemini-antigravity', 'gemini'],
    ['opencode-9router', 'claude'], ['opencode-9router', 'openai'], ['opencode-9router', 'gemini'],
  ])('allows %s pinned to %s', (departmentId, servedFamily) => {
    expect(fixture({ departmentId, servedFamily }).order).toMatchObject({ coordinationMode: 'department', departmentId, servedFamily });
  });

  it('rejects missing/unknown pins, mismatched departments and invalid modes before writing', () => {
    const { store, file } = fixture();
    const before = readFileSync(file, 'utf8');
    for (const requestedRuntime of ['opencode', '9router']) {
      for (const servedFamily of [undefined, null, 'unknown', 'opencode', '9router', 1]) {
        expect(() => store.create({ objective: 'bad pin', requestedRuntime, coordinationMode: 'department', servedFamily })).toThrow();
      }
    }
    for (const departmentId of ['director', 'review', 'archive', 'codex', 'gemini-antigravity']) expect(() => store.create({ objective: 'bad scope', coordinationMode: 'department', departmentId, servedFamily: 'claude' })).toThrow();
    for (const coordinationMode of [null, 'auto', 1]) expect(() => store.create({ objective: 'bad mode', coordinationMode })).toThrow();
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('rejects worker/reviewer overrides across families and departments without journal changes', () => {
    const { store, order, file } = fixture();
    store.selectRoute(order.id, decision);
    const before = readFileSync(file, 'utf8');
    for (const role of ['worker', 'reviewer'] as const) {
      for (const patch of [{ requestedModel: 'cx/gpt-6-astra' }, { requestedModel: 'cc/unknown' }, { departmentId: 'review' }, { headId: 'head:codex' }]) {
        const tasks = [task('worker'), task('reviewer')].map((t) => t.role === role ? { ...t, ...patch } as WorkOrderTask : t);
        expect(() => store.planTasks(order.id, tasks)).toThrow();
      }
    }
    expect(() => store.planTasks(order.id, [task('worker'), task('reviewer', workerModel)])).toThrow();
    expect(() => store.planTasks(order.id, [task('worker'), task('reviewer', 'ag/claude-sonnet-5-5')])).toThrow();
    expect(() => store.planTasks(order.id, [task('worker'), { ...task('worker'), taskId: 'second-worker' }])).toThrow();
    expect(() => store.assignHead(order.id, 'opencode-9router')).toThrow();
    expect(() => store.selectRoute(order.id, { ...decision, modelId: 'cx/gpt-6-astra' })).toThrow();
    expect(() => store.selectRoute(order.id, { ...decision, servedModel: 'gemini-3.8-flash-high' })).toThrow();
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('keeps a department reviewer read-only and in its home department on replay', () => {
    const { store, order, file } = fixture();
    store.selectRoute(order.id, decision);
    const planned = store.planTasks(order.id, [task('worker'), { ...task('reviewer'), permissionMode: 'WORKSPACE_WRITE' }]);
    expect(planned.tasks?.[1]).toMatchObject({ departmentId: 'claude', headId: 'head:claude', permissionMode: 'READ_ONLY', servedModel: 'unknown' });
    expect(planned.degraded).toBe('same-family-review');
    expect(new WorkOrderStore(file).get(order.id)?.order).toEqual(planned);
  });

  it('defaults new and old WorkOrders to global without rewriting old journal bytes', () => {
    const { store, order, file } = fixture({ coordinationMode: undefined, servedFamily: undefined });
    expect(order.coordinationMode).toBe('global');
    store.selectRoute(order.id, decision);
    store.planTasks(order.id, [task('worker'), { ...task('reviewer', 'cx/gpt-6-astra'), departmentId: 'review', headId: 'head:review' }]);
    store.assignHead(order.id, 'review');
    const events = readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    delete events[0].payload.order.coordinationMode;
    writeFileSync(file, events.map((event) => JSON.stringify(event)).join('\n') + '\n');
    const before = readFileSync(file, 'utf8');
    const replay = new WorkOrderStore(file).get(order.id)!;
    expect(replay.order).toEqual(store.get(order.id)!.order);
    expect(replay.events).toEqual(events);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it.each(['unknown-pin', 'cross-family-task', 'cross-department-head'])('fails closed replaying %s', (mutation) => {
    const { store, order, file } = fixture();
    store.selectRoute(order.id, decision);
    store.planTasks(order.id, [task('worker'), task('reviewer')]);
    const events = readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    if (mutation === 'unknown-pin') events[0].payload.order.servedFamily = 'unknown';
    if (mutation === 'cross-family-task') events[2].payload.tasks[1].requestedModel = 'cx/gpt-6-astra';
    if (mutation === 'cross-department-head') events[2].payload.tasks[1].headId = 'head:review';
    writeFileSync(file, events.map((event) => JSON.stringify(event)).join('\n') + '\n');
    expect(() => new WorkOrderStore(file).load()).toThrow();
  });
});

describe('P1D.1 routing and execution gates (synthetic evidence only)', () => {
  it('filters selection to the pin and ignores catalog family/served identity claims', async () => {
    const { order } = fixture();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [
      { id: 'cx/gpt-6-astra', supportsTools: true, owned_by: 'claude' },
      { id: reviewerModel, supportsTools: true, owned_by: 'gemini', servedModel: reviewerModel, servedFamily: 'claude' },
    ] })));
    const router = new RouterService({}, fetchMock);
    expect(await router.select(undefined, 'balanced-code', 'worker', order)).toMatchObject({ modelId: reviewerModel, servedModel: 'unknown' });
    await expect(router.select('cx/gpt-6-astra', 'balanced-code', 'worker', order)).rejects.toThrow();
    await expect(router.select(undefined, 'balanced-code', 'worker', { ...order, servedFamily: 'unknown' })).rejects.toThrow();
    await expect(router.select(undefined, 'balanced-code', 'worker', { ...order, departmentId: 'opencode-9router', headId: 'head:opencode-9router', servedFamily: 'gemini' })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('chooses a distinct same-family reviewer despite different transport prefixes', async () => {
    const f = orchestration([model(workerModel), model('cx/gpt-6-astra'), model(reviewerModel)]);
    const result = await f.orchestrator.start(f.order.id, { antigravityAccountSession: true });
    expect(result).toMatchObject({ status: 'VERIFIED', degraded: 'same-family-review' });
    expect(result.tasks?.map((t) => [t.requestedModel, t.departmentId])).toEqual([[workerModel, 'claude'], [reviewerModel, 'claude']]);
    expect(result.reviews?.[0].verdict).toBe('pass');
    expect(f.runTask).toHaveBeenCalledTimes(2);
  });

  it('uses one worker when only another family is available for review; director verification requires test evidence', async () => {
    const f = orchestration([model(workerModel), model('cx/gpt-6-astra')]);
    const result = await f.orchestrator.start(f.order.id);
    expect(result).toMatchObject({ status: 'READY_FOR_REVIEW', degraded: 'single-model-review' });
    expect(result.tasks).toHaveLength(1);
    expect(result.reviews).toBeUndefined();
    expect(() => f.store.transition(f.order.id, 'VERIFIED')).toThrow(/single-model-review/);
    expect(() => f.store.transition(f.order.id, 'VERIFIED', undefined, { mode: 'director-after-tests', evidenceRefs: [] })).toThrow();
    const verified = f.store.transition(f.order.id, 'VERIFIED', undefined, { mode: 'director-after-tests', evidenceRefs: ['fixture:director-reviewed-tests'] });
    expect(verified).toMatchObject({ status: 'VERIFIED', verificationMode: 'director-after-tests', degraded: 'single-model-review' });
    expect(new WorkOrderStore(f.file).get(f.order.id)?.order).toEqual(verified);
  });

  it('blocks unknown served-family telemetry before calling any runtime', async () => {
    const f = orchestration([model(workerModel, { servedModel: undefined })]);
    await expect(f.orchestrator.start(f.order.id)).rejects.toThrow(/telemetria/);
    expect(f.runTask).not.toHaveBeenCalled();
  });

  it.each([
    model('ag/claude-sonnet-5-5'), model(reviewerModel, { servedModel: undefined }),
    model(reviewerModel, { health: 'unavailable' }), model(reviewerModel, { quotaState: 'exhausted' }),
  ])('does not use an alias or unverified/unavailable reviewer: %j', async (candidate) => {
    const f = orchestration([model(workerModel), candidate, model('cx/gpt-6-astra')]);
    const result = await f.orchestrator.start(f.order.id);
    expect(result).toMatchObject({ status: 'READY_FOR_REVIEW', degraded: 'single-model-review' });
    expect(f.runTask).toHaveBeenCalledTimes(1);
  });

  it('does not verify a reviewer served by the same model as the worker', async () => {
    const f = orchestration([model(workerModel), model(reviewerModel)]);
    f.runTask.mockImplementation(async (_order, t) => ({ executionId: t.taskId, status: 'finished', requestedModel: t.requestedModel, servedModel: workerModel, outputTail: 'REVIEW_VERDICT: PASS', exitCode: 0, evidenceRefs: ['fixture:receipt'] }));
    expect((await f.orchestrator.start(f.order.id, { antigravityAccountSession: true })).status).toBe('BLOCKED');
    expect(new WorkOrderStore(f.file).get(f.order.id)?.order.status).toBe('BLOCKED');
  });

  it.each(['unknown', 'cx/gpt-6-astra'])('blocks a %s receipt before dispatching the reviewer', async (servedModel) => {
    const f = orchestration([model(workerModel), model(reviewerModel)]);
    f.runTask.mockResolvedValueOnce({ executionId: 'worker', status: 'finished', requestedModel: workerModel, servedModel, outputTail: 'output', exitCode: 0, evidenceRefs: ['fixture:receipt'] });
    const result = await f.orchestrator.start(f.order.id, { antigravityAccountSession: true });
    expect(result.status).toBe('BLOCKED');
    expect(result.tasks?.[0].servedModel).toBe(servedModel);
    expect(result.tasks?.[1].status).toBe('planned');
    expect(f.runTask).toHaveBeenCalledTimes(1);
  });

  it('blocks route telemetry drift before the next task, without fallback', async () => {
    const f = orchestration([model(workerModel), model(reviewerModel)]);
    f.refresh.mockResolvedValueOnce(f.catalog).mockResolvedValueOnce(f.catalog).mockResolvedValueOnce({ ...f.catalog, models: [model(workerModel), model(reviewerModel, { servedModel: 'gemini-3.8-flash-high' })] });
    expect((await f.orchestrator.start(f.order.id, { antigravityAccountSession: true })).status).toBe('BLOCKED');
    expect(f.runTask).toHaveBeenCalledTimes(1);
  });

  it('guards OpenCode direct execution and model overrides before filesystem/process access', () => {
    const { order } = fixture();
    const routed = { ...order, routeDecision: decision };
    expect(() => openCodeArgs(routed)).toThrow(/telemetria/);
    expect(() => openCodeArgs({ ...routed, servedFamily: undefined })).toThrow(/servedFamily/);
    expect(() => openCodeArgs(routed, { requestedModel: 'cx/gpt-6-astra', routeServedModel: 'cx/gpt-6-astra' })).toThrow();
    expect(() => openCodeArgs(routed, { requestedModel: reviewerModel })).toThrow(/telemetria/);
  });
});
