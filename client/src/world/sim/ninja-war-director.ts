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
  scoreA: number;
  scoreB: number;
  teamAChars: Character[];
  teamBChars: Character[];
  spectatorChars: Character[];
  nextBattleAt: number;
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

  constructor(sim: Sim, now = Date.now()) {
    this.sim = sim;
    // Khởi đầu sau 25 giây khi mở app để người chơi kịp nhìn ngắm văn phòng trước trận đầu
    this.nextBattleTime = now + 25_000;
  }

  getState(): NinjaTeamBattleState | null {
    return this.state;
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

    // Tìm kiếm các Character tham gia vào Team A và Team B
    const allChars = [...this.sim.chars.values()].filter((c) => !c.gone && !c.leaving);
    const charMatch = (pattern: string): Character | undefined => {
      const p = pattern.toLowerCase();
      return allChars.find((c) => (c.info.name ?? '').toLowerCase().includes(p));
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

    // Đảm bảo phân bổ nhân sự hiện có trong văn phòng vào 2 đội đấu (tối đa 3 vs 3)
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

    // Tất cả các NPC ninja, Kage và nhân viên đang rảnh rỗi đóng vai trò KHÁN GIẢ
    // Các nhân sự đang tập trung làm việc tại bàn của session thật (mode === 'work') tiếp tục làm việc bình thường
    const combatantSet = new Set<Character>([...teamAChars, ...teamBChars]);
    const spectatorChars = allChars.filter((c) => {
      if (combatantSet.has(c)) return false;
      const isNpc = this.sim.npcNinjaIds.has(c.id);
      const isHead = (this.sim as any).virtualHeadIds?.has(c.id);
      if (isNpc || isHead) return true;
      return c.mode === 'idle' || !c.homeSpot;
    });

    // Tìm tâm võ đài trên hành lang chính
    const cols = Math.max(3, Math.floor(allChars.length / 5));
    const cx = Math.max(16, Math.min(32, cols * 8));
    const cy = CORRIDOR_Y + 2;
    const centerTile = this.sim.building.grid.nearestWalkable(cx, cy, 6) ?? { x: cx, y: cy };

    this.state = {
      scenario,
      phase: 'rally',
      phaseEndsAt: now + 5_500, // 5.5 giây cho màn triệu tập quân
      winnerTeam: null,
      arenaCenter: centerTile,
      scoreA: 50,
      scoreB: 50,
      teamAChars,
      teamBChars,
      spectatorChars,
      nextBattleAt: now + BATTLE_INTERVAL_MS,
    };

    this.positionRally(now);
    this.emit();
    return true;
  }

  /** Bố trí quân giai đoạn RALLY: Đấu thủ chạy ra đối diện nhau, khán giả vây quanh xem */
  private positionRally(now: number): void {
    if (!this.state) return;
    const { arenaCenter, teamAChars, teamBChars, spectatorChars } = this.state;
    const grid = this.sim.building.grid;

    // Team A đứng bên trái võ đài (khoảng cách 3-5 ô sang trái), quay mặt sang PHẢI
    teamAChars.forEach((ch, idx) => {
      this.clearPlanAndQueue(ch);
      const targetTx = arenaCenter.x - 3 - (idx % 2);
      const targetTy = arenaCenter.y - 1 + idx;
      const walk = grid.nearestWalkable(targetTx, targetTy, 4) ?? { x: targetTx, y: targetTy };
      ch.queue.push(
        { t: 'go', tx: walk.x, ty: walk.y, run: true },
        { t: 'act', pose: 'stand', ms: 1_000 },
        { t: 'do', fn: () => { ch.dir = 'right'; ch.setIcon('lightning', 3_000, now); } },
      );
    });

    // Team B đứng bên phải võ đài (khoảng cách 3-5 ô sang phải), quay mặt sang TRÁI
    teamBChars.forEach((ch, idx) => {
      this.clearPlanAndQueue(ch);
      const targetTx = arenaCenter.x + 3 + (idx % 2);
      const targetTy = arenaCenter.y - 1 + idx;
      const walk = grid.nearestWalkable(targetTx, targetTy, 4) ?? { x: targetTx, y: targetTy };
      ch.queue.push(
        { t: 'go', tx: walk.x, ty: walk.y, run: true },
        { t: 'act', pose: 'stand', ms: 1_000 },
        { t: 'do', fn: () => { ch.dir = 'left'; ch.setIcon('lightning', 3_000, now); } },
      );
    });

    // Toàn bộ khán giả xếp thành hàng rào xem quanh hai bên hành lang và sảnh
    spectatorChars.forEach((ch, idx) => {
      this.clearPlanAndQueue(ch);
      const side = idx % 2 === 0 ? -1 : 1;
      const dist = 5 + Math.floor(idx / 2) * 2;
      const targetTx = arenaCenter.x + (side === -1 ? -dist : dist);
      const targetTy = arenaCenter.y + ((idx % 3) - 1);
      const walk = grid.nearestWalkable(targetTx, targetTy, 8) ?? { x: ch.tx, y: ch.ty };
      ch.queue.push(
        { t: 'go', tx: walk.x, ty: walk.y, run: true },
        { t: 'act', pose: 'stand', ms: 800 },
        {
          t: 'do',
          fn: () => {
            ch.dir = ch.tx < arenaCenter.x ? 'right' : 'left';
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

    const winners = winner === 'A' ? this.state.teamAChars : this.state.teamBChars;
    const losers = winner === 'A' ? this.state.teamBChars : this.state.teamAChars;

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
