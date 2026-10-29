// Lõi Chibi Battle Royale: thuần TS, không DOM, không mạng, không Habblaud World.
// Trận đấu là "show" cục bộ (docs/spec/chibi-battle-royale.md): không đổi trạng thái agent thật,
// không đọc file, không gọi mạng. Cùng seed → cùng diễn biến (deterministic).
import { hash32 } from '../../../../shared/hash';
import { tr } from '../../../../shared/i18n';

/** Kỹ năng của võ sĩ chibi. */
export type BattleMove = 'slash' | 'palm' | 'charge';

/** Một võ sĩ tham dự. */
export interface Fighter {
  /** Id của agent thật (chỉ để nhận diện nhân vật trên sân). */
  readonly id: string;
  /** Tên hiển thị (tên nhân vật đã có trong Sim). */
  readonly name: string;
  /** Ký hiệu 2 chữ trên badge (như CORE_HEADS). */
  readonly symbol: string;
  /** Family để chia nhóm (claude/codex/…). */
  readonly family: string;
  /** Seed cá nhân: cùng agent luôn ra cùng võ sĩ. */
  readonly seed: number;
}

/** Diễn biến một đòn trong vòng đấu. */
export interface Strike {
  readonly round: number;
  readonly attacker: string;
  readonly defender: string;
  readonly move: BattleMove;
  readonly damage: number;
  /** `palm` có thể gây choáng: defender bỏ lượt sau. */
  readonly stunned: boolean;
  readonly hpAfter: number;
}

/** Kết quả một vòng: các đòn đã đánh theo thứ tự và ai bị loại. */
export interface BattleRound {
  readonly round: number;
  readonly strikes: readonly Strike[];
  readonly eliminated: readonly string[];
}

/** Kết quả toàn trận. */
export interface BattleResult {
  readonly fighters: readonly Fighter[];
  readonly rounds: readonly BattleRound[];
  /** Đúng 1 nhà vô địch (người sống cuối, hoặc người gục sau nếu cùng gục). */
  readonly champion: Fighter;
  /** Thưởng xu cục bộ (show): nạp vào ví hay không do caller quyết. */
  readonly rewards: Readonly<Record<string, number>>;
  readonly log: readonly string[];
}

const MAX_HP = 100;
const MAX_ROUNDS = 30;
const MAX_FIGHTERS = 8;
const MIN_FIGHTERS = 3;

const MOVE_CHANCE = { slash: 0.5, palm: 0.3, charge: 0.2 } as const;
const PALM_STUN_CHANCE = 0.25;
const CHAMPION_COINS = 50;
const ENTRY_COINS = 10;

export class BattleRoyale {
  private readonly hp = new Map<string, number>();
  private readonly chargeBonus = new Map<string, number>();
  private readonly stunned = new Set<string>();
  /** Thứ tự gục ngã; nếu mọi người gục cùng lúc thì người gục sau là nhà vô địch. */
  private readonly fallen: string[] = [];
  private readonly strikes: Strike[] = [];
  private readonly rounds: BattleRound[] = [];
  private readonly log: string[] = [];
  private readonly fighters: readonly Fighter[];

  constructor(fighters: readonly Fighter[], private readonly seed: number) {
    if (fighters.length < MIN_FIGHTERS) throw new Error(tr('A arena precisa de pelo menos 3 lutadores'));
    if (fighters.length > MAX_FIGHTERS) throw new Error(tr('A arena aceita no máximo 8 lutadores'));
    const ids = new Set(fighters.map((f) => f.id));
    if (ids.size !== fighters.length) throw new Error(tr('Lutador repetido na arena'));
    this.fighters = [...fighters];
    for (const f of this.fighters) this.hp.set(f.id, MAX_HP);
    this.log.push(tr('A arena abre com {0} lutadores', [String(this.fighters.length)]));
  }

  /** Chạy tới khi có nhà vô địch. */
  run(): BattleResult {
    let round = 0;
    while (this.alive().length > 1 && round < MAX_ROUNDS) {
      round += 1;
      this.runRound(round);
    }
    const champion = this.champion(round);
    return {
      fighters: this.fighters,
      rounds: this.rounds,
      champion,
      rewards: this.rewards(champion),
      log: this.log,
    };
  }

  /** Một vòng: mỗi võ sĩ còn sống đánh một đòn vào ngẫu nhiên còn sống khác. */
  private runRound(round: number): void {
    const order = this.alive();
    this.shuffle(order, round);
    const roundStrikes: Strike[] = [];
    for (const attacker of order) {
      if (this.stunned.delete(attacker.id)) {
        this.log.push(tr('{0} está atordoado e perde a vez', [attacker.name]));
        continue;
      }
      const defenders = this.alive().filter((c) => c.id !== attacker.id);
      if (!defenders.length) break;
      const defender = defenders[hash32(defSeed(this.seed, round, attacker.id)) % defenders.length];
      const strike = this.strike(round, attacker, defender);
      this.strikes.push(strike);
      roundStrikes.push(strike);
      if (strike.hpAfter <= 0) {
        this.log.push(tr('{0} cai na arena! {1} vence o duelo', [defender.name, attacker.name]));
      }
    }
    const eliminated = this.fighters
      .filter((f) => this.hp.get(f.id)! <= 0)
      .map((f) => f.id)
      .filter((id) => !this.rounds.some((r) => r.eliminated.includes(id)));
    this.rounds.push({ round, strikes: roundStrikes, eliminated });
  }

  private strike(round: number, attacker: Fighter, defender: Fighter): Strike {
    const move = this.chooseMove(attacker, round);
    let damage = Math.round(MAX_HP * (move === 'slash' ? 0.16 : move === 'palm' ? 0.1 : 0.07));
    if (move === 'charge') {
      this.chargeBonus.set(attacker.id, 2);
      damage = 0;
    } else {
      const bonus = this.chargeBonus.get(attacker.id) ?? 1;
      damage = Math.round(damage * bonus);
      this.chargeBonus.delete(attacker.id);
    }
    const stunned = move === 'palm' && hash32(stunSeed(this.seed, round, attacker.id, defender.id)) % 100 < PALM_STUN_CHANCE * 100;
    if (damage > 0) this.hp.set(defender.id, Math.max(0, this.hp.get(defender.id)! - damage));
    if (stunned) this.stunned.add(defender.id);
    if (this.hp.get(defender.id)! <= 0 && !this.fallen.includes(defender.id)) this.fallen.push(defender.id);
    const label = move === 'slash' ? tr('{0} golpeia {1} com a espada ({2} de dano)', [attacker.name, defender.name, String(damage)])
      : move === 'palm' ? tr('{0} acerta a palma de qi em {1} ({2} de dano)', [attacker.name, defender.name, String(damage)])
      : tr('{0} acumula qi para o próximo golpe', [attacker.name]);
    this.log.push(label);
    return { round, attacker: attacker.id, defender: defender.id, move, damage, stunned, hpAfter: this.hp.get(defender.id)! };
  }

  private chooseMove(fighter: Fighter, round: number): BattleMove {
    const roll = (hash32(moveSeed(this.seed, round, fighter.id)) % 10_000) / 10_000;
    if (roll < MOVE_CHANCE.slash) return 'slash';
    if (roll < MOVE_CHANCE.slash + MOVE_CHANCE.palm) return 'palm';
    return 'charge';
  }

  /**
   * Nhà vô địch: người sống cuối; nếu cả hai gục cùng lúc thì người gục sau; nếu chạm giới hạn
   * vòng thì ai máu nhiều nhất (hòa thì id nhỏ hơn — để deterministic).
   */
  private champion(round: number): Fighter {
    const byId = (id: string): Fighter => this.fighters.find((f) => f.id === id)!;
    const alive = this.alive();
    if (alive.length === 1) return alive[0];
    if (alive.length === 0 && this.fallen.length) return byId(this.fallen[this.fallen.length - 1]);
    if (round >= MAX_ROUNDS) {
      const best = [...alive].sort((a, b) => this.hp.get(b.id)! - this.hp.get(a.id)! || a.id.localeCompare(b.id));
      return best[0];
    }
    throw new Error(tr('A arena terminou sem campeão'));
  }

  private rewards(champion: Fighter): Readonly<Record<string, number>> {
    const rewards: Record<string, number> = {};
    for (const f of this.fighters) rewards[f.id] = f.id === champion.id ? CHAMPION_COINS : ENTRY_COINS;
    return rewards;
  }

  private alive(): Fighter[] {
    return this.fighters.filter((f) => this.hp.get(f.id)! > 0);
  }

  private shuffle<T>(list: T[], round: number): void {
    for (let i = list.length - 1; i > 0; i--) {
      const j = hash32(ordSeed(this.seed, round, i)) % (i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
}

const defSeed = (seed: number, round: number, attacker: string): string => `${seed}:${round}:def:${attacker}`;
const stunSeed = (seed: number, round: number, attacker: string, defender: string): string => `${seed}:${round}:stun:${attacker}:${defender}`;
const moveSeed = (seed: number, round: number, fighter: string): string => `${seed}:${round}:move:${fighter}`;
const ordSeed = (seed: number, round: number, i: number): string => `${seed}:${round}:ord:${i}`;
