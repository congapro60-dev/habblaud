import { LOCAL_DEPARTMENT_HEADS } from './local-character-roster';

export const DEPARTMENT_IDS = ['director', 'claude', 'codex', 'gemini-antigravity', 'opencode-9router', 'review', 'archive'] as const;
export type DepartmentId = (typeof DEPARTMENT_IDS)[number];
export type DepartmentHealth = 'available' | 'unknown' | 'blocked';

/** Stable identity shown in the building and stored on a WorkOrder. */
export const DEPARTMENT_HEADS: Readonly<Record<DepartmentId, { id: string; name: string; symbol: string; color: string }>> = {
  director: { id: 'head:vvc', name: 'Vũ Việt Cường (Hokage)', symbol: '🔥', color: '#dc2626' },
  claude: { id: 'head:claude', name: LOCAL_DEPARTMENT_HEADS.claude.name, symbol: '🍃', color: '#16a34a' },
  codex: { id: 'head:codex', name: LOCAL_DEPARTMENT_HEADS.codex.name, symbol: '⏳', color: '#d97706' },
  'gemini-antigravity': { id: 'head:antigravity', name: LOCAL_DEPARTMENT_HEADS['gemini-antigravity'].name, symbol: '🪨', color: '#78716c' },
  'opencode-9router': { id: 'head:opencode-9router', name: LOCAL_DEPARTMENT_HEADS['opencode-9router'].name, symbol: '🌫️', color: '#0891b2' },
  review: { id: 'head:review', name: LOCAL_DEPARTMENT_HEADS.review.name, symbol: '⚡', color: '#eab308' },
  archive: { id: 'head:archive', name: LOCAL_DEPARTMENT_HEADS.archive.name, symbol: '📜', color: '#475569' },
};

export interface DepartmentInfo {
  id: DepartmentId;
  name: string;
  /** Physical room id. Conversation/project rooms are separate. */
  roomId: string;
  headId: string;
  headName: string;
  headSymbol: string;
  headColor: string;
  providerFamily: string;
  defaultRole: 'director' | 'planner' | 'worker' | 'reviewer' | 'archive';
  health: DepartmentHealth;
  route?: string;
  model?: string;
  activeWorkOrders: number;
  checkedAt: number;
}
