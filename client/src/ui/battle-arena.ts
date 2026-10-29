// ⚔️ Đấu trường Chibi (Battle Royale giải trí): các agent RẢNH biến thành võ sĩ chibi đánh loại
// trực tiếp. Toàn bộ là "show" cục bộ (docs/spec/chibi-battle-royale.md): không đổi trạng thái
// agent thật, không gọi mạng, không vào Habblaud World. Lõi đấu ở world/battle/core.ts.
import { tr } from '../../../shared/i18n';
import type { AgentInfo } from '../../../shared/types';
import { BattleRoyale, type BattleResult, type Fighter } from '../world/battle/core';
import type { OfficeStore } from '../net/store';
import type { UiComponent, UiContext } from './context';
import { h } from './dom';
import { canFight, hpTimeline, pickFighters, roundLabel } from './battle-view';

const ROUND_MS = 900;

/** Điểm cần từ store: danh sách agent hiện có. */
export type BattleStore = Pick<OfficeStore, 'snapshot'>;

interface FighterCard {
  root: HTMLElement;
  bar: HTMLElement;
  hpText: HTMLElement;
  fighter: Fighter;
}

export class BattleArena implements UiComponent {
  readonly button: HTMLElement;
  readonly el: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly roster: HTMLElement;
  private readonly arena: HTMLElement;
  private readonly log: HTMLElement;
  private readonly status: HTMLElement;
  private readonly startBtn: HTMLButtonElement;
  private open = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cards: FighterCard[] = [];

  constructor(private readonly ctx: UiContext) {
    this.button = h('button', {
      class: 'ui-btn ui-btn-battle', type: 'button', text: '⚔️',
      attrs: { 'aria-haspopup': 'dialog', 'aria-label': tr('Arena Chibi: batalha amistosa entre agentes livres') },
      on: { click: () => this.toggle() },
    });
    this.roster = h('div', { class: 'ui-battle__roster' });
    this.arena = h('div', { class: 'ui-battle__arena' });
    this.log = h('div', { class: 'ui-battle__log', attrs: { role: 'log', 'aria-live': 'polite' } });
    this.status = h('p', { class: 'ui-battle__status', role: 'status' });
    this.startBtn = h('button', { class: 'ui-btn ui-battle__start', type: 'button', text: tr('Iniciar batalha'), on: { click: () => this.start() } });
    this.panel = h('section', { class: 'ui-popover ui-battle', role: 'dialog', tabIndex: -1, attrs: { 'aria-label': tr('Arena Chibi'), id: 'ui-battle', popover: 'auto' } },
      h('div', { class: 'ui-battle__head' },
        h('strong', { text: tr('Arena Chibi — só show, nada muda nos agentes') }),
        h('button', { class: 'ui-btn ui-battle__close', type: 'button', text: '×', attrs: { 'aria-label': tr('Fechar') }, on: { click: () => this.hide() } })),
      h('p', { class: 'ui-battle__hint', text: tr('Agentes livres entram na arena; quem sobra leva {0} moedas.', ['🪙50']) }),
      this.roster,
      this.startBtn,
      this.arena,
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
    this.stopTimer();
    if (typeof this.panel.hidePopover === 'function' && this.panel.matches(':popover-open')) this.panel.hidePopover();
    this.panel.classList.remove('is-open');
  }

  render(): void {
    this.button.classList.toggle('is-on', this.open);
    if (this.open) this.renderRoster();
  }

  /** Danh sách võ sĩ sẽ đấu: agent rảnh (fallback: agent hiện diện). */
  private agents(): readonly AgentInfo[] {
    return this.ctx.store.snapshot?.agents ?? [];
  }

  private renderRoster(): void {
    this.roster.replaceChildren();
    this.arena.replaceChildren();
    this.log.replaceChildren();
    this.status.replaceChildren();
    const agents = this.agents();
    if (!canFight(agents)) {
      this.status.textContent = tr('Precisa de pelo menos 3 agentes presentes. Espere alguém ficar livre.');
      this.startBtn.disabled = true;
      return;
    }
    this.startBtn.disabled = false;
    const fighters = pickFighters(agents);
    this.status.textContent = tr('{0} lutadores prontos: só representantes dos agentes reais.', [String(fighters.length)]);
    for (const f of fighters) {
      this.roster.append(h('span', { class: 'ui-battle__chip', text: `${f.symbol} ${f.name}` }));
    }
  }

  private start(): void {
    this.stopTimer();
    const fighters = pickFighters(this.agents());
    if (fighters.length < 3) return;
    const seed = hashOf(fighters.map((f) => f.id).join('|') + String(Math.floor(Date.now() / 60_000)));
    let result: BattleResult;
    try {
      result = new BattleRoyale(fighters, seed).run();
    } catch (err) {
      this.status.textContent = String(err instanceof Error ? err.message : err);
      return;
    }
    const timeline = hpTimeline(result);
    this.log.replaceChildren();
    this.arena.replaceChildren();
    this.cards = result.fighters.map((f) => {
      const bar = h('span', { class: 'ui-battle__bar-fill' });
      const hpText = h('span', { class: 'ui-battle__hp', text: '100' });
      const root = h('div', { class: 'ui-battle__fighter' },
        h('span', { class: 'ui-battle__sym', text: f.symbol, attrs: { 'aria-hidden': 'true' } }),
        h('strong', { class: 'ui-battle__name', text: f.name }),
        h('span', { class: 'ui-battle__bar' }, bar),
        hpText,
      );
      this.arena.append(root);
      return { root, bar, hpText, fighter: f };
    });
    let round = 0;
    this.timer = setInterval(() => {
      if (round >= result.rounds.length) {
        this.stopTimer();
        this.finish(result);
        return;
      }
      const r = result.rounds[round];
      round += 1;
      for (const strike of r.strikes) {
        const card = this.cards.find((c) => c.fighter.id === strike.defender);
        if (!card) continue;
        card.bar.style.width = `${strike.hpAfter}%`;
        card.hpText.textContent = String(strike.hpAfter);
        card.root.classList.toggle('is-down', strike.hpAfter <= 0);
        card.root.classList.toggle('is-hit', strike.hpAfter > 0);
      }
      for (const id of r.eliminated) {
        const card = this.cards.find((c) => c.fighter.id === id);
        if (card) card.root.classList.add('is-out');
      }
      this.log.append(h('p', { class: 'ui-battle__round', text: roundLabel(r.round, result.rounds.length) }),
        ...r.strikes.map((s) => h('p', { class: 'ui-battle__line', text: this.strikeLine(result, s.attacker, s.defender, s.damage, s.move) })));
      this.log.scrollTop = this.log.scrollHeight;
    }, ROUND_MS);
  }

  private strikeLine(result: BattleResult, attacker: string, defender: string, damage: number, move: string): string {
    const name = (id: string) => result.fighters.find((f) => f.id === id)?.name ?? id;
    const kind = move === 'slash' ? tr('golpeia com a espada')
      : move === 'palm' ? tr('acerta a palma de qi')
      : tr('acumula qi');
    return damage > 0 ? `${name(attacker)} ${kind} → ${name(defender)} (−${damage} ❤️)` : `${name(attacker)} ${kind}`;
  }

  private finish(result: BattleResult): void {
    const champion = result.champion;
    const card = this.cards.find((c) => c.fighter.id === champion.id);
    if (card) card.root.classList.add('is-champion');
    this.status.textContent = tr('{0} vence a arena e leva {1} moedas! As demais levam {2} por participar.', [champion.name, '🪙50', '🪙10']);
    this.log.append(h('p', { class: 'ui-battle__champ', text: tr('Campeão: {0}', [champion.name]) }));
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
