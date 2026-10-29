import { assertDepartmentDispatch, assertDepartmentModel, modelFamily, modelName, type WorkOrder, type WorkOrderTask, type WorkOrderReview } from '../shared/work-orders';
import { tr } from '../shared/i18n';
import { WorkOrderError, type WorkOrderStore } from './work-orders';
import type { RouterService } from './router';
import { OpenCodeRuntime, type RuntimeConfirmations } from './runtime/opencode';

const REVIEWER_ORDER = ['cx/', 'cc/', 'ag/', 'gc/'];

function family(modelId: string): string { return modelId.slice(0, modelId.indexOf('/') + 1); }

export interface OrchestratorOptions {
  store: WorkOrderStore;
  router: RouterService;
  runtime: OpenCodeRuntime;
  now?: () => number;
}

export class WorkOrderOrchestrator {
  private readonly active = new Set<string>();
  private readonly cancelled = new Set<string>();
  private readonly now: () => number;

  constructor(private readonly options: OrchestratorOptions) {
    this.now = options.now ?? Date.now;
    this.recoverInterruptedPlans();
  }

  private recoverInterruptedPlans(): void {
    let orders: WorkOrder[];
    try { orders = this.options.store.list(); } catch { return; }
    for (const order of orders) {
      if (!order.tasks?.some((task) => task.status === 'running' || task.status === 'queued')) continue;
      try {
        for (const task of order.tasks.filter((item) => item.status === 'running' || item.status === 'queued')) this.options.store.updateTask(order.id, task.taskId, { status: 'blocked', degraded: 'worker-state-unknown-after-restart', finishedAt: this.now(), evidenceRefs: [...task.evidenceRefs, 'recovery:restart'] });
        this.options.store.recordEvidence(order.id, ['recovery:restart']);
        this.options.store.report(order.id, 'Habblaud foi reiniciado durante a orchestration. Estado do worker desconhecido; revisar antes de retomar.');
        const current = this.options.store.get(order.id)?.order;
        if (current && (current.status === 'RUNNING' || current.status === 'QUEUED')) this.options.store.transition(order.id, 'BLOCKED', 'estado da orchestration desconhecido após reiniciar');
      } catch { /* journal remains fail-closed; next boot retries the same reconciliation */ }
    }
  }

  plan(id: string, requested?: readonly WorkOrderTask[]): WorkOrder {
    const current = this.get(id);
    const tasks = requested?.length ? requested : this.defaultPlan(current);
    return this.options.store.planTasks(id, tasks);
  }

  async start(id: string, confirmations: RuntimeConfirmations = {}): Promise<WorkOrder> {
    if (this.active.has(id)) throw new WorkOrderError('conflict', 'WorkOrder orchestration đang chạy');
    let current = this.get(id);
    const catalog = await this.options.router.refresh(true);
    if (!current.tasks?.length) current = this.plan(id);
    const tasks = current.tasks ?? [];
    if (tasks.length > 8 || new Set(tasks.map((task) => task.wave)).size > 2) throw new WorkOrderError('invalid', 'plan vượt giới hạn hai wave');
    for (const task of tasks) {
      const model = catalog.models.find((item) => item.modelId === task.requestedModel);
      if (!model || model.supportsTools !== true) throw new WorkOrderError('unavailable', `task ${task.taskId} chưa xác nhận capability tools`);
      assertDepartmentDispatch(current, task.requestedModel, model.servedModel);
      if (current.coordinationMode === 'department' && (catalog.health !== 'ok' || model.health !== 'ok' || model.quotaState === 'exhausted')) throw new WorkOrderError('unavailable', tr('Route do departamento indisponível'));
      if (model.costClass === 'paid-api') throw new WorkOrderError('conflict', `task ${task.taskId} dùng API trả phí bị chặn`);
      if ((model.costClass === 'unknown' || model.quotaState === 'unknown') && !confirmations.unknownCostOrQuota) throw new WorkOrderError('conflict', `task ${task.taskId} có cost/quota chưa xác minh`);
      if (task.requestedModel.startsWith('ag/') && !confirmations.antigravityAccountSession) throw new WorkOrderError('conflict', `task ${task.taskId} dùng phiên Antigravity qua 9Router`);
    }
    if (current.coordinationMode !== 'department' && tasks.filter((task) => task.role === 'reviewer').length < 1) throw new WorkOrderError('invalid', 'plan thiếu reviewer');
    this.active.add(id);
    this.cancelled.delete(id);
    try {
      current = this.options.store.transition(id, 'QUEUED');
      current = this.options.store.transition(id, 'RUNNING');
      const reports: string[] = [];
      for (const wave of [1, 2] as const) {
        for (const task of tasks.filter((item) => item.wave === wave)) {
          if (this.cancelled.has(id)) throw new WorkOrderError('conflict', 'orchestration đã bị hủy');
          this.options.store.updateTask(id, task.taskId, { status: 'running', startedAt: this.now(), evidenceRefs: [...task.evidenceRefs, `wave:${wave}`] });
          let routeServedModel: string | undefined;
          if (current.coordinationMode === 'department') {
            const live = await this.options.router.refresh(true);
            const model = live.models.find((item) => item.modelId === task.requestedModel);
            if (live.health !== 'ok' || model?.health !== 'ok' || model.supportsTools !== true || model.quotaState === 'exhausted' || model.costClass === 'paid-api') throw new WorkOrderError('unavailable', tr('Route do departamento indisponível'));
            if ((model.costClass === 'unknown' || model.quotaState === 'unknown') && !confirmations.unknownCostOrQuota) throw new WorkOrderError('conflict', tr('Custo/quota do departamento não confirmado'));
            routeServedModel = model.servedModel;
            assertDepartmentDispatch(current, task.requestedModel, routeServedModel);
          }
          const receipt = await this.options.runtime.runTask(current, task, confirmations, routeServedModel);
          this.options.store.updateTask(id, task.taskId, { status: receipt.status, finishedAt: this.now(), executionId: receipt.executionId, servedModel: receipt.servedModel, outputTail: receipt.outputTail, degraded: receipt.degraded, evidenceRefs: [...task.evidenceRefs, ...receipt.evidenceRefs] });
          this.options.store.recordEvidence(id, [...receipt.evidenceRefs, `task:${task.taskId}`]);
          if (receipt.outputTail) reports.push(`${task.taskId}: ${receipt.outputTail}`);
          if (receipt.status !== 'finished') {
            this.options.store.transition(id, receipt.status === 'cancelled' ? 'CANCELLED' : 'BLOCKED', `task ${task.taskId} kết thúc ở trạng thái ${receipt.status}`);
            this.options.store.report(id, reports.join('\n\n').slice(-8000) || `task ${task.taskId} không hoàn tất`);
            return this.get(id);
          }
          assertDepartmentDispatch(current, task.requestedModel, receipt.servedModel);
          if (task.role === 'reviewer') {
            const review = this.reviewFrom(tasks.find((item) => item.wave === 1 && item.role === 'worker')?.taskId ?? task.taskId, task, receipt.outputTail, receipt.evidenceRefs);
            this.options.store.recordReview(id, review);
            if (review.verdict !== 'pass') {
              this.options.store.transition(id, 'BLOCKED', `reviewer: ${review.verdict}`);
              this.options.store.report(id, reports.join('\n\n').slice(-8000));
              return this.get(id);
            }
          }
          current = this.get(id);
        }
      }
      current = this.options.store.transition(id, 'READY_FOR_REVIEW');
      if (current.degraded !== 'single-model-review') current = this.options.store.transition(id, 'VERIFIED');
      this.options.store.report(id, reports.join('\n\n').slice(-8000) || 'Wave hoàn tất; không có report text.');
      return this.get(id);
    } catch (error) {
      if (current.coordinationMode !== 'department') throw error;
      const order = this.get(id);
      if (order.status === 'RUNNING' || order.status === 'QUEUED' || order.status === 'READY_FOR_REVIEW') {
        for (const task of order.tasks ?? []) if (task.status === 'running') this.options.store.updateTask(id, task.taskId, { status: 'blocked', degraded: 'family-dispatch-blocked', finishedAt: this.now() });
        this.options.store.transition(id, 'BLOCKED', error instanceof Error ? error.message : tr('Dispatch do departamento bloqueado'));
      }
      return this.get(id);
    } finally {
      this.active.delete(id);
      this.cancelled.delete(id);
    }
  }

  async cancel(id: string): Promise<WorkOrder> {
    if (!this.active.has(id)) throw new WorkOrderError('conflict', 'WorkOrder không có orchestration đang chạy');
    this.cancelled.add(id);
    this.options.runtime.cancelTask(id);
    return this.get(id);
  }

  private get(id: string): WorkOrder {
    const order = this.options.store.get(id)?.order;
    if (!order) throw new WorkOrderError('not-found', 'WorkOrder không tồn tại');
    return order;
  }

  private defaultPlan(order: WorkOrder): WorkOrderTask[] {
    const workerModel = order.routeDecision?.modelId;
    if (!workerModel) throw new WorkOrderError('conflict', 'WorkOrder chưa chọn route');
    const catalog = this.options.router.snapshot();
    assertDepartmentModel(order, workerModel);
    const workerFamily = family(workerModel);
    const reviewer = catalog.models
      .filter((model) => model.supportsTools === true && model.modelId !== workerModel && /^(?:cx|cc|ag|gc)\//.test(model.modelId) && (order.coordinationMode === 'department'
        ? modelFamily(model.modelId) === order.servedFamily && modelName(model.modelId) !== modelName(workerModel) && modelFamily(model.servedModel) === order.servedFamily && model.health === 'ok' && model.quotaState !== 'exhausted' && model.costClass !== 'paid-api'
        : family(model.modelId) !== workerFamily))
      .sort((a, b) => REVIEWER_ORDER.indexOf(family(a.modelId)) - REVIEWER_ORDER.indexOf(family(b.modelId)))[0];
    if (!reviewer && order.coordinationMode !== 'department') throw new WorkOrderError('unavailable', 'chưa có reviewer khác họ model với capability tools');
    const base = { departmentId: order.departmentId, headId: order.headId };
    return [
      { taskId: 'worker-wave-1', wave: 1, role: 'worker', ...base, objective: order.objective, permissionMode: order.permissionMode, requestedModel: workerModel, servedModel: 'unknown', status: 'planned', evidenceRefs: ['plan:wave-1'] },
      ...(reviewer ? [{ taskId: 'review-wave-2', wave: 2 as const, role: 'reviewer' as const, ...(order.coordinationMode === 'department' ? base : { departmentId: 'review' as const, headId: 'head:review' }), objective: `Review kết quả WorkOrder ${order.id}. Đọc diff và evidence. Kết thúc đúng một dòng: REVIEW_VERDICT: PASS hoặc REVIEW_VERDICT: CHANGES_REQUESTED hoặc REVIEW_VERDICT: BLOCKED.`, permissionMode: 'READ_ONLY' as const, requestedModel: reviewer.modelId, servedModel: 'unknown', status: 'planned' as const, evidenceRefs: ['plan:wave-2', `reviewer-family:${order.coordinationMode === 'department' ? modelFamily(reviewer.modelId) : family(reviewer.modelId)}`] }] : []),
    ];
  }

  private reviewFrom(subjectTaskId: string, task: WorkOrderTask, output: string, evidenceRefs: string[]): WorkOrderReview {
    const marker = /REVIEW_VERDICT\s*:\s*(PASS|CHANGES_REQUESTED|BLOCKED)/i.exec(output);
    const verdict = marker?.[1]?.toUpperCase() === 'PASS' ? 'pass' : marker?.[1]?.toUpperCase() === 'CHANGES_REQUESTED' ? 'changes_requested' : 'blocked';
    return { taskId: subjectTaskId, reviewerTaskId: task.taskId, verdict, summary: output.slice(-4000) || 'Reviewer không trả summary.', evidenceRefs, at: this.now() };
  }
}
