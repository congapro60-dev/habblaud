import { DEPARTMENT_HEADS, type DepartmentId, type DepartmentInfo } from '../shared/departments';
import { RouterService } from './router';
import type { WorkOrder, WorkOrderRuntime } from '../shared/work-orders';

const BASE: ReadonlyArray<Omit<DepartmentInfo, 'health' | 'route' | 'model' | 'activeWorkOrders' | 'checkedAt'>> = [
  { id: 'director', roomId: 'core:lounge', headId: DEPARTMENT_HEADS.director.id, headName: DEPARTMENT_HEADS.director.name, headSymbol: DEPARTMENT_HEADS.director.symbol, headColor: DEPARTMENT_HEADS.director.color, name: 'Dinh Hokage (Tổng bộ) ⛩️', providerFamily: 'Habblaud', defaultRole: 'director' },
  { id: 'claude', roomId: 'core:claude', headId: DEPARTMENT_HEADS.claude.id, headName: DEPARTMENT_HEADS.claude.name, headSymbol: DEPARTMENT_HEADS.claude.symbol, headColor: DEPARTMENT_HEADS.claude.color, name: 'Làng Lá (Konoha) 🍃', providerFamily: 'Claude', defaultRole: 'planner' },
  { id: 'codex', roomId: 'core:codex', headId: DEPARTMENT_HEADS.codex.id, headName: DEPARTMENT_HEADS.codex.name, headSymbol: DEPARTMENT_HEADS.codex.symbol, headColor: DEPARTMENT_HEADS.codex.color, name: 'Làng Cát (Sunagakure) ⏳', providerFamily: 'OpenAI', defaultRole: 'worker' },
  { id: 'gemini-antigravity', roomId: 'core:gemini', headId: DEPARTMENT_HEADS['gemini-antigravity'].id, headName: DEPARTMENT_HEADS['gemini-antigravity'].name, headSymbol: DEPARTMENT_HEADS['gemini-antigravity'].symbol, headColor: DEPARTMENT_HEADS['gemini-antigravity'].color, name: 'Làng Đá (Iwagakure) 🪨', providerFamily: 'Gemini', defaultRole: 'planner' },
  { id: 'opencode-9router', roomId: 'core:opencode', headId: DEPARTMENT_HEADS['opencode-9router'].id, headName: DEPARTMENT_HEADS['opencode-9router'].name, headSymbol: DEPARTMENT_HEADS['opencode-9router'].symbol, headColor: DEPARTMENT_HEADS['opencode-9router'].color, name: 'Làng Sương (Kirigakure) 🌫️', providerFamily: 'OpenCode', defaultRole: 'worker' },
  { id: 'review', roomId: 'core:review', headId: DEPARTMENT_HEADS.review.id, headName: DEPARTMENT_HEADS.review.name, headSymbol: DEPARTMENT_HEADS.review.symbol, headColor: DEPARTMENT_HEADS.review.color, name: 'Làng Mây (Kumogakure) ⚡', providerFamily: 'Cross-provider', defaultRole: 'reviewer' },
  { id: 'archive', roomId: 'core:archive', headId: DEPARTMENT_HEADS.archive.id, headName: DEPARTMENT_HEADS.archive.name, headSymbol: DEPARTMENT_HEADS.archive.symbol, headColor: DEPARTMENT_HEADS.archive.color, name: 'Thư viện Bí thuật 📜', providerFamily: 'Habblaud', defaultRole: 'archive' },
];

const ACTIVE = new Set<WorkOrder['status']>(['PLANNED', 'QUEUED', 'RUNNING', 'READY_FOR_REVIEW']);

export function headIdFor(departmentId: DepartmentId): string {
  return DEPARTMENT_HEADS[departmentId].id;
}

export function departmentForRuntime(runtime: WorkOrderRuntime, role: WorkOrder['role'] = 'worker'): DepartmentId {
  if (role === 'director') return 'director';
  if (role === 'reviewer') return 'review';
  if (runtime === 'claude') return 'claude';
  if (runtime === 'codex') return 'codex';
  if (runtime === 'antigravity') return 'gemini-antigravity';
  if (runtime === 'opencode' || runtime === '9router') return 'opencode-9router';
  return role === 'planner' ? 'claude' : 'opencode-9router';
}

export function departmentSnapshot(router: RouterService, orders: readonly Pick<WorkOrder, 'departmentId' | 'status'>[] = [], now = Date.now()): DepartmentInfo[] {
  const catalog = router.snapshot();
  const active = new Map<DepartmentId, number>();
  for (const order of orders) if (order.departmentId && ACTIVE.has(order.status)) active.set(order.departmentId, (active.get(order.departmentId) ?? 0) + 1);
  return BASE.map((item) => {
    if (item.id === 'opencode-9router') {
      const model = catalog.models[0];
      return { ...item, health: catalog.health === 'ok' ? 'available' : 'unknown', route: catalog.baseUrl, model: model?.modelId, activeWorkOrders: active.get(item.id) ?? 0, checkedAt: catalog.checkedAt ?? now };
    }
    if (item.id === 'archive') return { ...item, health: 'available', activeWorkOrders: 0, checkedAt: now };
    if (item.id === 'director') return { ...item, health: 'available', activeWorkOrders: active.get(item.id) ?? 0, checkedAt: now };
    return { ...item, health: 'unknown', activeWorkOrders: active.get(item.id) ?? 0, checkedAt: now };
  });
}
