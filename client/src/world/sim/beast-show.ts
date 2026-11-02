// Điều phối hoá hình và triệu hồi: jinchūriki hoá vĩ thú, Uchiha mở Susanoo, thuật triệu hồi, vĩ thú và Lục Đạo Tiên Nhân
// hiện ra ngoài đường. Chỉ dàn NPC cục bộ tham gia, không bao giờ đụng tới session thật. Chạy thường xuyên, không cần chờ đại chiến.
import type { BeastKind } from '../../art/beasts';
import { BUILDING_H, COL_W, FOOT_DX, FOOT_DY, TILE } from '../constants';
import type { Character } from './character';

/** Nhân vật (theo tên) có thể hoá thành dạng nào. */
export const BEAST_FORMS: readonly { pattern: string; kind: BeastKind; label: string }[] = [
  { pattern: 'naruto', kind: 'kurama', label: 'Hoá Cửu Vĩ Kurama' },
  { pattern: 'naruto', kind: 'naruto_sixpaths', label: 'Chế Độ Lục Đạo' },
  { pattern: 'naruto', kind: 'gamabunta', label: 'Triệu Hồi Gamabunta' },
  { pattern: 'gaara', kind: 'shukaku', label: 'Hoá Nhất Vĩ Shukaku' },
  { pattern: 'killer bee', kind: 'gyuki', label: 'Hoá Bát Vĩ Gyūki' },
  { pattern: 'yugito', kind: 'matatabi', label: 'Hoá Nhị Vĩ Matatabi' },
  { pattern: 'sasuke', kind: 'susanoo_purple', label: 'Susanoo Của Sasuke' },
  { pattern: 'sasuke', kind: 'manda', label: 'Triệu Hồi Manda' },
  { pattern: 'itachi', kind: 'susanoo_red', label: 'Susanoo Của Itachi' },
  { pattern: 'madara', kind: 'susanoo_blue', label: 'Susanoo Của Madara' },
  { pattern: 'madara', kind: 'juubi', label: 'Hồi Sinh Thập Vĩ' },
  { pattern: 'obito', kind: 'juubi', label: 'Jinchūriki Thập Vĩ' },
  { pattern: 'jiraiya', kind: 'gamabunta', label: 'Triệu Hồi Gamabunta' },
  { pattern: 'tsunade', kind: 'katsuyu', label: 'Triệu Hồi Katsuyu' },
  { pattern: 'sakura', kind: 'katsuyu', label: 'Triệu Hồi Katsuyu' },
  { pattern: 'orochimaru', kind: 'manda', label: 'Triệu Hồi Manda' },
  { pattern: 'hiruzen', kind: 'enma', label: 'Triệu Hồi Hầu Vương Enma' },
];

/** Hiện ra ngoài đường, không cần người triệu hồi (dàn NPC chưa có jinchūriki của các con này). */
export const WILD_BEASTS: readonly { kind: BeastKind; label: string }[] = [
  { kind: 'isobu', label: 'Tam Vĩ Isobu' },
  { kind: 'songoku', label: 'Tứ Vĩ Son Gokū' },
  { kind: 'kokuo', label: 'Ngũ Vĩ Kokuō' },
  { kind: 'saiken', label: 'Lục Vĩ Saiken' },
  { kind: 'choumei', label: 'Thất Vĩ Chōmei' },
  { kind: 'hagoromo', label: 'Lục Đạo Tiên Nhân Hagoromo' },
];

export interface BeastEvent {
  id: number;
  kind: BeastKind;
  label: string;
  /** Người hoá hình đứng yên tại chỗ; null nếu vĩ thú tự hiện ra. */
  owner: Character | null;
  /** Chân hình (px). Có owner thì theo vị trí của owner. */
  x: number;
  y: number;
  flip: boolean;
  startAt: number;
  endAt: number;
}

/** Pha tụ chakra trước khi hình hiện ra, và thời gian mờ dần lúc kết thúc. */
export const BEAST_CHARGE_MS = 1_200;
export const BEAST_FADE_MS = 1_000;
const AMBIENT_MS = 14_000;
const FIRST_AFTER_MS = 12_000;
const GAP_MIN_MS = 28_000;
const GAP_MAX_MS = 45_000;
const MAX_IN_BATTLE = 3;
const BATTLE_GAP_PX = 220;

/** Phần của Sim mà bộ điều phối cần. */
export interface BeastShowHost {
  readonly chars: ReadonlyMap<string, Character>;
  readonly building: { readonly cols: number };
  isLocalCast(ch: Character): boolean;
  isOutdoorPatrol(ch: Character): boolean;
  isInBattle(ch: Character): boolean;
  battleActive(): boolean;
}

type Act = { form: (typeof BEAST_FORMS)[number] } | { wild: (typeof WILD_BEASTS)[number] };

export class BeastShow {
  readonly active: BeastEvent[] = [];
  private seq = 0;
  private nextAt: number | null = null;
  private bag: Act[] = [];

  constructor(
    private readonly host: BeastShowHost,
    private readonly rng: () => number = Math.random,
  ) {}

  /** Đang hoá hình: đứng yên, không chạy hành vi khác. */
  isEngaged(ch: Character): boolean {
    return this.active.some((e) => e.owner === ch);
  }

  update(now: number): void {
    if (this.nextAt === null) this.nextAt = now + FIRST_AFTER_MS;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      if (now >= e.endAt || e.owner?.gone || e.owner?.leaving) {
        this.active.splice(i, 1);
        continue;
      }
      if (e.owner) {
        e.x = e.owner.x;
        e.y = e.owner.y;
      }
    }
    if (now < this.nextAt || this.host.battleActive()) return;
    this.nextAt = now + GAP_MIN_MS + this.rng() * (GAP_MAX_MS - GAP_MIN_MS);
    this.playNext(now);
  }

  /** Vào pha giao tranh của đại chiến: tối đa vài đấu thủ cùng hoá hình tới hết pha. */
  onBattleClash(fighters: readonly Character[], now: number, until: number): void {
    // các màn đang diễn ngoài trận kết thúc ngay để người diễn về võ đài
    for (const e of this.active) e.endAt = Math.min(e.endAt, now);
    const pool = fighters.filter((c) => this.host.isLocalCast(c) && this.formsOf(c).length);
    this.shuffle(pool);
    const placed: Character[] = [];
    for (const ch of pool) {
      if (placed.length >= MAX_IN_BATTLE) break;
      // hình rất to: đứng cách nhau đủ xa để không dính vào nhau
      if (placed.some((p) => Math.abs(p.x - ch.x) < BATTLE_GAP_PX)) continue;
      placed.push(ch);
      const forms = this.formsOf(ch);
      const form = forms[Math.floor(this.rng() * forms.length)];
      this.spawn(form.kind, form.label, ch, ch.x, ch.y, now, until);
    }
  }

  private formsOf(ch: Character): (typeof BEAST_FORMS)[number][] {
    const name = (ch.info.name ?? '').toLowerCase();
    return BEAST_FORMS.filter((f) => name.includes(f.pattern));
  }

  /** Túi xáo trộn: lần lượt diễn hết mọi màn rồi mới lặp lại, nên con nào cũng được thấy. */
  private playNext(now: number): void {
    for (let tries = BEAST_FORMS.length + WILD_BEASTS.length + 1; tries > 0; tries--) {
      if (!this.bag.length) {
        this.bag = [...BEAST_FORMS.map((form) => ({ form })), ...WILD_BEASTS.map((wild) => ({ wild }))];
        this.shuffle(this.bag);
      }
      const act = this.bag.pop()!;
      if ('wild' in act) {
        const w = this.host.building.cols * COL_W;
        const x = (2 + this.rng() * Math.max(1, w - 4)) * TILE + FOOT_DX;
        // hình cao gấp đôi: đứng trong rừng phía nam để không che các phòng session
        const y = (BUILDING_H + 17) * TILE + FOOT_DY;
        this.spawn(act.wild.kind, act.wild.label, null, x, y, now, now + AMBIENT_MS);
        return;
      }
      const owner = this.eligible(act.form.pattern);
      if (!owner) continue;
      this.resetOwner(owner);
      this.spawn(act.form.kind, act.form.label, owner, owner.x, owner.y, now, now + AMBIENT_MS);
      return;
    }
  }

  private eligible(pattern: string): Character | null {
    for (const ch of this.host.chars.values()) {
      if (!this.host.isLocalCast(ch) || this.host.isOutdoorPatrol(ch) || ch.gone || ch.leaving) continue;
      if (!(ch.info.name ?? '').toLowerCase().includes(pattern)) continue;
      if (this.isEngaged(ch) || this.host.isInBattle(ch)) continue;
      if (ch.gathering && ch.gathering.phase !== 'ended') continue;
      return ch;
    }
    return null;
  }

  private resetOwner(ch: Character): void {
    // trận tỉ thí đã xong nhưng bước nhả trận nằm trong hàng đợi sắp xoá
    ch.gathering = null;
    ch.queue.length = 0;
    ch.step = null;
    ch.setPose('stand');
  }

  private spawn(kind: BeastKind, label: string, owner: Character | null, x: number, y: number, now: number, endAt: number): void {
    this.active.push({ id: ++this.seq, kind, label, owner, x, y, flip: this.rng() < 0.5, startAt: now, endAt });
  }

  private shuffle<T>(list: T[]): void {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
}
