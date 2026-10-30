// ⚔️ Đấu trường Ninja (Battle Royale giải trí): các agent RẢNH biến thành nhẫn giả của các làng,
// giao chiến trên canvas bằng jutsu (phi tiêu, Hỏa Đạn, Triệu Hồi, Ảnh Phân Thân, Thân Thế Thân,
// Tụ Chakra). Toàn bộ là "show" cục bộ (docs/spec/chibi-battle-royale.md §0): không đổi trạng thái
// agent thật, không gọi mạng, không vào Habblaud World. Lõi đấu ở world/battle/core.ts.
import { tr } from '../../../shared/i18n';
import type { AgentInfo } from '../../../shared/types';
import { BattleScene } from '../world/battle/scene';
import type { BattleResult, Strike } from '../world/battle/core';
import type { UiComponent, UiContext } from './context';
import { h } from './dom';
import { canFight, pickFighters, roundLabel, villageOf } from './battle-view';
import type { OfficeStore } from '../net/store';

const CONFETTI = ['🎉', '✨', '🎊', '⚔️', '🪙'] as const;

/** Điểm cần từ store: danh sách agent hiện có. */
export type BattleStore = Pick<OfficeStore, 'snapshot'>;

export class BattleArena implements UiComponent {
  readonly button: HTMLElement;
  readonly el: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly roster: HTMLElement;
  private readonly canvasHost: HTMLElement;
  private readonly log: HTMLElement;
  private readonly status: HTMLElement;
  private readonly startBtn: HTMLButtonElement;
  private open = false;
  private scene: BattleScene | null = null;
  private fighters: ReturnType<typeof pickFighters> = [];
  private seed = 1;

  constructor(private readonly ctx: UiContext) {
    this.button = h('button', {
      class: 'ui-btn ui-btn-battle', type: 'button', text: '⚔️',
      attrs: { 'aria-haspopup': 'dialog', 'aria-label': tr('Arena Ninja: batalha amistosa entre agentes livres') },
      on: { click: () => this.toggle() },
    });
    this.roster = h('div', { class: 'ui-battle__roster' });
    this.canvasHost = h('div', { class: 'ui-battle__canvas-host' });
    this.log = h('div', { class: 'ui-battle__log', attrs: { role: 'log', 'aria-live': 'polite' } });
    this.status = h('p', { class: 'ui-battle__status', role: 'status' });
    this.startBtn = h('button', { class: 'ui-btn ui-battle__start', type: 'button', text: tr('Iniciar batalha'), on: { click: () => this.start() } });
    this.panel = h('section', { class: 'ui-popover ui-battle', role: 'dialog', tabIndex: -1, attrs: { 'aria-label': tr('Arena Ninja'), id: 'ui-battle', popover: 'auto' } },
      h('div', { class: 'ui-battle__head' },
        h('strong', { text: tr('Aldeia Ninja — só show, nada muda nos agentes') }),
        h('button', { class: 'ui-btn ui-battle__close', type: 'button', text: '×', attrs: { 'aria-label': tr('Fechar') }, on: { click: () => this.hide() } })),
      h('p', { class: 'ui-battle__hint', text: tr('Ninjas das aldeias entram na arena e lutam com jutsu; quem sobra leva {0}.', ['🪙50']) }),
      this.roster,
      this.startBtn,
      this.canvasHost,
      this.log,
      this.status,
    );
    this.el = h('div', { class: 'ui-battle-root' }, this.panel);
  }

  toggle(): void { this.open ? this.hide() : this.show(); }

  show(): void {
    this.open = true;
    if (typeof this.panel.showPopover === 'function') this.panel.showPopover(); else this.panel.classList.add('is-open');
    this.renderRoster();
  }

  hide(): void {
    this.open = false;
    this.scene?.destroy();
    this.scene = null;
    if (typeof this.panel.hidePopover === 'function' && this.panel.matches(':popover-open')) this.panel.hidePopover();
    this.panel.classList.remove('is-open');
  }

  render(): void {
    this.button.classList.toggle('is-on', this.open);
    if (this.open) this.renderRoster();
  }

  private agents(): readonly AgentInfo[] {
    return this.ctx.store.snapshot?.agents ?? [];
  }

  private renderRoster(): void {
    this.roster.replaceChildren();
    this.log.replaceChildren();
    this.canvasHost.replaceChildren();
    this.status.replaceChildren();
    const agents = this.agents();
    if (!canFight(agents)) {
      this.status.textContent = tr('Precisa de pelo menos 3 agentes presentes. Espere alguém ficar livre.');
      this.startBtn.disabled = true;
      return;
    }
    this.startBtn.disabled = false;
    this.fighters = pickFighters(agents);
    const villages = [...new Set(this.fighters.map((f) => villageOf(f.family).name))];
    this.status.textContent = tr('{0} ninjas de {1} aldeias prontos: só representantes dos agentes reais.', [String(this.fighters.length), villages.join(', ')]);
    for (const f of this.fighters) {
      const v = villageOf(f.family);
      const chip = h('span', { class: 'ui-battle__chip', text: `${v.emoji} ${f.name} · ${v.name}` });
      chip.style.setProperty('--village-color', v.color);
      this.roster.append(chip);
    }
  }

  private start(): void {
    this.scene?.destroy();
    this.scene = null;
    this.fighters = pickFighters(this.agents());
    if (this.fighters.length < 3) return;
    this.seed = (Date.now() % 1_000_000) ^ this.fighters.length;
    this.log.replaceChildren();
    this.canvasHost.replaceChildren();
    const canvas = h('canvas', { class: 'ui-battle__canvas', attrs: { 'aria-label': tr('Arena Ninja'), role: 'img' } });
    this.canvasHost.append(canvas);
    this.scene = new BattleScene(canvas, this.fighters, this.seed, {
      onStrike: (s, round, total) => this.appendStrike(s, round, total),
      onDone: (r) => this.finish(r),
    });
    this.scene.start();
  }

  private appendStrike(s: Strike, round: number, total: number): void {
    const name = (id: string): string => this.fighters.find((f) => f.id === id)?.name ?? id;
    if (round === 1 || this.log.dataset.lastRound !== String(round)) {
      this.log.dataset.lastRound = String(round);
      this.log.append(h('p', { class: 'ui-battle__round', text: roundLabel(round, total) }));
    }
    if (s.negated) {
      this.log.append(h('p', { class: 'ui-battle__line', text: `${name(s.defender)} ${tr('contra-ataca com Substituição!')} ${name(s.attacker)} −${COUNTER_DMG} 🌀` }));
    } else if (s.failed) {
      this.log.append(h('p', { class: 'ui-battle__line', text: `${name(s.attacker)} ${tr('falha na invocação')} 😵` }));
    } else if (s.damage > 0) {
      this.log.append(h('p', { class: 'ui-battle__line', text: `${name(s.attacker)} ${JUTSU_VERB[s.jutsu]()} → ${name(s.defender)} (−${s.damage} ❤️)` }));
    } else if (s.jutsu === 'focus') {
      this.log.append(h('p', { class: 'ui-battle__line', text: `${name(s.attacker)} ${JUTSU_VERB[s.jutsu]()} ⚡` }));
    }
    this.log.scrollTop = this.log.scrollHeight;
  }

  private finish(result: BattleResult): void {
    const champion = result.champion;
    this.status.textContent = tr('{0} vence a arena e leva {1} moedas! As demais levam {2} por participar.', [champion.name, '🪙50', '🪙10']);
    this.log.append(h('p', { class: 'ui-battle__champ', text: tr('Campeão: {0}', [champion.name]) }));
    this.log.scrollTop = this.log.scrollHeight;
    for (let i = 0; i < 16; i++) {
      const piece = h('span', { class: 'ui-battle__confetti', text: CONFETTI[i % CONFETTI.length] });
      piece.style.left = `${(i * 23 + champion.name.length * 7) % 92}%`;
      piece.style.animationDelay = `${(i % 5) * 0.12}s`;
      this.canvasHost.append(piece);
      window.setTimeout(() => piece.remove(), 2600);
    }
  }
}

/** Động từ jutsu cho log (qua tr(), nguồn PT). */
const JUTSU_VERB: Readonly<Record<Strike['jutsu'], () => string>> = {
  shuriken: () => tr('lança shuriken em'),
  fireball: () => tr('cospe Bola de Fogo em'),
  summon: () => tr('invoca o espírito da aldeia contra'),
  'shadow-clone': () => tr('ataca com clones das sombras contra'),
  substitution: () => tr('prepara o Substituição em'),
  focus: () => tr('concentra chakra'),
};

const COUNTER_DMG = 6;
