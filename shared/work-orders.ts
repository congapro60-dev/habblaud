// Hợp đồng WorkOrder của phòng giám đốc. Chỉ kiểu dữ liệu + quy tắc chuyển trạng thái;
// persistence nằm ở server/work-orders.ts để client không phụ thuộc Node.
import { DEPARTMENT_HEADS, type DepartmentId } from './departments';
import { tr } from './i18n';

export type CoordinationMode = 'global' | 'department';
export type ModelFamily = 'claude' | 'openai' | 'gemini' | 'unknown';

export function modelName(modelId: string | undefined): string {
  return modelId?.split('/').at(-1)?.toLowerCase().replace(/\[[a-z0-9]+\]$/, '') ?? '';
}

/** Classifies an ID, not proof that a request was served by that model. */
export function modelFamily(modelId: string | undefined): ModelFamily {
  const name = modelName(modelId);
  if (/^claude(?:-|$)/.test(name)) return 'claude';
  if (/^gemini(?:-|$)/.test(name)) return 'gemini';
  if (/^(?:gpt-|o[1-9](?:-|$)|codex(?:-|$))/.test(name)) return 'openai';
  return 'unknown';
}

export class CoordinationError extends Error {}

type CoordinationScope = Pick<WorkOrder, 'coordinationMode' | 'departmentId' | 'headId' | 'servedFamily'>;

export function assertCoordinationScope(scope: CoordinationScope): void {
  if (scope.coordinationMode === undefined || scope.coordinationMode === 'global') return;
  if (scope.coordinationMode !== 'department') throw new CoordinationError(tr('Modo de coordenação inválido'));
  if (!['claude', 'openai', 'gemini'].includes(scope.servedFamily ?? '')) throw new CoordinationError(tr('O departamento exige servedFamily explícita e conhecida'));
  const expected = scope.departmentId === 'claude' ? 'claude' : scope.departmentId === 'codex' ? 'openai' : scope.departmentId === 'gemini-antigravity' ? 'gemini' : undefined;
  if (scope.departmentId !== 'opencode-9router' && (!expected || expected !== scope.servedFamily)) throw new CoordinationError(tr('Família incompatível com o departamento'));
  if (scope.headId !== undefined && scope.headId !== DEPARTMENT_HEADS[scope.departmentId!].id) throw new CoordinationError(tr('Chefe incompatível com o departamento'));
}

export function assertDepartmentModel(scope: CoordinationScope, modelId: string): void {
  assertCoordinationScope(scope);
  if (scope.coordinationMode === 'department' && modelFamily(modelId) !== scope.servedFamily) throw new CoordinationError(tr('Modelo fora da família fixada no departamento'));
}

export function assertDepartmentDispatch(scope: CoordinationScope, requestedModel: string, servedModel?: string): void {
  assertDepartmentModel(scope, requestedModel);
  if (scope.coordinationMode === 'department' && modelFamily(servedModel) !== scope.servedFamily) throw new CoordinationError(tr('Dispatch do departamento exige telemetria da família servida'));
}

export const WORK_ORDER_STATUSES = ['PLANNED', 'QUEUED', 'RUNNING', 'READY_FOR_REVIEW', 'VERIFIED', 'FAILED', 'BLOCKED', 'CANCELLED'] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
export type WorkOrderPermission = 'READ_ONLY' | 'WORKSPACE_WRITE';
export type WorkOrderRuntime = 'codex' | 'claude' | 'opencode' | '9router' | 'antigravity' | 'unknown';
export type WorkOrderRole = 'planner' | 'worker' | 'reviewer' | 'director';
export type RoutePolicy = 'free-fast' | 'balanced-code' | 'deep-code' | 'review-code';
export interface RouteDecision {
  providerId: string;
  modelId: string;
  /** Only populated by served-model telemetry, never catalog labels. */
  servedModel?: string;
  role: WorkOrderRole;
  policy: RoutePolicy;
  costClass: string;
  quotaState: string;
  health: string;
  evidenceRefs: string[];
  degraded?: string;
  selectedAt: number;
}

export type WorkOrderExecutionStatus = 'starting' | 'running' | 'finished' | 'failed' | 'cancelled';
export interface WorkOrderExecution {
  executionId: string;
  transport: 'opencode-cli';
  requestedModel: string;
  servedModel: string;
  status: WorkOrderExecutionStatus;
  startedAt: number;
  finishedAt?: number;
  exitCode?: number | null;
  outputTail?: string;
  evidenceRefs: string[];
  degraded?: string;
}

export type WorkOrderTaskRole = 'worker' | 'reviewer';
export type WorkOrderTaskStatus = 'planned' | 'queued' | 'running' | 'finished' | 'failed' | 'blocked' | 'cancelled';
export interface WorkOrderTask {
  taskId: string;
  wave: 1 | 2;
  role: WorkOrderTaskRole;
  departmentId?: DepartmentId;
  headId?: string;
  objective: string;
  permissionMode: WorkOrderPermission;
  requestedModel: string;
  servedModel: string;
  status: WorkOrderTaskStatus;
  evidenceRefs: string[];
  executionId?: string;
  outputTail?: string;
  degraded?: string;
  startedAt?: number;
  finishedAt?: number;
}

export type WorkOrderReviewVerdict = 'pass' | 'changes_requested' | 'blocked';
export interface WorkOrderReview {
  taskId: string;
  reviewerTaskId: string;
  verdict: WorkOrderReviewVerdict;
  summary: string;
  evidenceRefs: string[];
  at: number;
}

export type WorkOrderApprovalKind = 'commit' | 'deploy';
export type WorkOrderApprovalStatus = 'pending' | 'approved' | 'rejected';
export interface WorkOrderApproval {
  kind: WorkOrderApprovalKind;
  status: WorkOrderApprovalStatus;
  requestedRevision: number;
  evidenceRefs: string[];
  requestedAt: number;
  decidedAt?: number;
  reason?: string;
}

export interface WorkOrder {
  id: string;
  coordinationMode: CoordinationMode;
  /** Immutable family constraint; not an observation of a served model. */
  servedFamily?: ModelFamily;
  degraded?: 'single-model-review' | 'same-family-review';
  verificationMode?: 'director-after-tests';
  objective: string;
  projectPath?: string;
  permissionMode: WorkOrderPermission;
  requestedRuntime: WorkOrderRuntime;
  requestedModel?: string;
  departmentId?: DepartmentId;
  headId?: string;
  role: WorkOrderRole;
  routePolicy: RoutePolicy;
  routeDecision?: RouteDecision;
  execution?: WorkOrderExecution;
  tasks?: WorkOrderTask[];
  reviews?: WorkOrderReview[];
  evidenceRefs?: string[];
  approvals?: WorkOrderApproval[];
  conversationId?: string;
  skills: string[];
  acceptanceCriteria: string[];
  status: WorkOrderStatus;
  report?: string;
  blocker?: string;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

export type WorkOrderEventType = 'WORK_CREATED' | 'WORK_STATUS_CHANGED' | 'WORK_REPORT' | 'WORK_BLOCKED' | 'WORK_CANCELLED' | 'ROUTE_SELECTED' | 'HEAD_ASSIGNED' | 'TASKS_PLANNED' | 'TASK_UPDATED' | 'REVIEW_RECORDED' | 'EVIDENCE_RECORDED' | 'APPROVAL_REQUESTED' | 'APPROVAL_DECIDED' | 'CONVERSATION_LINKED' | 'WORKER_STARTED' | 'WORKER_FINISHED' | 'WORKER_CANCELLED';

export interface WorkOrderEvent {
  sequence: number;
  workOrderId: string;
  type: WorkOrderEventType;
  payload: Record<string, unknown>;
  at: number;
}

export interface WorkOrderSnapshot {
  schemaVersion: 1;
  nextSequence: number;
  orders: WorkOrder[];
  events: WorkOrderEvent[];
}

export const WORK_ORDER_STATUS_TRANSITIONS: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  PLANNED: ['QUEUED', 'BLOCKED', 'CANCELLED'],
  QUEUED: ['RUNNING', 'BLOCKED', 'CANCELLED'],
  RUNNING: ['READY_FOR_REVIEW', 'FAILED', 'BLOCKED', 'CANCELLED'],
  READY_FOR_REVIEW: ['VERIFIED', 'FAILED', 'BLOCKED'],
  VERIFIED: [],
  FAILED: ['QUEUED', 'CANCELLED'],
  BLOCKED: ['QUEUED', 'CANCELLED'],
  CANCELLED: [],
};

export function canTransitionWorkOrder(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return WORK_ORDER_STATUS_TRANSITIONS[from].includes(to);
}
