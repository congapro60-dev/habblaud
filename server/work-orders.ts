// Control Core của phòng giám đốc: journal append-only, replay sau restart,
// transition fail-closed. Runtime adapter cập nhật WorkOrder qua receipt có kiểm chứng.
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  canTransitionWorkOrder,
  assertCoordinationScope,
  assertDepartmentModel,
  assertDepartmentDispatch,
  modelName,
  WORK_ORDER_STATUSES,
  type WorkOrder,
  type WorkOrderEvent,
  type WorkOrderPermission,
  type WorkOrderRuntime,
  type WorkOrderRole,
  type RoutePolicy,
  type WorkOrderSnapshot,
  type WorkOrderStatus,
  type RouteDecision,
  type WorkOrderApproval,
  type WorkOrderApprovalKind,
  type WorkOrderReview,
  type WorkOrderTask,
  type CoordinationMode,
  type ModelFamily,
} from '../shared/work-orders';
import { DEPARTMENT_IDS, type DepartmentId } from '../shared/departments';
import { departmentForRuntime, headIdFor } from './departments';
import { tr } from '../shared/i18n';

const MAX_LINE_BYTES = 64 * 1024;
const MAX_ORDERS = 200;
const MAX_EVENTS = 4000;
const SECRET_MARKER = /(?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|password|authorization|cookie|sk-[A-Za-z0-9_-]{12,})/i;
const PATH_MAX = 1024;

export class WorkOrderError extends Error {
  constructor(readonly code: 'invalid' | 'not-found' | 'conflict' | 'unavailable', message: string) {
    super(message);
  }
}

export interface CreateWorkOrderInput {
  objective: string;
  coordinationMode?: CoordinationMode;
  servedFamily?: ModelFamily;
  projectPath?: string;
  permissionMode?: WorkOrderPermission;
  requestedRuntime?: WorkOrderRuntime;
  requestedModel?: string;
  skills?: string[];
  acceptanceCriteria?: string[];
  departmentId?: DepartmentId;
  role?: WorkOrderRole;
  routePolicy?: RoutePolicy;
  conversationId?: string;
}

function boundedString(value: unknown, name: string, max: number, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new WorkOrderError('invalid', `${name} é obrigatório`);
    return undefined;
  }
  if (typeof value !== 'string') throw new WorkOrderError('invalid', `${name} inválido`);
  const text = value.trim();
  if (required && !text) throw new WorkOrderError('invalid', `${name} é obrigatório`);
  if (text.length > max) throw new WorkOrderError('invalid', `${name} grande demais`);
  if (text.includes('\0') || SECRET_MARKER.test(text)) throw new WorkOrderError('invalid', `${name} contém dado proibido`);
  return text || undefined;
}

function list(value: unknown, name: string, maxItems: number, maxItem: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new WorkOrderError('invalid', `${name} inválido`);
  return value.map((item) => boundedString(item, name, maxItem, true)!).filter(Boolean);
}

function parseCreate(raw: unknown): CreateWorkOrderInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new WorkOrderError('invalid', 'WorkOrder inválido');
  const body = raw as Record<string, unknown>;
  const projectPath = boundedString(body.projectPath, 'projectPath', PATH_MAX);
  if (projectPath && /[\r\n]/.test(projectPath)) throw new WorkOrderError('invalid', 'projectPath inválido');
  const permissionMode: WorkOrderPermission = body.permissionMode === undefined ? 'READ_ONLY' : body.permissionMode as WorkOrderPermission;
  if (permissionMode !== 'READ_ONLY' && permissionMode !== 'WORKSPACE_WRITE') throw new WorkOrderError('invalid', 'permissionMode inválido');
  const runtimes: WorkOrderRuntime[] = ['codex', 'claude', 'opencode', '9router', 'antigravity', 'unknown'];
  const requestedRuntime: WorkOrderRuntime = body.requestedRuntime === undefined ? 'unknown' : body.requestedRuntime as WorkOrderRuntime;
  if (!runtimes.includes(requestedRuntime as WorkOrderRuntime)) throw new WorkOrderError('invalid', 'requestedRuntime inválido');
  const roles: WorkOrderRole[] = ['planner', 'worker', 'reviewer', 'director'];
  const role: WorkOrderRole = body.role === undefined ? 'worker' : body.role as WorkOrderRole;
  if (!roles.includes(role)) throw new WorkOrderError('invalid', 'role inválido');
  const policies: RoutePolicy[] = ['free-fast', 'balanced-code', 'deep-code', 'review-code'];
  const routePolicy: RoutePolicy = body.routePolicy === undefined ? 'balanced-code' : body.routePolicy as RoutePolicy;
  if (!policies.includes(routePolicy)) throw new WorkOrderError('invalid', 'routePolicy inválida');
  const departmentId = body.departmentId === undefined ? undefined : body.departmentId as DepartmentId;
  if (departmentId !== undefined && !DEPARTMENT_IDS.includes(departmentId)) throw new WorkOrderError('invalid', 'departmentId inválido');
  return {
    objective: boundedString(body.objective, 'objective', 8000, true)!,
    coordinationMode: body.coordinationMode === undefined ? 'global' : body.coordinationMode as CoordinationMode,
    ...(body.servedFamily !== undefined ? { servedFamily: body.servedFamily as ModelFamily } : {}),
    projectPath,
    permissionMode,
    requestedRuntime,
    requestedModel: boundedString(body.requestedModel, 'requestedModel', 200),
    departmentId,
    role,
    routePolicy,
    conversationId: boundedString(body.conversationId, 'conversationId', 100),
    skills: list(body.skills, 'skills', 24, 120),
    acceptanceCriteria: list(body.acceptanceCriteria, 'acceptanceCriteria', 24, 500),
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function validateDepartmentTasks(order: WorkOrder, tasks: readonly WorkOrderTask[]): void {
  if (order.coordinationMode !== 'department') return;
  const workers = tasks.filter((task) => task.role === 'worker');
  const reviewers = tasks.filter((task) => task.role === 'reviewer');
  if (!workers.length) throw new WorkOrderError('invalid', tr('O departamento exige um worker'));
  for (const task of tasks) {
    assertDepartmentModel(order, task.requestedModel);
    if (task.departmentId !== order.departmentId || task.headId !== order.headId) throw new WorkOrderError('invalid', tr('A tarefa não pode sair do departamento'));
    if (task.role === 'reviewer' && (task.permissionMode !== 'READ_ONLY' || workers.some((worker) => modelName(worker.requestedModel) === modelName(task.requestedModel)))) throw new WorkOrderError('invalid', tr('Reviewer exige outro modelo da mesma família e READ_ONLY'));
  }
  if (!reviewers.length && (tasks.length !== 1 || workers[0]?.wave !== 1)) throw new WorkOrderError('invalid', tr('Sem reviewer distinto, o departamento permite apenas um worker'));
}

function validateDepartmentVerification(order: WorkOrder, mode?: unknown, evidenceRefs?: unknown): void {
  if (order.coordinationMode !== 'department') return;
  if (!order.tasks?.length || order.tasks.some((task) => task.status !== 'finished')) throw new WorkOrderError('conflict', tr('Verificação exige tarefas concluídas'));
  for (const task of order.tasks) assertDepartmentDispatch(order, task.requestedModel, task.servedModel);
  const reviewers = order.tasks.filter((task) => task.role === 'reviewer');
  if (reviewers.length) {
    if (reviewers.some((reviewer) => order.tasks!.some((worker) => worker.role === 'worker' && modelName(worker.servedModel) === modelName(reviewer.servedModel)))) throw new WorkOrderError('conflict', tr('Reviewer foi servido pelo mesmo modelo do worker'));
    if (reviewers.some((task) => !order.reviews?.some((review) => review.reviewerTaskId === task.taskId && review.verdict === 'pass'))) throw new WorkOrderError('conflict', tr('Verificação exige aprovação do reviewer'));
  } else if (mode !== 'director-after-tests' || !list(evidenceRefs, 'test evidenceRefs', 32, 240).length) {
    throw new WorkOrderError('conflict', tr('single-model-review exige verificação explícita do diretor e evidências de testes'));
  }
}

export class WorkOrderStore {
  private readonly orders = new Map<string, WorkOrder>();
  private readonly events: WorkOrderEvent[] = [];
  private nextSequence = 1;
  private loaded = false;
  private loadError: string | undefined;

  constructor(
    private readonly file: string,
    private readonly now: () => number = Date.now,
  ) {}

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!existsSync(this.file)) return;
    try {
      for (const line of readFileSync(this.file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        if (Buffer.byteLength(line) > MAX_LINE_BYTES) throw new Error('journal line too large');
        const event = JSON.parse(line) as WorkOrderEvent;
        this.applyEvent(event, true);
      }
      // Compatibility projection for WorkOrders created before phòng/trưởng phòng existed.
      // New assignments still emit HEAD_ASSIGNED; old records stay byte-safe and gain deterministic UI metadata.
      for (const order of this.orders.values()) this.normalizeAssignment(order);
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : String(error);
      this.orders.clear();
      this.events.length = 0;
      throw new WorkOrderError('unavailable', `journal de WorkOrder inválido: ${this.loadError}`);
    }
  }

  list(): WorkOrder[] {
    this.ensureReady();
    return [...this.orders.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(clone);
  }

  get(id: string): { order: WorkOrder; events: WorkOrderEvent[] } | undefined {
    this.ensureReady();
    const order = this.orders.get(id);
    return order ? { order: clone(order), events: this.events.filter((event) => event.workOrderId === id).map(clone) } : undefined;
  }

  eventsSince(sequence = 0): WorkOrderEvent[] {
    this.ensureReady();
    if (!Number.isInteger(sequence) || sequence < 0) throw new WorkOrderError('invalid', 'cursor inválido');
    return this.events.filter((event) => event.sequence > sequence).map(clone);
  }

  private normalizeAssignment(order: WorkOrder): void {
    const department = order.departmentId && DEPARTMENT_IDS.includes(order.departmentId) ? order.departmentId : departmentForRuntime(order.requestedRuntime ?? 'unknown', order.role ?? 'worker');
    order.departmentId = department;
    order.headId ??= headIdFor(department);
  }

  create(raw: unknown): WorkOrder {
    this.ensureReady();
    if (this.orders.size >= MAX_ORDERS) throw new WorkOrderError('conflict', 'limite de WorkOrders atingido');
    const input = parseCreate(raw);
    const now = this.now();
    const order: WorkOrder = {
      id: randomUUID(),
      coordinationMode: input.coordinationMode!,
      ...(input.servedFamily !== undefined ? { servedFamily: input.servedFamily } : {}),
      objective: input.objective,
      ...(input.projectPath ? { projectPath: input.projectPath } : {}),
      permissionMode: input.permissionMode ?? 'READ_ONLY',
      requestedRuntime: input.requestedRuntime ?? 'unknown',
      ...(input.requestedModel ? { requestedModel: input.requestedModel } : {}),
      departmentId: input.departmentId ?? departmentForRuntime(input.requestedRuntime ?? 'unknown', input.role ?? 'worker'),
      headId: undefined,
      role: input.role ?? 'worker',
      routePolicy: input.routePolicy ?? 'balanced-code',
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      skills: input.skills ?? [],
      acceptanceCriteria: input.acceptanceCriteria ?? [],
      status: 'PLANNED',
      createdAt: now,
      updatedAt: now,
      revision: 0,
    };
    order.headId = headIdFor(order.departmentId!);
    assertCoordinationScope(order);
    if (order.requestedModel) assertDepartmentModel(order, order.requestedModel);
    this.append({ type: 'WORK_CREATED', workOrderId: order.id, payload: { order }, at: now });
    return clone(order);
  }

  transition(id: string, status: WorkOrderStatus, reason?: string, verification?: { mode: 'director-after-tests'; evidenceRefs: readonly string[] }): WorkOrder {
    this.ensureReady();
    if (!WORK_ORDER_STATUSES.includes(status)) throw new WorkOrderError('invalid', 'status inválido');
    const current = this.orders.get(id);
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (!canTransitionWorkOrder(current.status, status)) throw new WorkOrderError('conflict', `transição inválida: ${current.status} → ${status}`);
    if (verification && (status !== 'VERIFIED' || current.coordinationMode !== 'department' || current.degraded !== 'single-model-review')) throw new WorkOrderError('invalid', tr('Verificação do diretor exige single-model-review'));
    if (status === 'VERIFIED') validateDepartmentVerification(current, verification?.mode, verification?.evidenceRefs);
    const verified = verification ? { verificationMode: verification.mode, evidenceRefs: list(verification.evidenceRefs, 'test evidenceRefs', 32, 240) } : {};
    const now = this.now();
    const type = status === 'BLOCKED' ? 'WORK_BLOCKED' : status === 'CANCELLED' ? 'WORK_CANCELLED' : 'WORK_STATUS_CHANGED';
    this.append({ type, workOrderId: id, payload: { status, ...verified, ...(reason ? { reason: boundedString(reason, 'reason', 2000) } : {}) }, at: now });
    return clone(this.orders.get(id)!);
  }

  report(id: string, report: string): WorkOrder {
    this.ensureReady();
    if (!this.orders.has(id)) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    const value = boundedString(report, 'report', 8000, true)!;
    this.append({ type: 'WORK_REPORT', workOrderId: id, payload: { report: value }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  selectRoute(id: string, decision: RouteDecision): WorkOrder {
    this.ensureReady();
    const current = this.orders.get(id);
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (current.status !== 'PLANNED') throw new WorkOrderError('conflict', 'route só pode ser escolhida no estado planejado');
    if (!decision.modelId || !decision.providerId || SECRET_MARKER.test(JSON.stringify(decision))) throw new WorkOrderError('invalid', 'decisão de route inválida');
    assertDepartmentModel(current, decision.modelId);
    if (decision.servedModel && decision.servedModel !== 'unknown') assertDepartmentModel(current, decision.servedModel);
    this.append({ type: 'ROUTE_SELECTED', workOrderId: id, payload: { decision }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  assignHead(id: string, departmentId: DepartmentId): WorkOrder {
    this.ensureReady();
    const current = this.orders.get(id);
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (current.status !== 'PLANNED') throw new WorkOrderError('conflict', 'trưởng phòng chỉ được gán khi WorkOrder còn kế hoạch');
    if (!DEPARTMENT_IDS.includes(departmentId)) throw new WorkOrderError('invalid', 'departmentId inválido');
    if (current.coordinationMode === 'department' && departmentId !== current.departmentId) throw new WorkOrderError('conflict', tr('O departamento fixado não pode mudar'));
    this.append({ type: 'HEAD_ASSIGNED', workOrderId: id, payload: { departmentId, headId: headIdFor(departmentId) }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  planTasks(id: string, tasks: readonly WorkOrderTask[]): WorkOrder {
    this.ensureReady();
    const current = this.orders.get(id);
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (current.status !== 'PLANNED' || !current.routeDecision) throw new WorkOrderError('conflict', 'plano só pode ser criado após selecionar route');
    if (current.tasks?.length) throw new WorkOrderError('conflict', 'WorkOrder já tem plano de execução');
    if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 8) throw new WorkOrderError('invalid', 'plano deve ter de 1 a 8 tarefas');
    const ids = new Set<string>();
    const planned = tasks.map((task) => {
      if (!task || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(task.taskId) || ids.has(task.taskId)) throw new WorkOrderError('invalid', 'taskId inválido ou duplicado');
      ids.add(task.taskId);
      if (task.wave !== 1 && task.wave !== 2) throw new WorkOrderError('invalid', 'wave inválida');
      if (task.role !== 'worker' && task.role !== 'reviewer') throw new WorkOrderError('invalid', 'role de task inválido');
      const permissionMode = task.role === 'reviewer' ? 'READ_ONLY' : task.permissionMode ?? current.permissionMode;
      if (permissionMode !== 'READ_ONLY' && permissionMode !== 'WORKSPACE_WRITE') throw new WorkOrderError('invalid', 'permissionMode de task inválido');
      const objective = boundedString(task.objective, 'task objective', 4000, true)!;
      const requestedModel = boundedString(task.requestedModel, 'task requestedModel', 200, true)!;
      const evidenceRefs = list(task.evidenceRefs, 'task evidenceRefs', 16, 240);
      const scope = current.coordinationMode === 'department' ? { departmentId: task.departmentId ?? current.departmentId, headId: task.headId ?? current.headId } : {};
      return { taskId: task.taskId, wave: task.wave, role: task.role, ...(task.departmentId ? { departmentId: task.departmentId } : {}), ...(task.headId ? { headId: task.headId } : {}), ...scope, objective, permissionMode, requestedModel, servedModel: 'unknown', status: 'planned', evidenceRefs } satisfies WorkOrderTask;
    });
    validateDepartmentTasks(current, planned);
    if (current.coordinationMode !== 'department' && !planned.some((task) => task.role === 'reviewer')) throw new WorkOrderError('invalid', 'plan cần reviewer độc lập');
    if (!planned.some((task) => task.wave === 1 && task.role === 'worker')) throw new WorkOrderError('invalid', 'plan cần worker wave 1');
    this.append({ type: 'TASKS_PLANNED', workOrderId: id, payload: { tasks: planned }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  updateTask(id: string, taskId: string, patch: Partial<WorkOrderTask>): WorkOrder {
    this.ensureReady();
    const current = this.orders.get(id);
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (!current.tasks?.some((task) => task.taskId === taskId)) throw new WorkOrderError('not-found', 'task không tồn tại');
    const next: Record<string, unknown> = {};
    if (patch.status !== undefined) {
      if (!['planned', 'queued', 'running', 'finished', 'failed', 'blocked', 'cancelled'].includes(patch.status)) throw new WorkOrderError('invalid', 'trạng thái task inválido');
      next.status = patch.status;
    }
    if (patch.executionId !== undefined) next.executionId = boundedString(patch.executionId, 'executionId', 120);
    if (patch.servedModel !== undefined) next.servedModel = boundedString(patch.servedModel, 'servedModel', 200, true);
    if (patch.outputTail !== undefined) next.outputTail = boundedString(patch.outputTail, 'task outputTail', 8192);
    if (patch.degraded !== undefined) next.degraded = boundedString(patch.degraded, 'task degraded', 240);
    if (patch.startedAt !== undefined) next.startedAt = Number.isFinite(patch.startedAt) ? patch.startedAt : undefined;
    if (patch.finishedAt !== undefined) next.finishedAt = Number.isFinite(patch.finishedAt) ? patch.finishedAt : undefined;
    if (patch.evidenceRefs !== undefined) next.evidenceRefs = list(patch.evidenceRefs, 'task evidenceRefs', 16, 240);
    this.append({ type: 'TASK_UPDATED', workOrderId: id, payload: { taskId, patch: next }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  recordReview(id: string, review: WorkOrderReview): WorkOrder {
    this.ensureReady();
    const current = this.orders.get(id);
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (!current.tasks?.some((task) => task.taskId === review.taskId) || !current.tasks.some((task) => task.taskId === review.reviewerTaskId && task.role === 'reviewer')) throw new WorkOrderError('invalid', 'reviewer/task không thuộc WorkOrder');
    const summary = boundedString(review.summary, 'review summary', 4000, true)!;
    if (!['pass', 'changes_requested', 'blocked'].includes(review.verdict)) throw new WorkOrderError('invalid', 'review verdict inválido');
    this.append({ type: 'REVIEW_RECORDED', workOrderId: id, payload: { review: { taskId: review.taskId, reviewerTaskId: review.reviewerTaskId, verdict: review.verdict, summary, evidenceRefs: list(review.evidenceRefs, 'review evidenceRefs', 16, 240), at: review.at } }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  recordEvidence(id: string, refs: readonly string[]): WorkOrder {
    this.ensureReady();
    if (!this.orders.has(id)) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    const evidenceRefs = list(refs, 'evidenceRefs', 32, 240);
    this.append({ type: 'EVIDENCE_RECORDED', workOrderId: id, payload: { evidenceRefs }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  requestApproval(id: string, kind: WorkOrderApprovalKind, evidenceRefs: readonly string[]): WorkOrder {
    this.ensureReady();
    const current = this.orders.get(id);
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (current.status !== 'VERIFIED') throw new WorkOrderError('conflict', 'approval só pode ser pedido após VERIFIED');
    if (kind !== 'commit' && kind !== 'deploy') throw new WorkOrderError('invalid', 'approval kind inválido');
    if (current.approvals?.some((approval) => approval.kind === kind && approval.status === 'pending')) throw new WorkOrderError('conflict', 'approval já está pendente');
    const approval: WorkOrderApproval = { kind, status: 'pending', requestedRevision: current.revision + 1, evidenceRefs: list(evidenceRefs, 'approval evidenceRefs', 32, 240), requestedAt: this.now() };
    this.append({ type: 'APPROVAL_REQUESTED', workOrderId: id, payload: { approval }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  decideApproval(id: string, kind: WorkOrderApprovalKind, status: 'approved' | 'rejected', requestedRevision: number, reason?: string): WorkOrder {
    this.ensureReady();
    const current = this.orders.get(id);
    const approval = current?.approvals?.find((item) => item.kind === kind && item.status === 'pending');
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (!approval || approval.requestedRevision !== requestedRevision || current.revision !== requestedRevision) throw new WorkOrderError('conflict', 'approval stale ou não pendente');
    this.append({ type: 'APPROVAL_DECIDED', workOrderId: id, payload: { kind, status, requestedRevision, reason: reason ? boundedString(reason, 'reason', 1000) : undefined, decidedAt: this.now() }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  startExecution(id: string, execution: WorkOrder['execution']): WorkOrder {
    this.ensureReady();
    const current = this.orders.get(id);
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (current.status !== 'QUEUED') throw new WorkOrderError('conflict', 'worker só inicia na fila');
    if (!execution || !execution.executionId || execution.transport !== 'opencode-cli') throw new WorkOrderError('invalid', 'receipt de execução inválido');
    if (current.execution || !current.routeDecision || current.routeDecision.modelId !== execution.requestedModel) throw new WorkOrderError('conflict', 'WorkOrder já tem worker ou route divergente');
    this.append({ type: 'WORKER_STARTED', workOrderId: id, payload: { execution }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  finishExecution(id: string, executionId: string, update: Partial<NonNullable<WorkOrder['execution']>>): WorkOrder {
    this.ensureReady();
    const current = this.orders.get(id);
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (!current.execution || current.execution.executionId !== executionId) throw new WorkOrderError('conflict', 'receipt de execução desconhecido');
    if (current.status !== 'RUNNING' && current.status !== 'QUEUED') throw new WorkOrderError('conflict', 'worker não está rodando');
    if (!['finished', 'failed', 'cancelled'].includes(update.status ?? '')) throw new WorkOrderError('invalid', 'estado final de execução inválido');
    const execution = {
      ...current.execution,
      status: update.status!,
      finishedAt: update.finishedAt ?? this.now(),
      ...(update.exitCode !== undefined ? { exitCode: update.exitCode } : {}),
      ...(update.outputTail !== undefined ? { outputTail: boundedString(update.outputTail, 'outputTail', 8192) } : {}),
      ...(update.degraded ? { degraded: boundedString(update.degraded, 'degraded', 200) } : {}),
    };
    if (execution.outputTail && SECRET_MARKER.test(execution.outputTail)) throw new WorkOrderError('invalid', 'output contém dado proibido');
    this.append({ type: execution.status === 'cancelled' ? 'WORKER_CANCELLED' : 'WORKER_FINISHED', workOrderId: id, payload: { execution }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  linkConversation(id: string, conversationId: string): WorkOrder {
    this.ensureReady();
    if (!this.orders.has(id)) throw new WorkOrderError('not-found', 'WorkOrder não encontrado');
    if (!/^[a-f0-9-]{20,}$/i.test(conversationId)) throw new WorkOrderError('invalid', 'conversationId inválido');
    this.append({ type: 'CONVERSATION_LINKED', workOrderId: id, payload: { conversationId }, at: this.now() });
    return clone(this.orders.get(id)!);
  }

  private ensureReady(): void {
    this.load();
    if (this.loadError) throw new WorkOrderError('unavailable', `journal indisponível: ${this.loadError}`);
  }

  private append(input: Omit<WorkOrderEvent, 'sequence'>): void {
    const event: WorkOrderEvent = { sequence: this.nextSequence, ...input };
    const line = `${JSON.stringify(event)}\n`;
    if (Buffer.byteLength(line) > MAX_LINE_BYTES) throw new WorkOrderError('invalid', 'evento grande demais');
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      appendFileSync(this.file, line, { encoding: 'utf8', mode: 0o600, flag: 'a' });
      if (process.platform !== 'win32') chmodSync(this.file, 0o600);
    } catch (error) {
      throw new WorkOrderError('unavailable', `não foi possível gravar o WorkOrder: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.applyEvent(event, false);
  }

  private applyEvent(event: WorkOrderEvent, replay: boolean): void {
    if (!event || typeof event !== 'object' || !Number.isInteger(event.sequence) || event.sequence !== this.nextSequence || typeof event.workOrderId !== 'string' || !event.type || !Number.isFinite(event.at)) {
      throw new Error('evento de WorkOrder inválido');
    }
    if (this.events.length >= MAX_EVENTS) throw new Error('journal de WorkOrder grande demais');
    const payload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) ? event.payload : {};
    if (SECRET_MARKER.test(JSON.stringify(payload))) throw new Error('evento contém dado proibido');
    const current = this.orders.get(event.workOrderId);
    if (event.type === 'WORK_CREATED') {
      if (current || !payload.order || typeof payload.order !== 'object') throw new Error('WorkOrder duplicado');
      const order = clone(payload.order as WorkOrder);
      if (order.coordinationMode === undefined) order.coordinationMode = 'global';
      this.orders.set(event.workOrderId, order);
    } else if (!current) {
      throw new Error('evento sem WorkOrder');
    } else if (event.type === 'WORK_STATUS_CHANGED' || event.type === 'WORK_BLOCKED' || event.type === 'WORK_CANCELLED') {
      const status = payload.status;
      if (typeof status !== 'string' || !canTransitionWorkOrder(current.status, status as WorkOrderStatus)) throw new Error('transição inválida no journal');
      if (status === 'VERIFIED') validateDepartmentVerification(current, payload.verificationMode, payload.evidenceRefs);
      current.status = status as WorkOrderStatus;
      if (status === 'VERIFIED' && payload.verificationMode === 'director-after-tests') {
        current.verificationMode = 'director-after-tests';
        current.evidenceRefs = [...new Set([...(current.evidenceRefs ?? []), ...list(payload.evidenceRefs, 'test evidenceRefs', 32, 240)])].slice(-64);
      }
      if (typeof payload.reason === 'string') current.blocker = payload.reason;
      current.revision++;
      current.updatedAt = event.at;
    } else if (event.type === 'WORK_REPORT') {
      if (typeof payload.report !== 'string') throw new Error('relatório inválido');
      current.report = payload.report;
      current.updatedAt = event.at;
      current.revision++;
    } else if (event.type === 'ROUTE_SELECTED') {
      if (!payload.decision || typeof payload.decision !== 'object') throw new Error('route decision inválida');
      current.routeDecision = clone(payload.decision as RouteDecision);
      current.updatedAt = event.at;
      current.revision++;
    } else if (event.type === 'HEAD_ASSIGNED') {
      if (typeof payload.departmentId !== 'string' || !DEPARTMENT_IDS.includes(payload.departmentId as DepartmentId) || typeof payload.headId !== 'string') throw new Error('gán trưởng phòng không hợp lệ');
      if (current.coordinationMode === 'department' && (payload.departmentId !== current.departmentId || payload.headId !== current.headId)) throw new Error('department assignment changed');
      current.departmentId = payload.departmentId as DepartmentId;
      current.headId = payload.headId;
      current.updatedAt = event.at;
      current.revision++;
    } else if (event.type === 'TASKS_PLANNED') {
      if (!Array.isArray(payload.tasks) || payload.tasks.length < 1 || payload.tasks.length > 8) throw new Error('plan task inválido');
      current.tasks = clone(payload.tasks as WorkOrderTask[]);
      if (current.coordinationMode === 'department') current.degraded = current.tasks.some((task) => task.role === 'reviewer') ? 'same-family-review' : 'single-model-review';
      current.updatedAt = event.at;
      current.revision++;
    } else if (event.type === 'TASK_UPDATED') {
      if (typeof payload.taskId !== 'string' || !payload.patch || typeof payload.patch !== 'object' || !current.tasks) throw new Error('task update inválido');
      const task = current.tasks.find((item) => item.taskId === payload.taskId);
      if (!task) throw new Error('task update sem task');
      const patch = payload.patch as Record<string, unknown>;
      if (patch.status !== undefined && !['planned', 'queued', 'running', 'finished', 'failed', 'blocked', 'cancelled'].includes(String(patch.status))) throw new Error('task status inválido');
      if (patch.evidenceRefs !== undefined && (!Array.isArray(patch.evidenceRefs) || patch.evidenceRefs.some((ref) => typeof ref !== 'string'))) throw new Error('task evidence inválida');
      Object.assign(task, clone(patch as Partial<WorkOrderTask>));
      current.updatedAt = event.at;
      current.revision++;
    } else if (event.type === 'REVIEW_RECORDED') {
      if (!payload.review || typeof payload.review !== 'object') throw new Error('review inválido');
      current.reviews = [...(current.reviews ?? []), clone(payload.review as WorkOrderReview)].slice(-16);
      current.updatedAt = event.at;
      current.revision++;
    } else if (event.type === 'EVIDENCE_RECORDED') {
      if (!Array.isArray(payload.evidenceRefs)) throw new Error('evidence inválida');
      current.evidenceRefs = [...new Set([...(current.evidenceRefs ?? []), ...payload.evidenceRefs.filter((ref): ref is string => typeof ref === 'string')])].slice(-64);
      current.updatedAt = event.at;
      current.revision++;
    } else if (event.type === 'APPROVAL_REQUESTED') {
      if (!payload.approval || typeof payload.approval !== 'object') throw new Error('approval inválida');
      const approval = payload.approval as WorkOrderApproval;
      current.approvals = [...(current.approvals ?? []).filter((item) => item.kind !== approval.kind), clone(approval)].slice(-4);
      current.updatedAt = event.at;
      current.revision++;
    } else if (event.type === 'APPROVAL_DECIDED') {
      if (typeof payload.kind !== 'string' || !['approved', 'rejected'].includes(String(payload.status)) || !Number.isInteger(payload.requestedRevision) || !current.approvals) throw new Error('approval decision inválida');
      const approval = current.approvals.find((item) => item.kind === payload.kind && item.status === 'pending');
      if (!approval || approval.requestedRevision !== payload.requestedRevision || current.revision !== payload.requestedRevision) throw new Error('approval decision stale');
      approval.status = payload.status as 'approved' | 'rejected';
      approval.decidedAt = typeof payload.decidedAt === 'number' ? payload.decidedAt : event.at;
      if (typeof payload.reason === 'string') approval.reason = payload.reason;
      current.updatedAt = event.at;
      current.revision++;
    } else if (event.type === 'WORKER_STARTED' || event.type === 'WORKER_FINISHED' || event.type === 'WORKER_CANCELLED') {
      if (!payload.execution || typeof payload.execution !== 'object') throw new Error('receipt de execução inválido');
      const execution = payload.execution as WorkOrder['execution'];
      if (!execution?.executionId || execution.transport !== 'opencode-cli') throw new Error('receipt de execução inválido');
      if (!['running', 'finished', 'failed', 'cancelled'].includes(execution.status)) throw new Error('estado de execução inválido');
      if (execution.outputTail && SECRET_MARKER.test(execution.outputTail)) throw new Error('receipt contém dado proibido');
      if (event.type === 'WORKER_STARTED' && (current.status !== 'QUEUED' || current.execution || !current.routeDecision || current.routeDecision.modelId !== execution.requestedModel || execution.status !== 'running')) throw new Error('worker iniciado fora da fila ou com route divergente');
      if (event.type === 'WORKER_FINISHED' && (!['RUNNING', 'QUEUED'].includes(current.status) || !current.execution || current.execution.executionId !== execution.executionId || !['finished', 'failed'].includes(execution.status))) throw new Error('receipt de execução desconhecido');
      if (event.type === 'WORKER_CANCELLED' && (current.status !== 'RUNNING' || !current.execution || current.execution.executionId !== execution.executionId || execution.status !== 'cancelled')) throw new Error('receipt de execução desconhecido');
      current.execution = clone(execution);
      current.updatedAt = event.at;
      current.revision++;
    } else if (event.type === 'CONVERSATION_LINKED') {
      if (typeof payload.conversationId !== 'string') throw new Error('conversation link inválido');
      current.conversationId = payload.conversationId;
      current.updatedAt = event.at;
      current.revision++;
    } else {
      throw new Error('tipo de evento desconhecido');
    }
    const order = this.orders.get(event.workOrderId)!;
    assertCoordinationScope(order);
    if (order.requestedModel) assertDepartmentModel(order, order.requestedModel);
    if (order.routeDecision) assertDepartmentModel(order, order.routeDecision.modelId);
    if (order.execution) assertDepartmentModel(order, order.execution.requestedModel);
    if (order.tasks) validateDepartmentTasks(order, order.tasks);
    this.events.push(clone(event));
    this.nextSequence++;
    if (!replay && this.events.length > MAX_EVENTS) throw new Error('journal overflow');
  }

  snapshot(): WorkOrderSnapshot {
    this.ensureReady();
    return clone({ schemaVersion: 1, nextSequence: this.nextSequence, orders: this.list(), events: this.events });
  }
}
