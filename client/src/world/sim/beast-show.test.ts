import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../../../shared/hash';
import { BEAST_KINDS, type BeastKind } from '../../art/beasts';
import { BeastShow, BEAST_FORMS, WILD_BEASTS, type BeastShowHost } from './beast-show';
import type { Character } from './character';

const T0 = 1_000_000;

function fakeChar(id: string, name: string): Character {
  return { id, x: 100, y: 200, gone: false, leaving: false, gathering: null, queue: [{ t: 'act' }], step: { t: 'act' }, info: { name }, setPose() {} } as unknown as Character;
}

function makeHost(names: string[], over: Partial<Omit<BeastShowHost, 'chars'>> = {}): BeastShowHost & { chars: Map<string, Character> } {
  const chars = new Map(names.map((n, i) => [`npc:${i}`, fakeChar(`npc:${i}`, n)]));
  return {
    chars,
    building: { cols: 7 },
    isLocalCast: (c) => c.id.startsWith('npc:'),
    isOutdoorPatrol: () => false,
    isInBattle: () => false,
    battleActive: () => false,
    ...over,
  };
}

const CAST = ['Uzumaki Naruto', 'Kazekage Gaara', 'Killer Bee', 'Yugito Nii', 'Uchiha Sasuke', 'Uchiha Itachi', 'Uchiha Madara', 'Tobi Uchiha Obito', 'Tiên Nhân Jiraiya', 'Hokage Tsunade', 'Haruno Sakura', 'Orochimaru', 'Sarutobi Hiruzen'];

describe('màn hoá hình', () => {
  it('xoay vòng đủ mọi con: 19 hình đều được thấy, không chờ đại chiến', () => {
    const show = new BeastShow(makeHost(CAST), mulberry32(5));
    const seen = new Set<BeastKind>();
    for (let now = T0; now < T0 + 30 * 60_000; now += 500) {
      show.update(now);
      for (const e of show.active) seen.add(e.kind);
    }
    expect([...BEAST_KINDS].filter((k) => !seen.has(k))).toEqual([]);
    expect(BEAST_FORMS.length + WILD_BEASTS.length).toBeGreaterThanOrEqual(BEAST_KINDS.length);
  });

  it('màn đầu tiên diễn ra sớm và mỗi màn không kéo dài mãi', () => {
    const show = new BeastShow(makeHost(CAST), mulberry32(1));
    show.update(T0);
    expect(show.active.length).toBe(0);
    show.update(T0 + 12_500);
    expect(show.active.length).toBe(1);
    show.update(T0 + 12_500 + 15_000);
    expect(show.active.length).toBe(0);
  });

  it('session thật trùng tên không bao giờ hoá hình', () => {
    const host = makeHost(CAST);
    host.chars.set('session', fakeChar('session', 'Uzumaki Naruto (Hiền Nhân)'));
    const show = new BeastShow({ ...host, isLocalCast: (c) => c.id.startsWith('npc:') && c.id !== 'npc:0' }, mulberry32(9));
    for (let now = T0; now < T0 + 30 * 60_000; now += 500) {
      show.update(now);
      for (const e of show.active) {
        expect(e.owner?.id).not.toBe('session');
        expect(e.owner?.id).not.toBe('npc:0');
      }
    }
  });

  it('đang đại chiến thì không diễn màn lẻ; vào giao tranh thì đấu thủ hoá hình tới hết pha', () => {
    let battle = true;
    const host = makeHost(CAST, { battleActive: () => battle });
    const show = new BeastShow(host, mulberry32(3));
    for (let now = T0; now < T0 + 120_000; now += 1_000) show.update(now);
    expect(show.active.length).toBe(0);
    battle = false;
    const fighters = [...host.chars.values()].slice(0, 6);
    fighters.forEach((c, i) => {
      c.x = i * 300;
    });
    show.onBattleClash(fighters, T0 + 200_000, T0 + 218_000);
    expect(show.active.length).toBe(3);
    expect(show.active.every((e) => e.endAt === T0 + 218_000)).toBe(true);
    expect(show.active.every((e) => show.isEngaged(e.owner!))).toBe(true);
  });

  it('trong đại chiến, các hình không đứng dính vào nhau', () => {
    const host = makeHost(CAST);
    const show = new BeastShow(host, mulberry32(4));
    show.onBattleClash([...host.chars.values()].slice(0, 6), T0, T0 + 18_000);
    expect(show.active.length).toBe(1);
  });

  it('người hoá hình dừng việc đang làm và hình đứng đúng chỗ của họ', () => {
    const host = makeHost(['Uzumaki Naruto']);
    const show = new BeastShow(host, mulberry32(2));
    let t = T0;
    while (!show.active.some((e) => e.owner) && t < T0 + 60 * 60_000) show.update((t += 500));
    const e = show.active.find((a) => a.owner)!;
    expect(e.owner!.queue.length).toBe(0);
    expect(e.owner!.step).toBeNull();
    e.owner!.x = 321;
    show.update(t + 100);
    expect(e.x).toBe(321);
  });
});
