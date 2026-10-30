// Lõi Chibi Battle Royale — Thế giới Ninja: thuần TS, không DOM, không mạng, không Habblaud World.
// Trận đấu là "show" cục bộ (docs/spec/chibi-battle-royale.md §0): không đổi trạng thái agent thật,
// không đọc file, không gọi mạng. Cùng seed → cùng diễn biến (deterministic).
import { hash32 } from '../../../../shared/hash';
import type { AppearanceParts } from '../../../../shared/appearance';
import { tr } from '../../../../shared/i18n';

/** Kỹ năng (jutsu) của nhẫn giả. */
export type Jutsu = 'shuriken' | 'fireball' | 'summon' | 'shadow-clone' | 'substitution' | 'focus';

/** Một nhẫn giả tham dự. */
export interface Fighter {
  /** Id của agent thật (chỉ để nhận diện nhân vật trên sân). */
  readonly id: string;
  /** Tên hiển thị (tên nhân vật đã có trong Sim). */
  readonly name: string;
  /** Ký hiệu 2 chữ trên băng đô. */
  readonly symbol: string;
  /** Family để suy ra làng (claude/codex/…). */
  readonly family: string;
  /** Seed cá nhân: cùng agent luôn ra cùng nhẫn giả. */
  readonly seed: number;
  /** Ngoại hình thật trong văn phòng — cho sprite pixel trong scene (thuần hiển thị). */
  readonly look?: 'f' | 'm';
  readonly parts?: AppearanceParts;
}

/** Diễn biến một đòn trong vòng đấu. */
export interface Strike {
  readonly round: number;
  readonly attacker: string;
  readonly defender: string;
  readonly jutsu: Jutsu;
  /** Tổng sát thương lên defender (0 nếu focus/nhân thân thất bại/bị Thân Thế Thân). */
  readonly damage: number;
  readonly hpAfter: number;
  /** Bị Thân Thế Thân: đòn bị vô hiệu, defender phản đòn. */
  readonly negated: boolean;
  /** Máu của attacker sau phản đòn (chỉ khi negated). */
  readonly attackerHpAfter?: number;
  /** Đòn Hỏa Đạn trúng: defender bắt đầu cháy. */
  readonly burnSet: boolean;
  /** Triệu hồi thất bại. */
  readonly failed: boolean;
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
const MAX_ROUNDS = 40;
const MAX_FIGHTERS = 8;
const MIN_FIGHTERS = 3;

const JUTSU_CHANCE: Readonly<Record<Jutsu, number>> = {
  shuriken: 0.28,
  fireball: 0.2,
  summon: 0.12,
  'shadow-clone': 0.14,
  substitution: 0.13,
  focus: 0.13,
};
const SHURIKEN_DMG = 8;
const FIREBALL_DMG = 18;
const FIREBALL_BURN_TURNS = 2;
const BURN_DMG = 4;
const SUMMON_DMG = 26;
const SUMMON_FAIL_CHANCE = 0.3;
const CLONE_HITS = 2;
const CLONE_DMG = 7;
const COUNTER_DMG = 6;
const CHAMPION_COINS = 50;
const ENTRY_COINS = 10;

/** Một làng ninja: engine/provider sinh sống ở đó (spec §0). */
export interface Village {
  readonly name: string;
  readonly emoji: string;
  /** Màu băng đô của làng. */
  readonly color: string;
}

const VILLAGES: Readonly<Record<string, Village>> = {
  claude: { name: 'Làng Lá', emoji: '🍃', color: '#3f7a3f' },
  codex: { name: 'Làng Cát', emoji: '⏳', color: '#c2a24a' },
  opencode: { name: 'Làng Sương', emoji: '🌫️', color: '#5b7fa6' },
  'gemini-antigravity': { name: 'Làng Đá', emoji: '🪨', color: '#8a6a4a' },
};
const GRASS_VILLAGE: Village = { name: 'Làng Cỏ', emoji: '🌿', color: '#4d9970' };

/** Làng của một engine/provider (mặc định claude = Làng Lá, đúng chuẩn AgentInfo). */
export function villageOf(family: string): Village {
  return VILLAGES[family] ?? GRASS_VILLAGE;
}

export class BattleRoyale {
  private readonly hp = new Map<string, number>();
  private readonly chakra = new Map<string, number>();
  private readonly substitution = new Set<string>();
  private readonly burn = new Map<string, number>();
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
    this.log.push(tr('A arena abre com {0} ninjas', [String(this.fighters.length)]));
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

  /** Một vòng: mỗi nhẫn giả còn sống ra đòn một lần (thứ tự xáo theo seed). */
  private runRound(round: number): void {
    const order = this.alive();
    this.shuffle(order, round);
    const roundStrikes: Strike[] = [];
    for (const attacker of order) {
      // Cháy dai: mất máu trước khi ra đòn.
      const burning = this.burn.get(attacker.id) ?? 0;
      if (burning > 0) {
        this.burn.set(attacker.id, burning - 1);
        this.damage(attacker.id, BURN_DMG);
        this.log.push(tr('{0} está queimando ({1} de dano)', [attacker.name, String(BURN_DMG)]));
        if (this.hp.get(attacker.id)! <= 0) continue;
      }
      const targets = this.alive().filter((c) => c.id !== attacker.id);
      if (!targets.length) break;
      const defender = targets[hash32(defSeed(this.seed, round, attacker.id)) % targets.length];
      const strike = this.strike(round, attacker, defender);
      this.strikes.push(strike);
      roundStrikes.push(strike);
      if (strike.hpAfter <= 0) this.log.push(tr('{0} cai na arena! {1} vence o duelo', [defender.name, attacker.name]));
    }
    const eliminated = this.fighters
      .filter((f) => this.hp.get(f.id)! <= 0)
      .map((f) => f.id)
      .filter((id) => !this.rounds.some((r) => r.eliminated.includes(id)));
    this.rounds.push({ round, strikes: roundStrikes, eliminated });
  }

  private strike(round: number, attacker: Fighter, defender: Fighter): Strike {
    const jutsu = this.chooseJutsu(attacker, round);
    const bonus = this.chakra.get(attacker.id) ?? 1;
    this.chakra.delete(attacker.id);
    const base = { round, attacker: attacker.id, defender: defender.id, jutsu, negated: false, burnSet: false, failed: false };

    // Thân Thế Thân của defender: vô hiệu đòn + phản đòn.
    if (jutsu !== 'focus' && this.substitution.delete(defender.id)) {
      this.damage(attacker.id, COUNTER_DMG);
      this.log.push(tr('{0} usou Substituição e contra-atacou {1}', [defender.name, attacker.name]));
      const strike: Strike = { ...base, damage: 0, hpAfter: this.hp.get(defender.id)!, negated: true, attackerHpAfter: this.hp.get(attacker.id)! };
      if (this.hp.get(attacker.id)! <= 0 && !this.fallen.includes(attacker.id)) this.fallen.push(attacker.id);
      return strike;
    }

    switch (jutsu) {
      case 'focus': {
        this.chakra.set(attacker.id, 2);
        this.log.push(tr('{0} concentra chakra para o próximo golpe', [attacker.name]));
        return { ...base, damage: 0, hpAfter: this.hp.get(defender.id)! };
      }
      case 'substitution': {
        this.substitution.add(attacker.id);
        this.log.push(tr('{0} prepara o Substituição', [attacker.name]));
        return { ...base, damage: 0, hpAfter: this.hp.get(defender.id)! };
      }
      case 'shuriken': {
        const damage = Math.round(SHURIKEN_DMG * bonus);
        return this.hit(base, attacker, defender, damage, false);
      }
      case 'fireball': {
        const damage = Math.round(FIREBALL_DMG * bonus);
        const strike = this.hit(base, attacker, defender, damage, true);
        if (!strike.negated) {
          this.burn.set(defender.id, FIREBALL_BURN_TURNS);
          this.log.push(tr('{0} está queimando', [defender.name]));
        }
        return { ...strike, burnSet: !strike.negated };
      }
      case 'shadow-clone': {
        const perHit = Math.round(CLONE_DMG * bonus);
        const strike1 = this.hit(base, attacker, defender, perHit, false);
        if (strike1.negated || this.hp.get(defender.id)! <= 0) return strike1;
        const strike2 = this.hit(base, attacker, defender, perHit, false);
        this.log.push(tr('{0} ataca com clones das sombras ({1} de dano)', [attacker.name, String(strike2.damage)]));
        return { ...strike2, damage: strike1.damage + strike2.damage, hpAfter: strike2.hpAfter };
      }
      case 'summon': {
        if (hash32(sumSeed(this.seed, round, attacker.id)) % 100 < SUMMON_FAIL_CHANCE * 100) {
          this.log.push(tr('A invocação de {0} falhou!', [attacker.name]));
          return { ...base, damage: 0, hpAfter: this.hp.get(defender.id)!, failed: true };
        }
        const damage = Math.round(SUMMON_DMG * bonus);
        this.log.push(tr('{0} invoca o espírito da aldeia', [attacker.name]));
        return this.hit(base, attacker, defender, damage, false);
      }
    }
  }

  /** Gây một lượng sát thương lên defender; trả Strike đã cập nhật. */
  private hit(base: Omit<Strike, 'damage' | 'hpAfter'>, attacker: Fighter, defender: Fighter, damage: number, _burn: boolean): Strike {
    this.damage(defender.id, damage);
    if (this.hp.get(defender.id)! <= 0 && !this.fallen.includes(defender.id)) this.fallen.push(defender.id);
    return { ...base, damage, hpAfter: this.hp.get(defender.id)! };
  }

  private damage(id: string, amount: number): void {
    this.hp.set(id, Math.max(0, this.hp.get(id)! - amount));
  }

  private chooseJutsu(fighter: Fighter, round: number): Jutsu {
    const roll = (hash32(jutsuSeed(this.seed, round, fighter.id)) % 10_000) / 10_000;
    let acc = 0;
    for (const [jutsu, chance] of Object.entries(JUTSU_CHANCE) as readonly (readonly [Jutsu, number])[]) {
      acc += chance;
      if (roll < acc) return jutsu;
    }
    return 'shuriken';
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
const jutsuSeed = (seed: number, round: number, fighter: string): string => `${seed}:${round}:jutsu:${fighter}`;
const sumSeed = (seed: number, round: number, attacker: string): string => `${seed}:${round}:sum:${attacker}`;
const ordSeed = (seed: number, round: number, i: number): string => `${seed}:${round}:ord:${i}`;
