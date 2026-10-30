// Canvas Đấu trường Ninja: các nhẫn giả (sprite pixel thật của agent trong văn phòng) đứng thành
// hàng, giao chiến theo diễn biến của lõi BattleRoyale. Toàn bộ là "show" cục bộ — không đổi
// trạng thái agent, không mạng, không Habblaud World (docs/spec/chibi-battle-royale.md §0).
import { appearanceFromSeed, characterSprite, drawFloor } from '../../art';
import { BattleRoyale, villageOf, type BattleResult, type Fighter, type Strike } from './core';

const W = 640;
const H = 300;
const GROUND_Y = H - 52;
const STEP_MS = 1150;

/** Trạng thái vẽ của một nhẫn giả trên sân. */
interface Ninja {
  readonly fighter: Fighter;
  readonly homeX: number;
  readonly y: number;
  readonly faceRight: boolean;
  hp: number;
  out: boolean;
  /** Lunge hiện tại: dịch chuyển px về phía đối thủ. */
  offset: number;
  flash: number;
  /** Hơi cháy còn lại (đỏ rực). */
  burning: number;
}

type Effect =
  | { kind: 'shuriken'; x0: number; x1: number; y: number; t: number; dur: number }
  | { kind: 'fireball'; x0: number; x1: number; y: number; t: number; dur: number }
  | { kind: 'rasengan'; x0: number; x1: number; y: number; t: number; dur: number }
  | { kind: 'chidori'; x0: number; x1: number; y: number; t: number; dur: number }
  | { kind: 'amaterasu'; x: number; y: number; t: number; dur: number }
  | { kind: 'susanoo'; x: number; y: number; t: number; dur: number }
  | { kind: 'shinra'; x: number; y: number; t: number; dur: number }
  | { kind: 'bijuu'; x0: number; x1: number; y: number; t: number; dur: number }
  | { kind: 'summon-creature'; x: number; y: number; creature: string; t: number; dur: number }
  | { kind: 'chakra'; x: number; y: number; t: number; dur: number }
  | { kind: 'smoke'; x: number; y: number; t: number; dur: number }
  | { kind: 'summon'; x: number; y: number; t: number; dur: number }
  | { kind: 'dmg'; x: number; y: number; text: string; t: number; dur: number; ko: boolean };

/** Cảnh chiến đấu: chạy 1 trận từ lõi (deterministic) rồi diễn lại bằng canvas + rAF. */
export class BattleScene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly ninjas: Ninja[] = [];
  private readonly effects: Effect[] = [];
  private readonly steps: { run(): void; ms: number }[] = [];
  private stepIndex = 0;
  private stepElapsed = 0;
  private raf = 0;
  private last = 0;
  private done = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    fighters: readonly Fighter[],
    private readonly seed: number,
    private readonly hooks: { onStrike?(s: Strike, round: number, total: number): void; onDone?(r: BattleResult): void } = {},
  ) {
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    fighters.forEach((fighter, i) => {
      const leftSide = i % 2 === 0;
      this.ninjas.push({
        fighter,
        homeX: leftSide ? 80 + Math.floor(i / 2) * 96 : W - 80 - Math.floor(i / 2) * 96,
        y: GROUND_Y,
        faceRight: leftSide,
        hp: 100,
        out: false,
        offset: 0,
        flash: 0,
        burning: 0,
      });
    });
  }

  /** Bắt đầu: chạy lõi trận rồi dựng hàng đợi diễn xuất theo từng đòn. */
  start(): void {
    const result = new BattleRoyale(this.ninjas.map((n) => n.fighter), this.seed).run();
    const byId = new Map(this.ninjas.map((n) => [n.fighter.id, n] as const));
    result.rounds.forEach((round, ri) => {
      this.steps.push({ run: () => this.hooks.onStrike?.(round.strikes[0], round.round, result.rounds.length), ms: 0 });
      void ri;
      for (const strike of round.strikes) {
        this.steps.push({ run: () => this.play(strike, byId), ms: STEP_MS });
      }
    });
    this.steps.push({ run: () => this.finish(result), ms: 0 });
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Dừng vòng lặp rAF (khi đóng dialog). */
  destroy(): void {
    this.done = true;
    cancelAnimationFrame(this.raf);
  }

  private loop = (ts: number): void => {
    if (this.done) return;
    const dt = ts - this.last;
    this.last = ts;
    this.tick(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private tick(dt: number): void {
    if (this.stepIndex >= this.steps.length) return;
    const step = this.steps[this.stepIndex];
    if (this.stepElapsed === 0) step.run();
    this.stepElapsed += dt;
    if (this.stepElapsed >= step.ms) {
      this.stepElapsed = 0;
      this.stepIndex += 1;
    }
    for (const e of this.effects) e.t += dt;
    this.effects.forEach((e, i) => {
      if (e.t >= e.dur) this.effects.splice(i, 1);
    });
    for (const n of this.ninjas) {
      if (n.flash > 0) n.flash = Math.max(0, n.flash - dt);
      if (n.burning > 0) n.burning = Math.max(0, n.burning - dt);
    }
  }

  /** Dựng animation cho 1 đòn: lunge + hiệu ứng + sát thương. */
  private play(strike: Strike, byId: Map<string, Ninja>): void {
    const attacker = byId.get(strike.attacker)!;
    const defender = byId.get(strike.defender)!;
    const mid = (attacker.homeX + defender.homeX) / 2;
    attacker.offset = (mid - attacker.homeX) * 0.45;
    const x = defender.homeX;
    const y = defender.y - 24;
    switch (strike.jutsu) {
      case 'shuriken':
        this.effects.push({ kind: 'shuriken', x0: attacker.homeX + attacker.offset, x1: x, y, t: 0, dur: 380 });
        break;
      case 'fireball':
        this.effects.push({ kind: 'fireball', x0: attacker.homeX + attacker.offset, x1: x, y, t: 0, dur: 460 });
        defender.burning = strike.burnSet ? 1400 : 0;
        break;
      case 'rasengan':
        this.effects.push({ kind: 'rasengan', x0: attacker.homeX + attacker.offset, x1: x, y, t: 0, dur: 450 });
        break;
      case 'chidori':
        this.effects.push({ kind: 'chidori', x0: attacker.homeX + attacker.offset, x1: x, y, t: 0, dur: 400 });
        break;
      case 'amaterasu':
        this.effects.push({ kind: 'susanoo', x: attacker.homeX + attacker.offset, y: attacker.y - 30, t: 0, dur: 500 });
        this.effects.push({ kind: 'amaterasu', x, y, t: 0, dur: 700 });
        defender.burning = 2400;
        break;
      case 'tsukuyomi':
        this.effects.push({ kind: 'susanoo', x: attacker.homeX + attacker.offset, y: attacker.y - 30, t: 0, dur: 600 });
        this.effects.push({ kind: 'smoke', x, y, t: 0, dur: 500 });
        break;
      case 'shinra-tensei':
        this.effects.push({ kind: 'shinra', x: attacker.homeX + attacker.offset, y: attacker.y - 20, t: 0, dur: 600 });
        break;
      case 'bijuudama':
        this.effects.push({ kind: 'bijuu', x0: attacker.homeX + attacker.offset, x1: x, y, t: 0, dur: 550 });
        break;
      case 'summon': {
        const creatures = ['🐸 Cóc Gamabunta', '🐍 Đại Xà Aoda', '🐌 Sên Katsuyu', '⚡ Khỉ Enma'];
        const chosen = creatures[Math.abs(strike.round * 31 + attacker.fighter.seed) % creatures.length];
        this.effects.push({ kind: 'summon-creature', x, y, creature: chosen, t: 0, dur: strike.failed ? 500 : 650 });
        if (strike.failed) this.effects.push({ kind: 'smoke', x: attacker.homeX + attacker.offset, y: attacker.y - 24, t: 0, dur: 500 });
        break;
      }
      case 'shadow-clone':
        this.effects.push({ kind: 'smoke', x: attacker.homeX + attacker.offset, y: attacker.y - 10, t: 0, dur: 300 });
        this.effects.push({ kind: 'shuriken', x0: attacker.homeX + attacker.offset, x1: x, y: y - 8, t: 0, dur: 320 });
        this.effects.push({ kind: 'shuriken', x0: attacker.homeX + attacker.offset, x1: x, y: y + 10, t: 160, dur: 320 });
        break;
      case 'substitution':
        this.effects.push({ kind: 'chakra', x: attacker.homeX, y: attacker.y - 24, t: 0, dur: 700 });
        break;
      case 'focus':
        this.effects.push({ kind: 'chakra', x: attacker.homeX + attacker.offset, y: attacker.y - 24, t: 0, dur: 700 });
        break;
    }
    const impactAt = strike.jutsu === 'shuriken' ? 380 : strike.jutsu === 'fireball' ? 460 : strike.jutsu === 'shadow-clone' ? 520 : 560;
    window.setTimeout(() => {
      if (this.done) return;
      if (strike.negated) {
        this.effects.push({ kind: 'smoke', x, y, t: 0, dur: 520 });
        if (strike.attackerHpAfter !== undefined) {
          attacker.hp = strike.attackerHpAfter;
          attacker.flash = 260;
          this.effects.push({ kind: 'dmg', x: attacker.homeX + attacker.offset, y: attacker.y - 30, text: `−${strike.damage === 0 ? COUNTER : strike.damage} 🌀`, t: 0, dur: 900, ko: false });
        }
      } else if (strike.damage > 0) {
        defender.hp = strike.hpAfter;
        defender.flash = 260;
        this.effects.push({ kind: 'dmg', x, y: y - 14, text: `−${strike.damage} ❤️`, t: 0, dur: 900, ko: strike.hpAfter <= 0 });
        if (strike.hpAfter <= 0) {
          defender.out = true;
          this.effects.push({ kind: 'smoke', x, y: defender.y - 20, t: 0, dur: 700 });
        }
      }
    }, impactAt);
    window.setTimeout(() => {
      attacker.offset = 0;
    }, STEP_MS - 120);
  }

  private finish(result: BattleResult): void {
    this.hooks.onDone?.(result);
  }

  // ── render ──────────────────────────────────────────────────────

  private render(): void {
    const ctx = this.ctx;
    // Bầu trời đêm + nền đấu trường.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#101a2e');
    sky.addColorStop(1, '#1d2b45');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // Vầng trăng.
    ctx.fillStyle = '#e8e3cf';
    ctx.beginPath();
    ctx.arc(W - 70, 46, 22, 0, Math.PI * 2);
    ctx.fill();
    // Sàn gỗ pixel (tái dùng art của văn phòng).
    drawFloor(ctx, 'wood', 0, GROUND_Y, W, H - GROUND_Y, { seed: this.seed });
    // Băng đô màu làng dưới chân sân.
    ctx.fillStyle = '#141c2c';
    ctx.fillRect(0, GROUND_Y - 4, W, 4);
    for (const n of this.ninjas) this.renderNinja(ctx, n);
    for (const e of this.effects) this.renderEffect(ctx, e);
  }

  private renderNinja(ctx: CanvasRenderingContext2D, n: Ninja): void {
    if (n.out) return;
    const village = villageOf(n.fighter.family);
    const appearance = appearanceFromSeed(n.fighter.seed, { look: n.fighter.look, parts: n.fighter.parts });
    const sprite = characterSprite({
      appearance,
      dir: n.faceRight ? 'right' : 'left',
      pose: 'stand',
      frame: 0,
      costume: 'ninja',
      costumeColor: village.color,
    });
    const x = n.homeX + n.offset - sprite.ax;
    const y = n.y - sprite.ay;
    ctx.save();
    if (n.flash > 0) {
      ctx.filter = 'brightness(1.8)';
    } else if (n.burning > 0) {
      ctx.filter = `sepia(0.6) hue-rotate(-18deg) saturate(1.6)`;
    }
    ctx.drawImage(sprite.canvas, x, y);
    ctx.restore();
    if (n.burning > 0) {
      ctx.fillStyle = Math.floor(n.burning / 120) % 2 ? '#ff8c3a' : '#ffd23a';
      ctx.fillRect(n.homeX + n.offset - 3, y - 4, 6, 3);
    }
    // Thanh máu + tên kèm emoji làng.
    const barW = 44;
    ctx.fillStyle = '#0b1220cc';
    ctx.fillRect(n.homeX + n.offset - barW / 2 - 1, y - 14, barW + 2, 6);
    ctx.fillStyle = n.hp > 50 ? '#4d9970' : n.hp > 20 ? '#d9a12e' : '#b3474d';
    ctx.fillRect(n.homeX + n.offset - barW / 2, y - 13, (barW * n.hp) / 100, 4);
    ctx.fillStyle = '#dfe7f2';
    ctx.font = '9px "Pixelify Sans", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${village.emoji} ${n.fighter.name}`, n.homeX + n.offset, y - 18);
  }

  private renderEffect(ctx: CanvasRenderingContext2D, e: Effect): void {
    const p = Math.min(1, e.t / e.dur);
    switch (e.kind) {
      case 'shuriken': {
        const x = e.x0 + (e.x1 - e.x0) * p;
        ctx.save();
        ctx.translate(x, e.y);
        ctx.rotate(e.t / 60);
        ctx.fillStyle = '#c9d1dc';
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, -7);
          ctx.lineTo(3, 0);
          ctx.lineTo(-3, 0);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'fireball': {
        const x = e.x0 + (e.x1 - e.x0) * p;
        const r = 6 + 10 * p;
        const g = ctx.createRadialGradient(x, e.y, 1, x, e.y, r);
        g.addColorStop(0, '#ffe08a');
        g.addColorStop(0.6, '#ff7a2f');
        g.addColorStop(1, '#b32d12');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, e.y, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rasengan': {
        const x = e.x0 + (e.x1 - e.x0) * p;
        const r = 7 + 6 * Math.sin(p * Math.PI);
        const g = ctx.createRadialGradient(x, e.y, 1, x, e.y, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, '#80d4ff');
        g.addColorStop(1, '#0088ff');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, e.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e0f4ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, e.y, r + 3, p * 12, p * 12 + Math.PI);
        ctx.stroke();
        break;
      }
      case 'chidori': {
        const x = e.x0 + (e.x1 - e.x0) * p;
        ctx.strokeStyle = '#cceeff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 12, e.y);
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(x - 12 + i * 6, e.y + (Math.sin(e.t / 20 + i) * 8));
        }
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, e.y, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'amaterasu': {
        ctx.fillStyle = `rgba(18, 18, 20, ${0.9 - 0.2 * p})`;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(a) * (8 + 4 * p), e.y - 10 + Math.sin(a) * (8 + 4 * p), 6 + 3 * p, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#9b111e';
        ctx.beginPath();
        ctx.arc(e.x, e.y - 10, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'susanoo': {
        ctx.strokeStyle = `rgba(160, 40, 220, ${0.8 - 0.7 * p})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(e.x - 16, e.y - 32, 32, 42);
        ctx.fillStyle = `rgba(140, 30, 200, ${0.35 - 0.3 * p})`;
        ctx.fillRect(e.x - 16, e.y - 32, 32, 42);
        ctx.fillStyle = '#f0c0ff';
        ctx.font = 'bold 10px "Pixelify Sans", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SUSANOO', e.x, e.y - 36);
        break;
      }
      case 'shinra': {
        const r = 10 + 60 * p;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 - 0.85 * p})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'bijuu': {
        const x = e.x0 + (e.x1 - e.x0) * p;
        const r = 10 + 6 * p;
        const g = ctx.createRadialGradient(x, e.y, 2, x, e.y, r);
        g.addColorStop(0, '#110022');
        g.addColorStop(0.7, '#660099');
        g.addColorStop(1, '#ff0033');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, e.y, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'chakra': {
        ctx.strokeStyle = `rgba(90,170,255,${0.9 - 0.9 * p})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(e.x, e.y, 6 + i * 5 + 8 * p, p * 6 + i, p * 6 + i + Math.PI * 1.2);
          ctx.stroke();
        }
        break;
      }
      case 'summon-creature': {
        const slam = e.t < e.dur / 2 ? p * 2 : (1 - p) * 2;
        ctx.fillStyle = `rgba(20,28,44,${0.75})`;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 16, 32 * (0.6 + slam), 12 * (0.6 + slam), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 12px "Pixelify Sans", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(e.creature, e.x, e.y - 30 - 16 * (1 - p));
        break;
      }
      case 'smoke': {
        ctx.fillStyle = `rgba(226,232,240,${0.85 - 0.85 * p})`;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(a) * 14 * p, e.y + Math.sin(a) * 10 * p, 7 + 5 * p, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'summon': {
        const slam = e.t < e.dur / 2 ? p * 2 : (1 - p) * 2;
        ctx.fillStyle = `rgba(20,28,44,${0.75})`;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 16, 30 * (0.6 + slam), 10 * (0.6 + slam), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d9a12e';
        ctx.font = 'bold 13px "Pixelify Sans", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Summon!', e.x, e.y - 30 - 16 * (1 - p));
        break;
      }
      case 'dmg': {
        ctx.fillStyle = e.ko ? '#8f1d24' : '#ffd7cc';
        ctx.font = e.ko ? 'bold 15px "Pixelify Sans", monospace' : 'bold 12px "Pixelify Sans", monospace';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 1 - p * 0.6;
        ctx.fillText(e.text, e.x, e.y - 18 * p);
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}

const COUNTER = 6;
