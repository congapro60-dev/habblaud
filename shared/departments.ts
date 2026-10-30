import { LOCAL_DEPARTMENT_HEADS } from './local-character-roster';

export const DEPARTMENT_IDS = ['director', 'claude', 'codex', 'gemini-antigravity', 'opencode-9router', 'review', 'archive'] as const;
export type DepartmentId = (typeof DEPARTMENT_IDS)[number];
export type DepartmentHealth = 'available' | 'unknown' | 'blocked';

/** Stable identity shown in the building and stored on a WorkOrder. */
export const DEPARTMENT_HEADS: Readonly<Record<DepartmentId, { id: string; name: string; symbol: string; color: string }>> = {
  director: { id: 'head:vvc', name: 'Vũ Việt Cường (Hokage)', symbol: 'HK', color: '#cf6b43' },
  claude: { id: 'head:claude', name: LOCAL_DEPARTMENT_HEADS.claude.name, symbol: 'TS', color: '#b77a53' },
  codex: { id: 'head:codex', name: LOCAL_DEPARTMENT_HEADS.codex.name, symbol: 'GR', color: '#4f83b7' },
  'gemini-antigravity': { id: 'head:antigravity', name: LOCAL_DEPARTMENT_HEADS['gemini-antigravity'].name, symbol: 'ON', color: '#8a71b1' },
  'opencode-9router': { id: 'head:opencode-9router', name: LOCAL_DEPARTMENT_HEADS['opencode-9router'].name, symbol: 'ME', color: '#4d9970' },
  review: { id: 'head:review', name: LOCAL_DEPARTMENT_HEADS.review.name, symbol: 'AY', color: '#b28a36' },
  archive: { id: 'head:archive', name: LOCAL_DEPARTMENT_HEADS.archive.name, symbol: 'JR', color: '#6e7785' },
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
