// ⚔️ Thanh điều khiển Nhẫn Giả (Combat HUD / Player Control Bar):
// Cho phép người dùng trực tiếp điều khiển nhân vật ninja di chuyển bằng phím (WASD / mũi tên)
// hoặc click chuột trên sàn, chủ động áp sát và khiêu chiến nhẫn thuật với các ninja khác.
import type { UiComponent, UiContext } from './context';
import { h, setHidden, setText } from './dom';
import { resolveNinjaAvatarUrl } from './avatar';
import { intentFrom, moveKeyOf } from '../world/city/input';
import { modalOpen } from '../world/input';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName ?? ''));
}

export class NinjaControlHud implements UiComponent {
  readonly el: HTMLElement;
  private readonly inner: HTMLElement;
  private readonly avatarImg: HTMLImageElement;
  private readonly avatarFallback: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly actionsEl: HTMLElement;
  private readonly challengeBtn: HTMLButtonElement;
  private readonly controlToggleBtn: HTMLButtonElement;
  private readonly exitBtn: HTMLButtonElement;

  private controlledId: string | null = null;
  private selectedAgentId: string | null = null;
  private moveKeys = new Set<string>();
  private isShift = false;
  private offControlled: (() => void) | null = null;
  private offSelect: (() => void) | null = null;

  constructor(private readonly ctx: UiContext) {
    this.avatarImg = h('img', { class: 'ui-ninja-hud__avatar-img', attrs: { alt: 'Avatar' } });
    this.avatarFallback = h('div', { class: 'ui-ninja-hud__avatar-fallback', text: '🥷' });
    this.titleEl = h('div', { class: 'ui-ninja-hud__title' });
    this.hintEl = h('div', { class: 'ui-ninja-hud__hint' });

    this.challengeBtn = h('button', {
      class: 'ui-btn ui-btn--primary ui-ninja-hud__btn-challenge',
      type: 'button',
      text: '⚔️ Khiêu Chiến Nhẫn Thuật (E / Space)',
      on: {
        click: () => this.handleChallenge(),
      },
    });

    this.controlToggleBtn = h('button', {
      class: 'ui-btn ui-ninja-hud__btn-control',
      type: 'button',
      text: '🎮 Điều Khiển Nhẫn Giả (Phím C)',
      on: {
        click: () => this.toggleControlSelected(),
      },
    });

    this.exitBtn = h('button', {
      class: 'ui-btn ui-ninja-hud__btn-exit',
      type: 'button',
      text: '❌ Thoát (Esc)',
      on: {
        click: () => this.exitControl(),
      },
    });

    this.actionsEl = h('div', { class: 'ui-ninja-hud__actions' }, this.challengeBtn, this.controlToggleBtn, this.exitBtn);

    this.inner = h(
      'div',
      { class: 'ui-ninja-hud__inner' },
      h('div', { class: 'ui-ninja-hud__avatar' }, this.avatarImg, this.avatarFallback),
      h('div', { class: 'ui-ninja-hud__info' }, this.titleEl, this.hintEl),
      this.actionsEl,
    );

    this.el = h('div', { class: 'ui-ninja-hud', hidden: true }, this.inner);

    this.setupListeners();
  }

  get isControlling(): boolean {
    return this.controlledId !== null;
  }

  private setupListeners(): void {
    this.offControlled = this.ctx.world.onControlledChange?.((id) => {
      this.controlledId = id;
      if (!id) {
        this.clearMoveKeys();
      }
      this.ctx.invalidate();
    }) ?? null;

    this.offSelect = this.ctx.world.onSelect((sel) => {
      this.selectedAgentId = sel?.type === 'agent' ? sel.id : null;
      this.ctx.invalidate();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.clearMoveKeys);
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e.target) || modalOpen(e.target as HTMLElement | null)) return;

    // Phím C: bật/tắt điều khiển nhẫn giả đang chọn
    if (e.key === 'c' || e.key === 'C') {
      if (!this.controlledId && this.selectedAgentId) {
        e.preventDefault();
        this.ctx.world.controlAgent?.(this.selectedAgentId);
        return;
      }
      if (this.controlledId) {
        e.preventDefault();
        this.exitControl();
        return;
      }
    }

    if (!this.controlledId) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.exitControl();
      return;
    }

    if (e.key === 'Shift') {
      this.isShift = true;
      this.pushMoveIntent();
    } else if (typeof e.getModifierState === 'function') {
      this.isShift = e.getModifierState('Shift');
    }

    const k = moveKeyOf(e);
    if (k) {
      e.preventDefault();
      this.moveKeys.add(k);
      this.pushMoveIntent();
      return;
    }

    if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
      e.preventDefault();
      this.handleChallenge();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (!this.controlledId) return;

    if (e.key === 'Shift') {
      this.isShift = false;
      this.pushMoveIntent();
    } else if (typeof e.getModifierState === 'function') {
      this.isShift = e.getModifierState('Shift');
    }

    const k = moveKeyOf(e);
    if (k) {
      this.moveKeys.delete(k);
      this.pushMoveIntent();
    }
  };

  private clearMoveKeys = () => {
    this.moveKeys.clear();
    this.isShift = false;
    this.pushMoveIntent();
  };

  private pushMoveIntent(): void {
    if (!this.controlledId) return;
    const intent = intentFrom(this.moveKeys, this.isShift);
    this.ctx.world.setControlledIntent?.(intent);
  }

  private toggleControlSelected(): void {
    if (this.selectedAgentId) {
      this.ctx.world.controlAgent?.(this.selectedAgentId);
    }
  }

  private exitControl(): void {
    this.ctx.world.controlAgent?.(null);
  }

  private handleChallenge(targetId?: string): void {
    const res = this.ctx.world.challengeNinja?.(targetId);
    if (res?.ok) {
      this.ctx.announce(`Bắt đầu tỉ thí nhẫn thuật với ${res.target ?? 'đối thủ'}!`);
    } else if (res?.reason) {
      this.ctx.announce(res.reason);
    }
  }

  render(): void {
    const controlled = this.controlledId ? this.ctx.agent(this.controlledId) : null;
    const selected = !controlled && this.selectedAgentId ? this.ctx.agent(this.selectedAgentId) : null;
    const activeAgent = controlled ?? selected;

    if (!activeAgent) {
      setHidden(this.el, true);
      return;
    }

    setHidden(this.el, false);
    this.el.classList.toggle('is-controlling', !!controlled);

    // Avatar
    const avatarUrl = resolveNinjaAvatarUrl(activeAgent.name);
    if (avatarUrl) {
      this.avatarImg.src = avatarUrl;
      setHidden(this.avatarImg, false);
      setHidden(this.avatarFallback, true);
    } else {
      setHidden(this.avatarImg, true);
      setHidden(this.avatarFallback, false);
    }

    if (controlled) {
      // Đang trong chế độ điều khiển người chơi
      setText(this.titleEl, `⚔️ ĐANG ĐIỀU KHIỂN: ${activeAgent.name}`);
      setHidden(this.controlToggleBtn, true);
      setHidden(this.challengeBtn, false);
      setHidden(this.exitBtn, false);

      const nearby = this.ctx.world.getNearbyNinjas?.(6) ?? [];
      const nearest = nearby[0];
      if (nearest) {
        setText(this.challengeBtn, `⚔️ Thách Đấu ${nearest.name} (${nearest.dist}m) [E / Space]`);
        this.challengeBtn.disabled = false;
        this.challengeBtn.classList.add('can-duel');
        setText(this.hintEl, `WASD/Mũi tên: Di chuyển | Shift: Phi thân | Chuột: Bấm sàn để đi | Đang cạnh: ${nearest.name}`);
      } else {
        setText(this.challengeBtn, '⚔️ Khiêu Chiến (E / Space) — Hãy áp sát đối thủ');
        this.challengeBtn.disabled = true;
        this.challengeBtn.classList.remove('can-duel');
        setText(this.hintEl, 'WASD/Mũi tên: Di chuyển | Shift: Phi thân | Chuột: Bấm sàn để đi | Hãy lại gần ninja khác để khiêu chiến');
      }
    } else if (selected) {
      // Đang chọn một nhân vật, gợi ý điều khiển
      setText(this.titleEl, `Nhẫn Giả: ${selected.name}`);
      setText(this.hintEl, 'Bấm nút hoặc gõ phím C để nhập hồn trực tiếp điều khiển nhẫn giả này giao đấu!');
      setHidden(this.controlToggleBtn, false);
      setHidden(this.challengeBtn, true);
      setHidden(this.exitBtn, true);
    }
  }

  destroy(): void {
    this.offControlled?.();
    this.offSelect?.();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.clearMoveKeys);
    }
    this.el.remove();
  }
}
