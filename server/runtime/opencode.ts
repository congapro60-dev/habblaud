import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { delimiter, isAbsolute, join, parse } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertDepartmentDispatch, type WorkOrder, type WorkOrderExecution, type WorkOrderPermission, type WorkOrderTask } from '../../shared/work-orders';
import { WorkOrderError, type WorkOrderStore } from '../work-orders';
import { log } from '../log';
import { tr } from '../../shared/i18n';

const OUTPUT_MAX = 8_192;
const TITLE_MAX = 120;
const MAX_ACTIVE = 1;
const MODEL_ID = /^(?:ag|cx|cc|gc)\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9]+\])?$/;
const SECRET = /(?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|password|authorization|cookie|sk-[A-Za-z0-9_-]{12,})/i;

export interface RuntimeProcess {
  kill(signal?: NodeJS.Signals): boolean;
  once(event: 'error' | 'close', listener: (...args: any[]) => void): this;
  stdout?: { on(event: 'data', listener: (chunk: Buffer | string) => void): unknown };
  stderr?: { on(event: 'data', listener: (chunk: Buffer | string) => void): unknown };
}

export type RuntimeSpawn = (bin: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; windowsHide: boolean; stdio: ['ignore', 'pipe', 'pipe'] }) => RuntimeProcess;

export interface OpenCodeRuntimeOptions {
  store: WorkOrderStore;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  spawnImpl?: RuntimeSpawn;
  resolveBin?: (env: NodeJS.ProcessEnv) => string | undefined;
}

export interface RuntimeConfirmations {
  unknownCostOrQuota?: boolean;
  antigravityAccountSession?: boolean;
  workspaceWrite?: boolean;
}

export interface RuntimeTaskReceipt {
  executionId: string;
  status: 'finished' | 'failed' | 'cancelled';
  requestedModel: string;
  servedModel: string;
  outputTail: string;
  exitCode: number | null;
  evidenceRefs: string[];
  degraded?: string;
}

function executable(path: string): boolean {
  try { accessSync(path, constants.X_OK); return statSync(path).isFile(); } catch { return false; }
}

/** Resolve the native executable. Never run npm .cmd/.ps1 through a shell. */
export function findOpenCodeBin(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = env.HABBLAUD_OPENCODE_BIN?.trim();
  if (explicit) return isAbsolute(explicit) && executable(explicit) && !/\.(?:cmd|ps1)$/i.test(explicit) ? explicit : undefined;
  const names = process.platform === 'win32' ? ['opencode.exe'] : ['opencode'];
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (!dir || !isAbsolute(dir)) continue;
    for (const name of names) {
      const candidate = join(dir, name);
      if (executable(candidate)) return candidate;
    }
    if (process.platform === 'win32') {
      const shim = join(dir, 'opencode.cmd');
      try {
        if (!existsSync(shim)) continue;
        const text = readFileSync(shim, 'utf8');
        if (/node_modules\\opencode-ai\\bin\\opencode\.exe/i.test(text)) {
          const candidate = join(dir, 'node_modules', 'opencode-ai', 'bin', 'opencode.exe');
          if (executable(candidate)) return candidate;
        }
      } catch { /* try next PATH entry */ }
    }
  }
  return undefined;
}

function safeTitle(order: WorkOrder): string {
  return order.objective.replace(/[\r\n\0]+/g, ' ').trim().slice(0, TITLE_MAX) || `WorkOrder ${order.id}`;
}

function safeTail(value: string): string {
  const lines = value.split(/\r?\n/).filter((line) => !SECRET.test(line));
  const text = lines.join('\n');
  return text.length > OUTPUT_MAX ? text.slice(-OUTPUT_MAX) : text;
}

export function openCodeArgs(order: WorkOrder, override: { objective?: string; permissionMode?: WorkOrderPermission; requestedModel?: string; routeServedModel?: string } = {}): string[] {
  const decision = override.requestedModel ? { ...order.routeDecision, modelId: override.requestedModel } : order.routeDecision;
  if (order.requestedRuntime !== 'opencode') throw new WorkOrderError('conflict', 'P1C hiện hỗ trợ runtime OpenCode');
  if (!decision || decision.providerId !== '9router' || !MODEL_ID.test(decision.modelId) || decision.modelId.includes('..') || decision.costClass === 'paid-api') throw new WorkOrderError('invalid', 'OpenCode cần route 9Router subscription đã chọn; paid API bị chặn trong P1C');
  assertDepartmentDispatch(order, decision.modelId, override.requestedModel ? override.routeServedModel : decision.servedModel);
  if (!order.projectPath || !isAbsolute(order.projectPath) || /[\0\r\n]/.test(order.projectPath)) throw new WorkOrderError('invalid', 'WorkOrder cần projectPath tuyệt đối');
  let projectRoot: string;
  try {
    projectRoot = realpathSync(order.projectPath);
    if (!statSync(projectRoot).isDirectory() || parse(projectRoot).root === projectRoot) throw new Error('not a project directory');
    const gitRoot = realpathSync(execFileSync('git', ['-C', projectRoot, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim());
    if (gitRoot !== projectRoot) throw new Error('not the repository root');
  } catch { throw new WorkOrderError('invalid', 'projectPath phải là gốc của một Git repository tồn tại'); }
  const permissionMode = override.permissionMode ?? order.permissionMode;
  const taskOrder = override.objective || permissionMode !== order.permissionMode ? { ...order, ...(override.objective ? { objective: override.objective } : {}), permissionMode } : order;
  const agent = permissionMode === 'WORKSPACE_WRITE' ? 'build' : 'plan';
  // OpenCode v2 uses the child process cwd; it removed the legacy `--dir` flag.
  return ['run', '-m', `9router-local/${decision.modelId}`, '--agent', agent, '--format', 'json', '--title', safeTitle(taskOrder), ...(permissionMode === 'WORKSPACE_WRITE' ? ['--auto'] : []), promptFor(taskOrder)];
}

function promptFor(order: WorkOrder): string {
  return [
    `[Habblaud WorkOrder ${order.id}]`,
    `Goal: ${order.objective}`,
    `Permission: ${order.permissionMode}`,
    order.skills.length ? `Skills: ${order.skills.join(', ')}` : '',
    order.acceptanceCriteria.length ? `Acceptance criteria:\n${order.acceptanceCriteria.map((item) => `- ${item}`).join('\n')}` : '',
    'Read the repository AGENTS.md first. Do not commit, push, deploy, add dependencies, or change files outside this repository. Report changes and checks; do not include credentials or raw tool output.',
  ].filter(Boolean).join('\n\n');
}

export class OpenCodeRuntime {
  private readonly active = new Map<string, { executionId: string; child: RuntimeProcess; cancelled: boolean; cancelResolve?: () => void }>();
  private taskActive?: { key: string; child: RuntimeProcess; cancel: () => void };
  private readonly now: () => number;
  private readonly env: NodeJS.ProcessEnv;
  private readonly spawnImpl: RuntimeSpawn;
  private readonly resolveBin: (env: NodeJS.ProcessEnv) => string | undefined;

  constructor(private readonly options: OpenCodeRuntimeOptions) {
    this.now = options.now ?? Date.now;
    this.env = options.env ?? process.env;
    this.spawnImpl = options.spawnImpl ?? ((bin, args, opts) => spawn(bin, args, opts) as unknown as RuntimeProcess);
    this.resolveBin = options.resolveBin ?? findOpenCodeBin;
    this.recoverInterruptedRuns();
  }

  private recoverInterruptedRuns(): void {
    let orders: WorkOrder[];
    try { orders = this.options.store.list(); } catch { log.warn('WorkOrder journal không đọc được; bỏ qua reconcile runtime.'); return; }
    for (const order of orders) {
      const execution = order.execution;
      if ((order.status !== 'RUNNING' && order.status !== 'QUEUED') || execution?.transport !== 'opencode-cli') continue;
      if (execution.status === 'running') {
        const message = 'Habblaud foi reiniciado durante a execução. OpenCode pode continuar ativo; verifique o repositório antes de iniciar outra tarefa.';
        this.options.store.finishExecution(order.id, execution.executionId, { status: 'failed', finishedAt: this.now(), exitCode: null, outputTail: message, degraded: 'worker-state-unknown-after-restart' });
        this.options.store.report(order.id, message);
        this.options.store.transition(order.id, 'BLOCKED', 'estado do worker desconhecido após reiniciar o Habblaud');
        continue;
      }
      const current = this.options.store.get(order.id)!.order;
      if (current.status === 'QUEUED') this.options.store.transition(order.id, 'RUNNING');
      if (!current.report) this.options.store.report(order.id, execution.outputTail || 'Habblaud recuperou o resultado após reiniciar.');
      if (execution.status === 'finished' && current.coordinationMode === 'department') {
        try { assertDepartmentDispatch(current, execution.requestedModel, execution.servedModel); }
        catch { this.options.store.transition(order.id, 'BLOCKED', tr('Dispatch do departamento exige telemetria da família servida')); continue; }
      }
      this.options.store.transition(order.id, execution.status === 'finished' ? 'READY_FOR_REVIEW' : execution.status === 'cancelled' ? 'CANCELLED' : 'FAILED', 'transição recuperada do receipt OpenCode');
    }
  }

  start(id: string): WorkOrder {
    return this.startConfirmed(id, {});
  }

  startConfirmed(id: string, confirmations: RuntimeConfirmations = {}): WorkOrder {
    if (this.active.has(id)) throw new WorkOrderError('conflict', 'WorkOrder đang chạy');
    if (this.active.size >= MAX_ACTIVE) throw new WorkOrderError('conflict', 'P1C chỉ chạy một worker cùng lúc');
    const current = this.options.store.get(id)?.order;
    if (!current) throw new WorkOrderError('not-found', 'WorkOrder không tồn tại');
    if (!current.routeDecision) throw new WorkOrderError('conflict', 'WorkOrder chưa chọn route');
    if (current.status !== 'PLANNED' && current.status !== 'QUEUED') throw new WorkOrderError('conflict', 'WorkOrder không ở trạng thái có thể chạy');
    const decision = current.routeDecision;
    if ((decision.costClass === 'unknown' || decision.quotaState === 'unknown') && !confirmations.unknownCostOrQuota) throw new WorkOrderError('conflict', 'Cần xác nhận chi phí/quota chưa xác minh trước khi chạy');
    if (decision.modelId.startsWith('ag/') && !confirmations.antigravityAccountSession) throw new WorkOrderError('conflict', 'Cần xác nhận rủi ro của phiên Antigravity qua 9Router');
    if (current.permissionMode === 'WORKSPACE_WRITE' && !confirmations.workspaceWrite) throw new WorkOrderError('conflict', 'Cần xác nhận quyền WORKSPACE_WRITE trước khi chạy OpenCode');
    const bin = this.resolveBin(this.env);
    if (!bin) throw new WorkOrderError('unavailable', 'Không tìm thấy executable OpenCode native');
    const args = openCodeArgs(current);
    const projectRoot = current.projectPath;
    if (!projectRoot) throw new WorkOrderError('invalid', 'projectPath không hợp lệ');
    const queued = current.status === 'PLANNED' ? this.options.store.transition(id, 'QUEUED') : current;
    const executionId = randomUUID();
    const startedAt = this.now();
    const execution: WorkOrderExecution = { executionId, transport: 'opencode-cli', requestedModel: queued.routeDecision!.modelId, servedModel: 'unknown', status: 'running', startedAt, evidenceRefs: [...queued.routeDecision!.evidenceRefs, 'runtime:opencode-cli'], degraded: queued.routeDecision!.degraded ?? 'served-model-unverified' };
    this.options.store.startExecution(id, execution);
    this.options.store.transition(id, 'RUNNING');
    let output = '';
    let child: RuntimeProcess;
    try {
      child = this.spawnImpl(bin, args, { cwd: projectRoot, env: { ...this.env, DIEU_PHOI_WORKER: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      const message = safeTail(error instanceof Error ? error.message : String(error));
      this.options.store.finishExecution(id, executionId, { status: 'failed', finishedAt: this.now(), exitCode: 1, outputTail: message });
      this.options.store.report(id, message || 'OpenCode không khởi động được.');
      this.options.store.transition(id, 'FAILED', 'Không khởi động được OpenCode');
      return this.options.store.get(id)!.order;
    }
    const active: { executionId: string; child: RuntimeProcess; cancelled: boolean; cancelResolve?: () => void } = { executionId, child, cancelled: false };
    this.active.set(id, active);
    let pending = '';
    const collect = (chunk: Buffer | string) => {
      pending += String(chunk);
      let newline = pending.indexOf('\n');
      while (newline >= 0) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        try {
          const event = JSON.parse(line) as { type?: string; part?: { type?: string; text?: string } };
          if (event.type === 'text' && event.part?.type === 'text' && typeof event.part.text === 'string') output = safeTail(`${output}\n${event.part.text}`);
        } catch { /* discard non-JSON logs; never persist raw tool output */ }
        newline = pending.indexOf('\n');
      }
      if (pending.length > 64 * 1024) pending = '';
    };
    child.stdout?.on('data', collect);
    child.once('error', (error) => {
      this.finish(id, executionId, 1, safeTail(`${output}\nOpenCode error: ${error.message}`), active.cancelled);
      active.cancelResolve?.();
    });
    child.once('close', (code, signal) => {
      this.finish(id, executionId, code, safeTail(`${output}${signal ? `\n${signal}` : ''}`), active.cancelled);
      active.cancelResolve?.();
    });
    return this.options.store.get(id)!.order;
  }

  async cancel(id: string): Promise<WorkOrder> {
    const active = this.active.get(id);
    if (!active) throw new WorkOrderError('conflict', 'WorkOrder không có worker đang chạy');
    active.cancelled = true;
    const closed = new Promise<void>((resolve) => { active.cancelResolve = resolve; });
    active.child.kill('SIGTERM');
    const escalate = setTimeout(() => {
      if (this.active.get(id) === active) active.child.kill('SIGKILL');
    }, 3_000);
    escalate.unref?.();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([closed, new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new WorkOrderError('unavailable', 'OpenCode không dừng sau yêu cầu hủy')), 10_000);
        timeout.unref?.();
      })]);
    } finally {
      clearTimeout(escalate);
      if (timeout) clearTimeout(timeout);
    }
    return this.options.store.get(id)!.order;
  }

  async runTask(order: WorkOrder, task: WorkOrderTask, confirmations: RuntimeConfirmations = {}, routeServedModel?: string): Promise<RuntimeTaskReceipt> {
    if (this.taskActive || this.active.size) throw new WorkOrderError('conflict', 'đã có worker OpenCode đang chạy');
    if (!order.routeDecision) throw new WorkOrderError('conflict', 'WorkOrder chưa chọn route');
    if (order.coordinationMode === 'department' && (task.departmentId !== order.departmentId || task.headId !== order.headId || (task.role === 'reviewer' && task.permissionMode !== 'READ_ONLY'))) throw new WorkOrderError('invalid', tr('Tarefa incompatível com o departamento'));
    if ((order.routeDecision.costClass === 'unknown' || order.routeDecision.quotaState === 'unknown') && !confirmations.unknownCostOrQuota) throw new WorkOrderError('conflict', 'Cần xác nhận chi phí/quota chưa xác minh trước khi chạy task');
    if (task.requestedModel.startsWith('ag/') && !confirmations.antigravityAccountSession) throw new WorkOrderError('conflict', 'Cần xác nhận rủi ro của phiên Antigravity qua 9Router');
    if (task.permissionMode === 'WORKSPACE_WRITE' && !confirmations.workspaceWrite) throw new WorkOrderError('conflict', 'Cần xác nhận quyền WORKSPACE_WRITE trước khi chạy task');
    const bin = this.resolveBin(this.env);
    if (!bin) throw new WorkOrderError('unavailable', 'Không tìm thấy executable OpenCode native');
    const args = openCodeArgs(order, { objective: task.objective, permissionMode: task.permissionMode, requestedModel: task.requestedModel, routeServedModel });
    const projectRoot = order.projectPath;
    if (!projectRoot) throw new WorkOrderError('invalid', 'projectPath không hợp lệ');
    const executionId = randomUUID();
    let child: RuntimeProcess;
    try {
      child = this.spawnImpl(bin, args, { cwd: projectRoot, env: { ...this.env, DIEU_PHOI_WORKER: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      return { executionId, status: 'failed', requestedModel: task.requestedModel, servedModel: 'unknown', outputTail: safeTail(error instanceof Error ? error.message : String(error)), exitCode: 1, evidenceRefs: ['runtime:opencode-task'], degraded: 'spawn-failed' };
    }
    let output = '';
    let pending = '';
    let settled = false;
    let resolveReceipt!: (receipt: RuntimeTaskReceipt) => void;
    const promise = new Promise<RuntimeTaskReceipt>((resolve) => { resolveReceipt = resolve; });
    const finish = (status: RuntimeTaskReceipt['status'], code: number | null, signal?: string) => {
      if (settled) return;
      settled = true;
      this.taskActive = undefined;
      resolveReceipt({ executionId, status, requestedModel: task.requestedModel, servedModel: 'unknown', outputTail: safeTail(`${output}${signal ? `\n${signal}` : ''}`), exitCode: code, evidenceRefs: ['runtime:opencode-task'], ...(status !== 'finished' ? { degraded: status === 'cancelled' ? 'cancelled' : 'task-failed' } : { degraded: 'served-model-unverified' }) });
    };
    const collect = (chunk: Buffer | string) => {
      pending += String(chunk);
      let newline = pending.indexOf('\n');
      while (newline >= 0) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        try {
          const event = JSON.parse(line) as { type?: string; part?: { type?: string; text?: string } };
          if (event.type === 'text' && event.part?.type === 'text' && typeof event.part.text === 'string') output = safeTail(`${output}\n${event.part.text}`);
        } catch { /* discard non-JSON logs */ }
        newline = pending.indexOf('\n');
      }
      if (pending.length > 64 * 1024) pending = '';
    };
    child.stdout?.on('data', collect);
    child.once('error', (error) => finish('failed', 1, `OpenCode error: ${error.message}`));
    child.once('close', (code, signal) => finish(signal ? 'cancelled' : code === 0 ? 'finished' : 'failed', code, signal ?? undefined));
    this.taskActive = { key: `${order.id}:${task.taskId}`, child, cancel: () => { if (!settled) { child.kill('SIGTERM'); finish('cancelled', null, 'SIGTERM'); } } };
    return promise;
  }

  cancelTask(workOrderId: string): boolean {
    if (!this.taskActive?.key.startsWith(`${workOrderId}:`)) return false;
    this.taskActive.cancel();
    return true;
  }

  private finish(id: string, executionId: string, code: number | null, output: string, cancelled: boolean): void {
    const active = this.active.get(id);
    if (!active || active.executionId !== executionId) return;
    this.active.delete(id);
    if (cancelled) {
      this.options.store.finishExecution(id, executionId, { status: 'cancelled', finishedAt: this.now(), outputTail: 'OpenCode worker cancelado.' });
      this.options.store.transition(id, 'CANCELLED', 'Usuário cancelou o worker OpenCode');
      this.active.delete(id);
      return;
    }
    const ok = code === 0;
    try {
      const order = this.options.store.finishExecution(id, executionId, { status: ok ? 'finished' : 'failed', finishedAt: this.now(), exitCode: code, outputTail: output });
      this.options.store.report(id, output || (ok ? 'OpenCode hoàn tất; không có nội dung tóm tắt.' : `OpenCode thất bại (exit ${String(code ?? '?')}); xem nhật ký cục bộ.`));
      if (ok && order.coordinationMode === 'department') {
        try { assertDepartmentDispatch(order, order.execution!.requestedModel, order.execution!.servedModel); }
        catch { this.options.store.transition(id, 'BLOCKED', tr('Dispatch do departamento exige telemetria da família servida')); return; }
      }
      this.options.store.transition(id, ok ? 'READY_FOR_REVIEW' : 'FAILED', ok ? undefined : `OpenCode exit code ${String(code ?? '?')}`);
    } catch {
      log.warn('WorkOrder: không thể lưu kết quả worker OpenCode; cần reconcile sau restart.');
    }
  }
}
