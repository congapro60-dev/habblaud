// Bộ điều phối Màn Thi Đấu Team & Đại Chiến Nhẫn Giả Kinh Điển
import type { Sim } from './sim';
import type { Character } from './character';
import { CORRIDOR_ID } from '../layout/corridor';
import { CORRIDOR_Y } from '../constants';

export interface NinjaBattleTeamDef {
  name: string;
  color: string;
  members: string[]; // name patterns: 'naruto', 'sasuke', etc.
}

export interface NinjaWarScenario {
  id: string;
  title: string;
  subtitle: string;
  teamA: NinjaBattleTeamDef;
  teamB: NinjaBattleTeamDef;
}

export type NinjaWarPhase = 'idle' | 'rally' | 'clash' | 'victory' | 'disperse';

export interface NinjaTeamBattleState {
  scenario: NinjaWarScenario;
  phase: NinjaWarPhase;
  phaseEndsAt: number;
  winnerTeam: 'A' | 'B' | null;
  arenaCenter: { x: number; y: number };
  /** Các điểm giao chiến rải dọc hành lang: mỗi cặp đấu thủ đánh ở một điểm riêng. */
  duelSpots: { x: number; y: number }[];
  scoreA: number;
  scoreB: number;
  teamAChars: Character[];
  teamBChars: Character[];
  spectatorChars: Character[];
  nextBattleAt: number;
  /** Sổ Đen Bingo Book: Thống kê & Phong Thần Nhẫn Giả */
  bingoRecord?: {
    totalBattles: number;
    teamAWins: number;
    teamBWins: number;
    mvpName?: string;
    mvpTitle?: string;
  };
}

export const CLASSIC_SCENARIOS: readonly NinjaWarScenario[] = Object.freeze([
  {
    id: 'konoha-golden',
    title: '⚔️ ĐẠI CHIẾN KONOHA: ĐỘI 7 vs ĐỘI HUYNH ĐỆ ĐỆ NHẤT ⚔️',
    subtitle: 'Naruto, Sasuke, Sakura quyết đấu Kakashi, Maito Gai, Rock Lee!',
    teamA: {
      name: 'Đội 7 Huyền Thoại',
      color: '#ff9900',
      members: ['naruto', 'sasuke', 'sakura'],
    },
    teamB: {
      name: 'Đội Huynh Đệ Bát Môn',
      color: '#34d399',
      members: ['kakashi', 'gai', 'lee'],
    },
  },
  {
    id: 'sannin-clash',
    title: '🐸 TỬ CHIẾN TAM NIN HUYỀN THOẠI 🐍',
    subtitle: 'Đại Tiên Nhân Jiraiya & Tsunade so tài Bạch Xà Vương Orochimaru!',
    teamA: {
      name: 'Tam Nin Chính Nghĩa',
      color: '#f59e0b',
      members: ['jiraiya', 'tsunade', 'naruto'],
    },
    teamB: {
      name: 'Bạch Xà & Ám Khí',
      color: '#8b5cf6',
      members: ['orochimaru', 'sasuke', 'kabuto'],
    },
  },
  {
    id: 'akatsuki-vs-kage',
    title: '☁️ TỬ CHIẾN THẦN THÁNH: BINH ĐOÀN AKATSUKI vs LIÊN MINH NGŨ ĐẠI KAGE 🛡️',
    subtitle: 'Pain, Itachi, Kisame đối đầu Hokage Tsunade, Kazekage Gaara, Raikage Ay!',
    teamA: {
      name: 'Quân Đoàn Akatsuki',
      color: '#ef4444',
      members: ['pain', 'itachi', 'kisame'],
    },
    teamB: {
      name: 'Liên Minh Ngũ Đại Kage',
      color: '#3b82f6',
      members: ['tsunade', 'gaara', 'ay'],
    },
  },
  {
    id: 'valley-of-the-end',
    title: '🌌 THUNG LŨNG TẬN CÙNG: SENJU HASHIRAMA vs UCHIHA MADARA 🌌',
    subtitle: 'Mộc Độn Chân Thần đối đầu Susanoo Toàn Năng Thần Thoại!',
    teamA: {
      name: 'Huyền Thoại Senju & Hokage',
      color: '#10b981',
      members: ['hashirama', 'tobirama', 'minato'],
    },
    teamB: {
      name: 'Bá Chủ Thần Tộc Uchiha',
      color: '#dc2626',
      members: ['madara', 'obito', 'shisui'],
    },
  },
  {
    id: 'tailed-beast-war',
    title: '🦊 ĐẠI CHIẾN VĨ THÚ: BỘ ĐÔI HOÀN HẢO vs LIÊN MINH JINCHŪRIKI 🐙',
    subtitle: 'Cửu Vĩ Kurama & Bát Vĩ Gyūki so tài Nhất Vĩ Shukaku & Nhị Vĩ Matatabi!',
    teamA: {
      name: 'Song Sát Vĩ Thú Lá - Mây',
      color: '#f97316',
      members: ['naruto', 'bee'],
    },
    teamB: {
      name: 'Sa Mạc & Hỏa Miêu',
      color: '#6366f1',
      members: ['gaara', 'yugito'],
    },
  },
  {
    id: 'fourth-shinobi-war',
    title: '💥 ĐẠI CHIẾN NINJA THẾ GIỚI LẦN 4: LIÊN MINH vs TỔNG LỰC AKATSUKI 💥',
    subtitle: 'Toàn thể danh nhẫn cùng dốc toàn lực trong trận chiến định đoạt nhân loại!',
    teamA: {
      name: 'Đại Liên Minh Nhẫn Giả',
      color: '#06b6d4',
      members: ['naruto', 'kakashi', 'minato', 'hashirama'],
    },
    teamB: {
      name: 'Binh Đoàn Diệt Thế Uchiha',
      color: '#a855f7',
      members: ['madara', 'pain', 'itachi', 'obito'],
    },
  },
]);

/** Thời gian giữa các trận đại chiến: 3 phút (180.000 ms) */
export const BATTLE_INTERVAL_MS = 180_000;

export class NinjaWarDirector {
  private sim: Sim;
  private scenarioIndex = 0;
  private state: NinjaTeamBattleState | null = null;
  private nextBattleTime: number;
  private listeners = new Set<(state: NinjaTeamBattleState | null) => void>();
  private nextClashAct = 0;
  // Sổ đen Bingo Book: Thống kê số trận và thành tích
  private bingoStats = {
    totalBattles: 0,
    teamAWins: 0,
    teamBWins: 0,
    mvpName: 'Uzumaki Naruto',
    mvpTitle: 'Anh Hùng Làng Lá',
  };

  constructor(sim: Sim, now = Date.now()) {
    this.sim = sim;
    // Khởi đầu sau 25 giây khi mở app để người chơi kịp nhìn ngắm văn phòng trước trận đầu
    this.nextBattleTime = now + 25_000;
  }

  getState(): NinjaTeamBattleState | null {
    return this.state;
  }

  /** Nhân vật đang ở võ đài (đấu thủ hoặc khán giả) trong lúc tập kết, giao tranh, vinh danh. */
  isEngaged(ch: Character): boolean {
    const s = this.state;
    if (!s || s.phase === 'idle' || s.phase === 'disperse') return false;
    return s.teamAChars.includes(ch) || s.teamBChars.includes(ch) || s.spectatorChars.includes(ch);
  }

  getNextBattleTime(): number {
    return this.nextBattleTime;
  }

  subscribe(cb: (state: NinjaTeamBattleState | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    for (const cb of this.listeners) {
      try {
        cb(this.state);
      } catch (err) {
        console.error('[NinjaWarDirector] listener error', err);
      }
    }
  }

  /** Kích hoạt ngay một trận đấu kinh điển (thủ công hoặc theo chu kỳ 3 phút) */
  startBattle(scenarioIdOrIndex?: string | number, now = Date.now()): boolean {
    if (this.state && this.state.phase !== 'idle' && this.state.phase !== 'disperse') {
      return false; // Đang có trận đấu diễn ra
    }

    let scenario: NinjaWarScenario;
    if (typeof scenarioIdOrIndex === 'number') {
      this.scenarioIndex = Math.abs(scenarioIdOrIndex) % CLASSIC_SCENARIOS.length;
      scenario = CLASSIC_SCENARIOS[this.scenarioIndex];
    } else if (typeof scenarioIdOrIndex === 'string') {
      const found = CLASSIC_SCENARIOS.find((s) => s.id === scenarioIdOrIndex);
      scenario = found ?? CLASSIC_SCENARIOS[this.scenarioIndex % CLASSIC_SCENARIOS.length];
    } else {
      scenario = CLASSIC_SCENARIOS[this.scenarioIndex % CLASSIC_SCENARIOS.length];
      this.scenarioIndex++;
    }

    // Chỉ dàn nhân vật cục bộ (NPC ninja & trưởng phòng ảo) lên sàn. Session thật (Claude/Codex/OpenCode),
    // dù đang làm hay đang rảnh, không bao giờ bị kéo khỏi phòng — kể cả khi trùng tên với kịch bản.
    const allChars = [...this.sim.chars.values()].filter((c) => !c.gone && !c.leaving && this.sim.isLocalCast(c) && !this.sim.isOutdoorPatrol(c));
    const charMatch = (pattern: string): Character | undefined => {
      // khớp nguyên từ: 'ay' là Raikage Ay, không phải mọi tên có chữ "ay"
      const re = new RegExp(`(^|[^a-z])${pattern.toLowerCase()}([^a-z]|$)`);
      return allChars.find((c) => re.test((c.info.name ?? '').toLowerCase()));
    };

    const teamAChars: Character[] = [];
    for (const pat of scenario.teamA.members) {
      const match = charMatch(pat);
      if (match && !teamAChars.includes(match)) teamAChars.push(match);
    }

    const teamBChars: Character[] = [];
    for (const pat of scenario.teamB.members) {
      const match = charMatch(pat);
      if (match && !teamAChars.includes(match) && !teamBChars.includes(match)) teamBChars.push(match);
    }

    // Kịch bản thiếu người thì bổ sung NPC khác cho đủ (tối đa 3 vs 3)
    for (const c of allChars) {
      if (teamAChars.includes(c) || teamBChars.includes(c)) continue;
      if (teamAChars.length <= teamBChars.length && teamAChars.length < 3) teamAChars.push(c);
      else if (teamBChars.length < 3) teamBChars.push(c);
    }

    if (teamAChars.length === 0 && teamBChars.length > 1) {
      const moved = teamBChars.pop();
      if (moved) teamAChars.push(moved);
    } else if (teamBChars.length === 0 && teamAChars.length > 1) {
      const moved = teamAChars.pop();
      if (moved) teamBChars.push(moved);
    }

    if (teamAChars.length === 0 || teamBChars.length === 0) return false;

    // Các NPC ninja & Kage còn lại đóng vai trò KHÁN GIẢ
    const combatantSet = new Set<Character>([...teamAChars, ...teamBChars]);
    const spectatorChars = allChars.filter((c) => !combatantSet.has(c));

    // Rải các điểm giao chiến đều dọc hành lang chính (không quây vào một võ đài)
    const grid = this.sim.building.grid;
    const corridor = this.sim.building.corridor.rect;
    const pairs = Math.max(teamAChars.length, teamBChars.length);
    const cy = corridor.y + Math.floor(corridor.h / 2);
    const duelSpots = Array.from({ length: pairs }, (_, i) => {
      const cx = Math.floor(corridor.x + ((i + 0.5) * corridor.w) / pairs);
      return grid.nearestWalkable(cx, cy, 4) ?? { x: cx, y: cy };
    });
    const centerTile = duelSpots[Math.floor(pairs / 2)] ?? { x: corridor.x + Math.floor(corridor.w / 2), y: cy };

    this.state = {
      scenario,
      phase: 'rally',
      phaseEndsAt: now + 5_500, // 5.5 giây cho màn triệu tập quân
      winnerTeam: null,
      arenaCenter: centerTile,
      duelSpots,
      scoreA: 50,
      scoreB: 50,
      teamAChars,
      teamBChars,
      spectatorChars,
      nextBattleAt: now + BATTLE_INTERVAL_MS,
      bingoRecord: { ...this.bingoStats },
    };

    this.positionRally(now);
    this.emit();
    return true;
  }

  /** Bố trí quân giai đoạn RALLY: Đấu thủ chạy ra đối diện nhau, khán giả vây quanh xem */
  private positionRally(now: number): void {
    if (!this.state) return;
    const { duelSpots, teamAChars, teamBChars, spectatorChars } = this.state;
    const grid = this.sim.building.grid;
    const spotOf = (idx: number) => duelSpots[idx % duelSpots.length];

    // Mỗi đấu thủ Team A đứng bên trái điểm giao chiến của cặp mình, quay mặt sang PHẢI
    teamAChars.forEach((ch, idx) => {
      this.clearPlanAndQueue(ch);
      const spot = spotOf(idx);
      const targetTx = spot.x - 2;
      const targetTy = spot.y;
      const walk = grid.nearestWalkable(targetTx, targetTy, 4) ?? { x: targetTx, y: targetTy };
      ch.queue.push(
        { t: 'go', tx: walk.x, ty: walk.y, run: true },
        { t: 'act', pose: 'stand', ms: 1_000 },
        { t: 'do', fn: () => { ch.dir = 'right'; ch.setIcon('lightning', 3_000, now); } },
      );
    });

    // Đối thủ Team B đứng bên phải điểm giao chiến, quay mặt sang TRÁI
    teamBChars.forEach((ch, idx) => {
      this.clearPlanAndQueue(ch);
      const spot = spotOf(idx);
      const targetTx = spot.x + 2;
      const targetTy = spot.y;
      const walk = grid.nearestWalkable(targetTx, targetTy, 4) ?? { x: targetTx, y: targetTy };
      ch.queue.push(
        { t: 'go', tx: walk.x, ty: walk.y, run: true },
        { t: 'act', pose: 'stand', ms: 1_000 },
        { t: 'do', fn: () => { ch.dir = 'left'; ch.setIcon('lightning', 3_000, now); } },
      );
    });

    // Khán giả chia nhau vây quanh từng điểm giao chiến
    spectatorChars.forEach((ch, idx) => {
      this.clearPlanAndQueue(ch);
      const spot = spotOf(idx);
      const ring = Math.floor(idx / duelSpots.length);
      const side = ring % 2 === 0 ? -1 : 1;
      const dist = 4 + Math.floor(ring / 2);
      const targetTx = spot.x + side * dist;
      const targetTy = spot.y + ((ring % 3) - 1);
      const walk = grid.nearestWalkable(targetTx, targetTy, 8) ?? { x: ch.tx, y: ch.ty };
      ch.queue.push(
        { t: 'go', tx: walk.x, ty: walk.y, run: true },
        { t: 'act', pose: 'stand', ms: 800 },
        {
          t: 'do',
          fn: () => {
            ch.dir = ch.tx < spot.x ? 'right' : 'left';
            if (Math.random() < 0.6) ch.setIcon(Math.random() < 0.5 ? 'star' : 'alert', 3_000, now);
          },
        },
      );
    });
  }

  /** Chuyển sang giai đoạn GIAO TRANH NHẪN THUẬT (CLASH) */
  private enterClash(now: number): void {
    if (!this.state) return;
    this.state.phase = 'clash';
    this.state.phaseEndsAt = now + 18_000; // 18 giây tung chiêu mãn nhãn
    this.nextClashAct = now;

    const { teamAChars, teamBChars } = this.state;
    // Các đấu thủ lao sát vào giữa giao tranh
    teamAChars.forEach((ch, idx) => {
      ch.dir = 'right';
      ch.setIcon('star', 4_000, now);
    });
    teamBChars.forEach((ch, idx) => {
      ch.dir = 'left';
      ch.setIcon('star', 4_000, now);
    });

    this.emit();
  }

  /** Nhịp hành động liên tục trong giai đoạn CLASH */
  private tickClash(now: number): void {
    if (!this.state || now < this.nextClashAct) return;
    this.nextClashAct = now + 1_200;

    const { teamAChars, teamBChars, spectatorChars } = this.state;
    const poses: ('rps' | 'cheer' | 'stand')[] = ['rps', 'cheer', 'stand'];
    const icons: ('lightning' | 'star' | 'idea' | 'alert')[] = ['lightning', 'star', 'idea', 'alert'];

    // Biến động tỉ số giằng co
    const delta = (Math.random() - 0.5) * 8;
    this.state.scoreA = Math.max(15, Math.min(85, Math.round(this.state.scoreA + delta)));
    this.state.scoreB = 100 - this.state.scoreA;

    // Đấu thủ thay đổi tư thế kết ấn, xuất chiêu
    for (const ch of [...teamAChars, ...teamBChars]) {
      if (ch.queue.length === 0) {
        const pose = poses[Math.floor(Math.random() * poses.length)];
        const icon = icons[Math.floor(Math.random() * icons.length)];
        ch.setPose(pose);
        if (Math.random() < 0.7) ch.setIcon(icon, 1_600, now);
      }
    }

    // Khán giả reo hò, cổ vũ nhiệt liệt
    for (const ch of spectatorChars) {
      if (Math.random() < 0.45 && ch.queue.length === 0) {
        ch.setPose('cheer');
        if (Math.random() < 0.4) ch.setIcon(Math.random() < 0.5 ? 'heart' : 'star', 1_400, now);
      }
    }

    this.emit();
  }

  /** Chuyển sang giai đoạn CHIẾN THẮNG & VINH DANH (VICTORY) */
  private enterVictory(now: number): void {
    if (!this.state) return;
    this.state.phase = 'victory';
    this.state.phaseEndsAt = now + 8_000; // 8 giây vinh danh

    const winner: 'A' | 'B' = this.state.scoreA >= this.state.scoreB ? 'A' : 'B';
    this.state.winnerTeam = winner;

    // Cập nhật Sổ Đen Bingo Book
    this.bingoStats.totalBattles++;
    if (winner === 'A') this.bingoStats.teamAWins++;
    else this.bingoStats.teamBWins++;
    const winners = winner === 'A' ? this.state.teamAChars : this.state.teamBChars;
    const losers = winner === 'A' ? this.state.teamBChars : this.state.teamAChars;
    const mvpChar = winners[Math.floor(Math.random() * winners.length)];
    if (mvpChar) {
      this.bingoStats.mvpName = mvpChar.info.name ?? 'Nhẫn Giả Vô Danh';
      this.bingoStats.mvpTitle = mvpChar.info.role ?? 'Huyền Thoại Nhẫn Giới';
    }
    this.state.bingoRecord = { ...this.bingoStats };

    for (const ch of winners) {
      this.clearPlanAndQueue(ch);
      ch.queue.push(
        { t: 'act', pose: 'cheer', ms: 2_500 },
        { t: 'do', fn: () => ch.setIcon('star', 4_000, now) },
        { t: 'act', pose: 'cheer', ms: 2_500 },
      );
    }

    for (const ch of losers) {
      this.clearPlanAndQueue(ch);
      ch.queue.push(
        { t: 'act', pose: 'stand', ms: 1_200 },
        { t: 'do', fn: () => ch.setIcon('sweat', 3_500, now) },
        { t: 'act', pose: 'stand', ms: 2_500 },
      );
    }

    // Khán giả tung hô chúc mừng đội chiến thắng
    for (const ch of this.state.spectatorChars) {
      if (Math.random() < 0.8) {
        ch.queue.push({ t: 'act', pose: 'cheer', ms: 2_800 });
        ch.setIcon('star', 3_500, now);
      }
    }

    this.emit();
  }

  /** Giải tán sau trận đấu, trả nhân sự về bàn làm việc và nhiệm vụ hiện tại */
  private enterDisperse(now: number): void {
    if (!this.state) return;
    this.state.phase = 'disperse';
    this.state.phaseEndsAt = now + 3_500;
    this.nextBattleTime = now + BATTLE_INTERVAL_MS; // 3 phút sau trận tiếp theo
    this.state.nextBattleAt = this.nextBattleTime;

    const all = [...this.state.teamAChars, ...this.state.teamBChars, ...this.state.spectatorChars];
    for (const ch of all) {
      this.clearPlanAndQueue(ch);
      // Đặt thinkAt = now để planner của Sim tự động đưa nhân sự về bàn làm việc (homeSpot)
      ch.thinkAt = now;
      ch.reactUntil = 0;
      ch.setPose('stand');
      ch.setIcon(null, 0, now);
      // NPC ninja & trưởng phòng ảo KHÔNG chạy planner: phải chủ động đưa về đúng võ đường của
      // mình, nếu không chúng sẽ kẹt lại quanh võ đài (hành lang cạnh Cổng Làng) mãi mãi.
      const homeCoreId = this.sim.homeCoreIdOf(ch);
      if (homeCoreId) {
        const area = this.sim.localArea(homeCoreId);
        if (area) {
          const tx = Math.floor(area.rect.x + 2 + ch.rng() * Math.max(1, area.rect.w - 4));
          const ty = Math.floor(area.rect.y + 2 + ch.rng() * Math.max(1, area.rect.h - 4));
          const walk = this.sim.building.grid.nearestWalkable(tx, ty, 8) ?? { x: tx, y: ty };
          ch.queue.push(
            { t: 'go', tx: walk.x, ty: walk.y, run: false },
            { t: 'do', fn: () => { ch.roomId = homeCoreId; ch.info.roomId = homeCoreId; } },
          );
        }
      }
    }

    this.emit();
  }

  /** Khôi phục trạng thái nhàn rỗi */
  private endBattle(): void {
    this.state = null;
    this.emit();
  }

  private clearPlanAndQueue(ch: Character): void {
    if (ch.gathering) this.sim.clearPlan(ch);
    ch.queue.length = 0;
    ch.step = null;
  }

  /** Vòng lặp cập nhật mỗi frame */
  update(now: number): void {
    if (!this.state) {
      // Tự động kích hoạt khi tới thời điểm hẹn 3 phút
      if (now >= this.nextBattleTime && this.sim.chars.size >= 4) {
        this.startBattle(undefined, now);
      }
      return;
    }

    // Kiểm tra hết hạn phase
    if (now >= this.state.phaseEndsAt) {
      switch (this.state.phase) {
        case 'rally':
          this.enterClash(now);
          break;
        case 'clash':
          this.enterVictory(now);
          break;
        case 'victory':
          this.enterDisperse(now);
          break;
        case 'disperse':
          this.endBattle();
          break;
      }
      return;
    }

    if (this.state.phase === 'clash') {
      this.tickClash(now);
    }
  }
}
