import type { UiComponent, UiContext } from './context';
import { h, iconButton, setHidden, setText } from './dom';
import { ICONS } from './icons';
import { tr } from '../../../shared/i18n';
import type { RoutePolicy, WorkOrder, WorkOrderPermission, WorkOrderRole, WorkOrderRuntime } from '../../../shared/work-orders';

const STATUS_LABEL: Record<WorkOrder['status'], string> = {
  PLANNED: 'Planejado', QUEUED: 'Na fila', RUNNING: 'Executando', READY_FOR_REVIEW: 'Aguardando revisão',
  VERIFIED: 'Verificado', FAILED: 'Falhou', BLOCKED: 'Bloqueado', CANCELLED: 'Cancelado',
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init });
  const body = (await res.json().catch(() => null)) as { error?: string } & T;
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

export class DirectorRoom implements UiComponent {
  readonly button: HTMLButtonElement;
  readonly el: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly objective: HTMLTextAreaElement;
  private readonly projectPath: HTMLInputElement;
  private readonly runtime: HTMLSelectElement;
  private readonly permission: HTMLSelectElement;
  private readonly role: HTMLSelectElement;
  private readonly routePolicy: HTMLSelectElement;
  private readonly model: HTMLSelectElement;
  private readonly list: HTMLElement;
  private readonly heads: HTMLElement;
  private readonly archive: HTMLElement;
  private readonly status: HTMLElement;
  private open = false;
  private orders: WorkOrder[] = [];
  private routerStatus = '';
  private selectedDepartment: { id: string; name: string; headId: string; headName: string; runtime: WorkOrderRuntime; family?: 'claude' | 'openai' | 'gemini' } | null = null;
  private readonly headActivity = new Map<string, string>();
  private workOrderEvents: EventSource | null = null;

  constructor(private readonly ctx: UiContext) {
    this.button = iconButton(ICONS.office, tr('Dinh Hokage: Giao Nhiệm vụ Ninja (WorkOrder)'), () => this.toggle(), 'ui-btn-director');
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.objective = h('textarea', { class: 'ui-director__objective', attrs: { rows: '4', maxlength: '8000', placeholder: tr('O que a equipe de IA deve fazer?') } });
    this.projectPath = h('input', { class: 'ui-director__path', attrs: { type: 'text', maxlength: '1024', 'aria-label': tr('Pasta do projeto'), placeholder: tr('Caminho absoluto do repositório/worktree') } });
    this.runtime = h('select', { class: 'ui-director__select', attrs: { 'aria-label': tr('Runtime') } });
    for (const [value, label] of [['opencode', 'OpenCode / 9Router'], ['unknown', 'Tự chọn'], ['codex', 'Codex'], ['claude', 'Claude'], ['9router', '9Router'], ['antigravity', 'Antigravity']] as const) this.runtime.append(h('option', { attrs: { value }, text: label }));
    this.permission = h('select', { class: 'ui-director__select', attrs: { 'aria-label': tr('Permissão') } });
    this.permission.append(h('option', { attrs: { value: 'READ_ONLY' }, text: tr('Somente leitura') }), h('option', { attrs: { value: 'WORKSPACE_WRITE' }, text: tr('Escrever no workspace') }));
    this.role = h('select', { class: 'ui-director__select', attrs: { 'aria-label': tr('Vai') } });
    for (const [value, label] of [['planner', 'Lập kế hoạch'], ['worker', 'Thực thi'], ['reviewer', 'Phản biện'], ['director', 'Giám đốc']] as const) this.role.append(h('option', { attrs: { value }, text: label }));
    this.routePolicy = h('select', { class: 'ui-director__select', attrs: { 'aria-label': tr('Route policy') } });
    for (const [value, label] of [['balanced-code', 'Cân bằng'], ['free-fast', 'Miễn phí nhanh'], ['deep-code', 'Suy luận sâu'], ['review-code', 'Review chéo']] as const) this.routePolicy.append(h('option', { attrs: { value }, text: label }));
    this.model = h('select', { class: 'ui-director__select', attrs: { 'aria-label': tr('Model 9Router') } });
    this.model.append(h('option', { attrs: { value: '' }, text: tr('Model: tự chọn') }));
    this.list = h('div', { class: 'ui-director__list' });
    this.heads = h('div', { class: 'ui-director__heads' });
    this.archive = h('div', { class: 'ui-director__archive' });
    this.status = h('p', { class: 'ui-director__status', role: 'status', attrs: { 'aria-live': 'polite' } });
    const submit = h('button', { class: 'ui-btn ui-director__submit', type: 'button', text: tr('Convocar reunião'), on: { click: () => void this.create() } });
    this.panel = h('section', { class: 'ui-popover ui-director', role: 'dialog', tabIndex: -1, attrs: { 'aria-label': tr('Sala do diretor'), id: 'ui-director', popover: 'auto' } },
      h('div', { class: 'ui-director__head' }, h('div', { class: 'ui-director__identity' }, h('div', { class: 'ui-director__avatar', text: 'VVC', attrs: { 'aria-label': 'Vũ Việt Cường' } }), h('strong', { text: 'Vũ Việt Cường · Giám đốc' })), h('button', { class: 'ui-btn ui-director__close', type: 'button', text: '×', attrs: { 'aria-label': tr('Fechar') }, on: { click: () => this.hide() } })),
      h('p', { class: 'ui-director__hint', text: tr('Transforme o pedido da reunião em uma tarefa rastreável.') }),
      h('p', { class: 'ui-director__scope', role: 'status', attrs: { 'aria-live': 'polite' }, text: tr('Phạm vi: toàn nhà · Trưởng phòng sẽ điều phối nhiều phòng') }),
      this.objective,
      this.projectPath,
      h('div', { class: 'ui-director__row' }, this.runtime, this.permission),
      h('div', { class: 'ui-director__row' }, this.role, this.routePolicy),
      this.model,
      h('p', { class: 'ui-director__router', role: 'status', attrs: { 'aria-live': 'polite' } }),
      submit,
      this.status,
      h('h3', { class: 'ui-director__title', text: tr('WorkOrders recentes') }),
      this.list,
      h('h3', { class: 'ui-director__title', text: tr('Trưởng phòng') }),
      this.heads,
      h('h3', { class: 'ui-director__title', text: tr('Kho lưu trữ') }),
      this.archive,
    );
    this.el = h('div', { class: 'ui-director-root' }, this.panel);
  }

  toggle(): void { this.open ? this.hide() : this.show(); }
  show(): void { this.open = true; if (typeof this.panel.showPopover === 'function') this.panel.showPopover(); else this.panel.classList.add('is-open'); void this.refresh(); if (!this.workOrderEvents) { this.workOrderEvents = new EventSource('/api/work-orders/stream'); this.workOrderEvents.addEventListener('work-order', (raw) => { try { const event = JSON.parse((raw as MessageEvent).data) as { type?: string; payload?: { headId?: string } }; const head = event.payload?.headId; if (head) this.headActivity.set(head, event.type === 'HEAD_ASSIGNED' ? 'đang nhận việc' : event.type === 'WORKER_STARTED' ? 'đang điều phối' : event.type === 'WORKER_FINISHED' || event.type === 'WORKER_CANCELLED' ? 'đã về phòng' : 'đang xử lý'); } catch { /* keep status text authoritative */ } void this.refresh(); }); this.workOrderEvents.onerror = () => undefined; } this.objective.focus(); }
  hide(): void { this.open = false; if (typeof this.panel.hidePopover === 'function' && this.panel.matches(':popover-open')) this.panel.hidePopover(); this.panel.classList.remove('is-open'); this.workOrderEvents?.close(); this.workOrderEvents = null; }
  render(): void { this.button.classList.toggle('is-on', this.open); setHidden(this.panel, !this.open && typeof this.panel.showPopover !== 'function'); this.renderList(); }

  private async refresh(): Promise<void> {
    try {
      const [body, catalog, departmentBody, conversationBody] = await Promise.all([
        api<{ workOrders: WorkOrder[] }>('/api/work-orders'),
        api<{ health: string; models: Array<{ modelId: string; costClass: string; quotaState: string }> }>('/api/router/catalog'),
        api<{ departments: Array<{ id: string; name: string; roomId: string; headId: string; headName: string; headSymbol: string; headColor: string; health: string; model?: string; activeWorkOrders: number }> }>('/api/departments'),
        api<{ conversations: Array<{ id: string; title: string; status: string; updatedAt: number; headId?: string; projectPath?: string; messages?: Array<{ role: string; text: string }> }> }>('/api/conversations'),
      ]);
      this.orders = Array.isArray(body.workOrders) ? body.workOrders : [];
      this.model.replaceChildren(h('option', { attrs: { value: '' }, text: tr('Model: tự chọn') }), ...((catalog.models ?? []).slice(0, 100).map((m) => h('option', { attrs: { value: m.modelId }, text: `${m.modelId} · ${m.costClass}/${m.quotaState}` }))));
      this.routerStatus = `${catalog.health} · ${catalog.models?.length ?? 0} model · quota unknown nếu router không công bố`;
      const routerEl = this.panel.querySelector('.ui-director__router'); if (routerEl) setText(routerEl, this.routerStatus);
      this.heads.replaceChildren(...(departmentBody.departments ?? []).map((d) => {
        const runtime: WorkOrderRuntime = d.id === 'claude' ? 'claude' : d.id === 'codex' ? 'codex' : d.id === 'gemini-antigravity' ? 'antigravity' : d.id === 'opencode-9router' ? 'opencode' : 'unknown';
        const family = d.id === 'claude' ? 'claude' : d.id === 'codex' ? 'openai' : d.id === 'gemini-antigravity' ? 'gemini' : undefined;
        const activity = this.headActivity.get(d.headId) ?? 'ở phòng';
        return h('button', { class: `ui-director__head-card${this.selectedDepartment?.id === d.id ? ' is-selected' : ''}${activity !== 'ở phòng' && activity !== 'đã về phòng' ? ' is-moving' : ''}`, type: 'button', attrs: { 'aria-pressed': this.selectedDepartment?.id === d.id ? 'true' : 'false' }, on: { click: () => this.selectDepartment({ id: d.id, name: d.name, headId: d.headId, headName: d.headName, runtime, family }) } }, h('div', { class: 'ui-director__head-row' }, h('span', { class: 'ui-director__head-icon', text: d.headSymbol, attrs: { 'aria-label': d.headName, title: d.headName }, style: `background:${d.headColor}` }), h('div', {}, h('strong', { text: d.name }), h('small', { text: `Trưởng phòng: ${d.headName}` }))), h('small', { class: 'ui-director__head-meta', text: `Phòng vật lý: ${d.roomId} · ${d.health} · ${d.model ?? 'model chưa chọn'} · ${d.activeWorkOrders} task · ${activity}` }));
      }));
      this.archive.replaceChildren(...(conversationBody.conversations ?? []).slice(0, 8).map((c) => h('div', { class: 'ui-director__archive-item' }, h('strong', { text: c.title }), h('small', { text: `${c.status}${c.messages?.length ? ` · ${c.messages.length} tin nhắn` : ''}` }), c.messages?.at(-1) ? h('p', { text: c.messages.at(-1)!.text }) : null)));
      this.renderList();
    }
    catch (error) { setText(this.status, (error as Error).message); }
  }

  private selectDepartment(department: { id: string; name: string; headId: string; headName: string; runtime: WorkOrderRuntime; family?: 'claude' | 'openai' | 'gemini' }): void {
    this.selectedDepartment = department.id === 'director' || department.id === 'archive' || department.id === 'review' ? null : department;
    if (this.selectedDepartment) this.runtime.value = this.selectedDepartment.runtime;
    const scope = this.panel.querySelector('.ui-director__scope');
    if (scope) setText(scope, this.selectedDepartment ? `Phạm vi: ${this.selectedDepartment.name} · ${this.selectedDepartment.headName} · AI riêng của phòng` : tr('Phạm vi: toàn nhà · Trưởng phòng sẽ điều phối nhiều phòng'));
  }

  private async create(): Promise<void> {
    const objective = this.objective.value.trim();
    if (!objective) { setText(this.status, tr('Escreva o pedido da reunião.')); this.objective.focus(); return; }
    const projectPath = this.projectPath.value.trim();
    setText(this.status, tr('Registrando a reunião…'));
    try {
      const selectedModel = this.model.value || undefined;
      const inferredFamily = selectedModel?.split('/').at(-1)?.toLowerCase().startsWith('claude') ? 'claude' : selectedModel?.split('/').at(-1)?.toLowerCase().startsWith('gemini') ? 'gemini' : selectedModel ? 'openai' : undefined;
      const conversations = await api<{ conversations: Array<{ id: string; headId?: string; projectPath?: string; updatedAt: number }> }>('/api/conversations');
      const conversationId = this.selectedDepartment ? conversations.conversations.filter((c) => c.headId === this.selectedDepartment!.headId && (!c.projectPath || c.projectPath === projectPath)).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id : undefined;
      const created = await api<{ workOrder: WorkOrder }>('/api/work-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objective, projectPath, ...(conversationId ? { conversationId } : {}), requestedRuntime: this.selectedDepartment?.runtime ?? this.runtime.value as WorkOrderRuntime, permissionMode: this.permission.value as WorkOrderPermission, role: this.role.value as WorkOrderRole, routePolicy: this.routePolicy.value as RoutePolicy, requestedModel: selectedModel, ...(this.selectedDepartment ? { coordinationMode: 'department', departmentId: this.selectedDepartment.id, servedFamily: this.selectedDepartment.family ?? inferredFamily } : { coordinationMode: 'global' }) }) });
      let routeNote = '';
      try {
        await api(`/api/work-orders/${encodeURIComponent(created.workOrder.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'select-route', modelId: this.model.value || undefined, policy: this.routePolicy.value, role: this.role.value }) });
        routeNote = tr(' Route selecionada; worker ainda não iniciado.');
      } catch (routeError) {
        routeNote = ` ${tr('Route bloqueada')}: ${(routeError as Error).message}`;
      }
      this.objective.value = ''; setText(this.status, `${tr('Reunião registrada.')} ${routeNote}`); await this.refresh();
    } catch (error) { setText(this.status, (error as Error).message); }
  }

  private async action(id: string, action: 'start' | 'cancel'): Promise<void> {
    const order = this.orders.find((item) => item.id === id);
    if (!order) return;
    if (action === 'start') {
      const warnings = [];
      if (order.routeDecision?.modelId.startsWith('ag/')) warnings.push(tr('Usar uma sessão Antigravity via 9Router pode entrar em conflito com os termos do fornecedor e oferece risco à conta.'));
      if (order.routeDecision?.costClass === 'unknown' || order.routeDecision?.quotaState === 'unknown') warnings.push(tr('Custo ou quota desta rota não foi verificado. Modelos de API paga permanecem bloqueados.'));
      if (order.permissionMode === 'WORKSPACE_WRITE') warnings.push(tr('OpenCode vai aprovar automaticamente as ferramentas, inclusive comandos de terminal. Isso não é um sandbox do sistema e pode afetar arquivos fora do repositório. Continue apenas em um repositório confiável.'));
      if (warnings.length && !window.confirm(warnings.join('\n\n'))) return;
    }
    setText(this.status, action === 'start' ? tr('Iniciando agente…') : tr('Cancelando agente…'));
    try {
      await api(`/api/work-orders/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...(action === 'start' ? { confirmWorkspaceWrite: order.permissionMode === 'WORKSPACE_WRITE', confirmUnknownCostOrQuota: order.routeDecision?.costClass === 'unknown' || order.routeDecision?.quotaState === 'unknown', confirmAntigravityAccountSession: order.routeDecision?.modelId.startsWith('ag/') } : {}) }) });
      setText(this.status, action === 'start' ? tr('Agente iniciado.') : tr('Agente cancelado.'));
      await this.refresh();
    } catch (error) { setText(this.status, (error as Error).message); }
  }

  private async requestApproval(id: string): Promise<void> {
    setText(this.status, 'Tạo yêu cầu duyệt commit…');
    try {
      const order = this.orders.find((item) => item.id === id);
      await api(`/api/work-orders/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request-approval', kind: 'commit', evidenceRefs: order?.evidenceRefs ?? [] }) });
      setText(this.status, 'Đã ghi yêu cầu duyệt commit. Chưa commit.');
      await this.refresh();
    } catch (error) { setText(this.status, (error as Error).message); }
  }

  private renderList(): void {
    this.list.replaceChildren(...this.orders.slice(0, 12).map((order) => {
      const controls = order.status === 'PLANNED' && order.routeDecision && order.requestedRuntime === 'opencode' && order.projectPath
        ? h('button', { class: 'ui-btn ui-director__action', type: 'button', text: tr('Iniciar'), on: { click: () => void this.action(order.id, 'start') } })
        : order.status === 'QUEUED' || order.status === 'RUNNING'
          ? h('button', { class: 'ui-btn ui-director__action', type: 'button', text: tr('Cancelar'), on: { click: () => void this.action(order.id, 'cancel') } })
          : order.status === 'VERIFIED' && !order.approvals?.some((approval) => approval.kind === 'commit' && approval.status === 'pending')
            ? h('button', { class: 'ui-btn ui-director__action', type: 'button', text: 'Xin duyệt commit', on: { click: () => void this.requestApproval(order.id) } })
            : null;
      const route = order.execution
        ? tr('Modelo pedido: {0} · servido: {1}', [order.execution.requestedModel, order.execution.servedModel])
        : order.routeDecision?.modelId ?? order.requestedModel;
      const taskSummary = order.tasks?.length ? order.tasks.map((task) => `W${task.wave} ${task.taskId}: ${task.status}${task.servedModel !== 'unknown' ? ` · ${task.servedModel}` : ''}`).join('\n') : '';
      const reviewSummary = order.reviews?.length ? `Review: ${order.reviews.map((review) => review.verdict).join(', ')}` : '';
      const approvalSummary = order.approvals?.length ? `Approval: ${order.approvals.map((approval) => `${approval.kind}/${approval.status}`).join(', ')}` : '';
      return h('article', { class: 'ui-director__item' }, h('strong', { text: STATUS_LABEL[order.status] ?? order.status }), h('p', { text: order.objective }), h('small', { text: `${order.departmentId ?? 'chưa gán phòng'} · ${order.headId ?? 'chưa gán trưởng phòng'} · ${order.requestedRuntime} · ${order.permissionMode}${order.execution ? ` · ${order.execution.status}` : ''}${route ? ` · ${route}` : ''}` }), taskSummary ? h('pre', { class: 'ui-director__tasks', text: taskSummary }) : null, reviewSummary ? h('small', { text: reviewSummary }) : null, approvalSummary ? h('small', { text: approvalSummary }) : null, order.blocker ? h('p', { class: 'ui-director__blocker', text: order.blocker }) : null, order.report ? h('pre', { class: 'ui-director__report', text: order.report }) : null, controls);
    }));
    if (!this.orders.length) this.list.append(h('p', { class: 'ui-director__empty', text: tr('Nenhuma reunião registrada.') }));
  }
}
