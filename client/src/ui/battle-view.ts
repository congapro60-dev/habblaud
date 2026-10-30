// Cầu thuần giữa lõi đấu trường (world/battle/core.ts) và UI: chọn võ sĩ từ snapshot văn phòng
// và dựng timeline máu theo vòng. Không DOM, không hẹn giờ — test được.
import { hash32 } from '../../../shared/hash';
import { tr } from '../../../shared/i18n';
import type { AgentInfo } from '../../../shared/types';
import type { BattleResult, Fighter } from '../world/battle/core';

const MAX_FIGHTERS = 8;
const MIN_FIGHTERS = 3;

/** Máu còn lại của mỗi võ sĩ sau mỗi vòng (và máu khởi điểm ở phần tử -1). */
export type HpTimeline = Readonly<Record<string, readonly number[]>>;

/** Chọn võ sĩ từ agents: ưu tiên người đang rảnh; đủ 3..8 người thì mới đấu được. */
export function pickFighters(agents: readonly AgentInfo[]): Fighter[] {
  const idle = agents.filter((a) => a.status === 'idle');
  const present = agents.filter((a) => a.status !== 'offline');
  const pool = idle.length >= MIN_FIGHTERS ? idle : present;
  return pool.slice(0, MAX_FIGHTERS).map((a) => ({
    id: a.id,
    name: a.name,
    symbol: a.name.slice(0, 2).toUpperCase(),
    family: a.engine ?? 'agent',
    seed: hash32(a.id),
  }));
}

/** Có đủ người để mở đấu trường không. */
export function canFight(agents: readonly AgentInfo[]): boolean {
  return pickFighters(agents).length >= MIN_FIGHTERS;
}

/** Máu sau từng vòng cho mỗi võ sĩ, theo thứ tự vòng 1..N (máu khởi điểm không gồm). */
export function hpTimeline(result: BattleResult): HpTimeline {
  const timeline: Record<string, number[]> = {};
  for (const f of result.fighters) timeline[f.id] = [];
  let hp: Record<string, number> = {};
  for (const f of result.fighters) hp[f.id] = 100;
  for (const round of result.rounds) {
    for (const strike of round.strikes) hp[strike.defender] = strike.hpAfter;
    for (const f of result.fighters) timeline[f.id].push(hp[f.id]);
  }
  return timeline;
}

/** Nhãn vòng đấu cho log UI (qua tr(), nguồn PT). */
export function roundLabel(round: number, total: number): string {
  return tr('Rodada {0} de {1}', [String(round), String(total)]);
}

/** Avatar chibi theo family (emoji, không cần art mới). */
export function familyEmoji(family: string): string {
  switch (family) {
    case 'claude': return '⚔️';
    case 'codex': return '🥷';
    case 'opencode': return '🧙';
    case 'gemini-antigravity': return '✨';
    default: return '🥋';
  }
}
