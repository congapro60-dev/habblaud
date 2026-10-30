// Banner Thông Báo & Điều Phối Màn Thi Đấu Team / Đại Chiến Nhẫn Giả Kinh Điển
import type { UiComponent, UiContext } from './context';
import type { NinjaTeamBattleState } from '../world/api';
import { h, setText } from './dom';

export class NinjaWarBanner implements UiComponent {
  readonly el: HTMLElement;
  private readonly inner: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;
  private readonly teamsEl: HTMLElement;
  private readonly barEl: HTMLElement;
  private readonly barA: HTMLElement;
  private readonly barB: HTMLElement;
  private readonly triggerBtn: HTMLButtonElement;
  private readonly countdownEl: HTMLElement;

  private state: NinjaTeamBattleState | null = null;
  private offState: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly ctx: UiContext) {
    this.titleEl = h('div', { class: 'ui-ninja-war__title' });
    this.subtitleEl = h('div', { class: 'ui-ninja-war__subtitle' });
    this.teamsEl = h('div', { class: 'ui-ninja-war__teams' });

    this.barA = h('div', { class: 'ui-ninja-war__bar-a' });
    this.barB = h('div', { class: 'ui-ninja-war__bar-b' });
    this.barEl = h('div', { class: 'ui-ninja-war__bar' }, this.barA, this.barB);

    this.countdownEl = h('span', { class: 'ui-ninja-war__timer', text: '⏳ 03:00' });
    this.triggerBtn = h('button', {
      class: 'ui-btn ui-ninja-war__btn-trigger',
      type: 'button',
      text: '⚔️ Khai Chiến Ngay',
      title: 'Kích hoạt ngay một trận đấu kinh điển giữa các đội nhẫn giả',
      on: {
        click: () => this.handleTrigger(),
      },
    });

    this.inner = h(
      'div',
      { class: 'ui-ninja-war__inner' },
      this.titleEl,
      this.subtitleEl,
      this.teamsEl,
      this.barEl,
      h('div', { class: 'ui-ninja-war__actions' }, this.countdownEl, this.triggerBtn),
    );

    this.el = h('div', { class: 'ui-ninja-war' }, this.inner);

    this.offState = this.ctx.world.onTeamBattleChange?.((s) => {
      this.state = s;
      this.render();
      this.ctx.invalidate();
    }) ?? null;

    if (typeof window !== 'undefined') {
      this.timer = setInterval(() => {
        if (!this.state || this.state.phase === 'idle' || this.state.phase === 'disperse') {
          this.updateIdleTimer();
        }
      }, 1_000);
    }

    this.render();
  }

  private handleTrigger(): void {
    this.ctx.world.triggerTeamBattle?.();
    this.ctx.invalidate();
  }

  private updateIdleTimer(): void {
    const nextAt = this.state?.nextBattleAt ?? 0;
    const now = Date.now();
    const remainMs = Math.max(0, nextAt - now);
    const secs = Math.ceil(remainMs / 1000);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    setText(this.countdownEl, `⏳ Đại chiến sau: ${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
  }

  render(): void {
    const s = this.state;
    if (!s || s.phase === 'idle' || s.phase === 'disperse') {
      this.el.classList.remove('is-active', 'is-rally', 'is-clash', 'is-victory');
      this.el.classList.add('is-idle');
      setText(this.titleEl, '🥋 ĐẤU TRƯỜNG NHẪN GIẢ · ĐẠI CHIẾN KINH ĐIỂN');
      setText(this.subtitleEl, 'Mỗi 3 phút sẽ bùng nổ trận quyết chiến kinh điển giữa các đội ninja làng lá, Akatsuki, Kage & Vĩ Thú!');
      this.teamsEl.style.display = 'none';
      this.barEl.style.display = 'none';
      this.triggerBtn.style.display = 'inline-flex';
      this.countdownEl.style.display = 'inline-block';
      this.updateIdleTimer();
      return;
    }

    this.el.classList.remove('is-idle');
    this.el.classList.add('is-active', `is-${s.phase}`);
    this.teamsEl.style.display = 'flex';
    this.triggerBtn.style.display = 'none';
    this.countdownEl.style.display = 'none';

    if (s.phase === 'rally') {
      const remain = Math.max(1, Math.ceil((s.phaseEndsAt - Date.now()) / 1000));
      setText(this.titleEl, s.scenario.title);
      setText(this.subtitleEl, `${s.scenario.subtitle} — ⚡ KHAI CHIẾN SAU ${remain}s!`);
      this.barEl.style.display = 'none';
      setText(
        this.teamsEl,
        `🔵 [${s.scenario.teamA.name}] (${s.teamAChars.map((c) => c.info.name?.split(' ')[0]).join(', ')})  VS  🔴 [${s.scenario.teamB.name}] (${s.teamBChars.map((c) => c.info.name?.split(' ')[0]).join(', ')})`,
      );
    } else if (s.phase === 'clash') {
      setText(this.titleEl, `🔥 ĐANG GIAO TRANH: ${s.scenario.title} 🔥`);
      setText(this.subtitleEl, '💥 Nhẫn thuật tung ra liên hoàn! Toàn thể ninja vây quanh hò reo cổ vũ cuồng nhiệt!');
      this.barEl.style.display = 'flex';
      this.barA.style.width = `${s.scoreA}%`;
      this.barB.style.width = `${s.scoreB}%`;
      setText(
        this.teamsEl,
        `⚡ ${s.scenario.teamA.name}: ${s.scoreA}% ─── VS ─── ${s.scenario.teamB.name}: ${s.scoreB}% ⚡`,
      );
    } else if (s.phase === 'victory') {
      const winnerName = s.winnerTeam === 'A' ? s.scenario.teamA.name : s.scenario.teamB.name;
      setText(this.titleEl, `🏆 CHIẾN THẮNG: [${winnerName.toUpperCase()}]! 🏆`);
      setText(this.subtitleEl, '🎉 Toàn thể đấu trường tung hô và vinh danh các chiến binh nhẫn giả huyền thoại!');
      this.barEl.style.display = 'none';
      setText(this.teamsEl, `⭐ Vinh quang thuộc về ${winnerName}! Pháo hoa rực sáng Đấu Trường! ⭐`);
    }
  }

  destroy(): void {
    this.offState?.();
    if (this.timer) clearInterval(this.timer);
    this.el.remove();
  }
}
