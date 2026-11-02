// Dàn nhân vật cục bộ (Giám đốc, trưởng phòng ảo, NPC ninja) và đại chiến: ai đi lại, ai được lên sàn.
import { describe, expect, it } from 'vitest';
import type { AgentInfo, OfficeSnapshot, RoomInfo } from '../../../../shared/types';
import type { Appearance, ArtModule, RoomTheme } from '../../art/api';
import { DEFAULT_WORLD_OPTIONS } from '../api';
import { DIRECTOR_AGENT_ID, Sim } from './sim';

const theme: RoomTheme = {
  carpet: '#4f6d8f',
  carpet2: '#486685',
  wall: { base: '#e6e2da', trim: '#9a8f80', pattern: 'plain' },
  accent: '#3f7fd8',
  deskVariant: 'wood',
  chairVariant: 'black',
};

const appearance: Appearance = {
  skin: '#f0c8a0',
  hair: '#3a2a20',
  hairStyle: 'short',
  eyes: '#222',
  top: '#3f7fd8',
  topAccent: '#fff',
  topStyle: 'tshirt',
  bottom: '#333',
  shoes: '#111',
  accessory: 'none',
  accessoryColor: '#000',
  lanyard: null,
  look: 'm',
};

const art = { appearanceFromSeed: () => appearance, roomTheme: () => theme } as unknown as ArtModule;

const T0 = 1_700_000_000_000;

function room(id: string, slot: number): RoomInfo {
  return { id, name: id.replace('/', ''), path: id, slot, seed: slot * 99 + 7, createdAt: T0 };
}

function agent(id: string, roomId: string, status: AgentInfo['status'], name: string): AgentInfo {
  return {
    id, kind: 'main', roomId, name, look: 'm', role: 'Agente principal', sessionId: `s-${id}`, account: '.claude', status,
    recent: [], tasks: [], startedAt: T0, lastEventAt: T0, statusSince: T0,
    stats: { toolCalls: 0, tokensIn: 0, tokensOut: 0, subagents: 0 }, seed: id.length * 1234567,
  };
}

function snap(rooms: RoomInfo[], agents: AgentInfo[]): OfficeSnapshot {
  return {
    rev: 1, serverTime: T0, rooms, agents,
    accounts: [{ id: '.claude', short: 'C', name: 'Conta C', color: '#f08a3c', configDir: '~/.claude', sessions: 1, usageStatus: 'ok' }],
    meta: { demo: true, sources: [], startedAt: T0, version: 't' },
  };
}

function run(sim: Sim, clock: { now: number }, seconds: number, each?: () => void): void {
  const steps = Math.round(seconds * 30);
  for (let i = 0; i < steps; i++) {
    clock.now += 1000 / 30;
    sim.update(1 / 30, clock.now);
    each?.();
  }
}

/** Sim của cảnh văn phòng: có Giám đốc, trưởng phòng ảo và dàn NPC ninja. */
function officeSim(): Sim {
  return new Sim(art, () => ({ ...DEFAULT_WORLD_OPTIONS, liveliness: 'calm' }), null, { heads: true });
}

describe('dàn nhân vật ninja cục bộ', () => {
  it('Giám đốc rời bàn đi lại, không ngồi im mãi', () => {
    const sim = officeSim();
    const clock = { now: T0 };
    const director = sim.person(DIRECTOR_AGENT_ID)!;
    const start = { tx: director.tx, ty: director.ty };
    let farthest = 0;
    run(sim, clock, 60, () => {
      farthest = Math.max(farthest, Math.abs(director.tx - start.tx) + Math.abs(director.ty - start.ty));
    });
    expect(farthest).toBeGreaterThan(4);
  });

  it('trưởng phòng ảo đi sang phòng khác hoặc ra hành lang, không chỉ quanh quẩn 3 ô', () => {
    const sim = officeSim();
    const clock = { now: T0 };
    const heads = [...sim.chars.values()].filter((c) => c.id.startsWith('virtual:'));
    expect(heads.length).toBeGreaterThan(0);
    const start = new Map(heads.map((h) => [h.id, { tx: h.tx, ty: h.ty }]));
    const farthest = new Map(heads.map((h) => [h.id, 0]));
    run(sim, clock, 60, () => {
      for (const h of heads) {
        const s = start.get(h.id)!;
        farthest.set(h.id, Math.max(farthest.get(h.id)!, Math.abs(h.tx - s.tx) + Math.abs(h.ty - s.ty)));
      }
    });
    const roamers = [...farthest.values()].filter((d) => d > 8).length;
    expect(roamers).toBeGreaterThanOrEqual(Math.ceil(heads.length / 2));
  });
});

describe('Akatsuki, Thất Kiếm và hành lang', () => {
  it('NPC có nhà ở hành lang xuất hiện trên hành lang, không dồn vào Cổng Làng', () => {
    const sim = officeSim();
    const c = sim.building.corridor.rect;
    for (const id of ['npc:madara', 'npc:pain', 'npc:hidan', 'npc:gai']) {
      const ch = sim.chars.get(id)!;
      expect(ch.ty >= c.y && ch.ty < c.y + c.h, `${id} ở (${ch.tx},${ch.ty})`).toBe(true);
    }
  });

  it('Akatsuki chủ động thách đấu ninja cục bộ, và trận tỉ thí tự kết thúc', () => {
    const sim = officeSim();
    const clock = { now: T0 };
    const troublemakers = ['npc:pain', 'npc:itachi', 'npc:kisame', 'npc:hidan', 'npc:kakuzu', 'npc:zabuza'].map((id) => sim.chars.get(id)!);
    const dueled = new Set<string>();
    run(sim, clock, 60, () => {
      for (const t of troublemakers) if (t.gathering) dueled.add(t.id);
    });
    expect(dueled.size).toBeGreaterThanOrEqual(3);
    // sau đó không ai kẹt mãi trong một trận đã kết thúc
    run(sim, clock, 20);
    for (const t of troublemakers) if (t.gathering) expect(t.gathering.phase).not.toBe('ended');
  });

  it('đại chiến rải các cặp đấu dọc hành lang, không quây vào một võ đài', () => {
    const sim = officeSim();
    const clock = { now: T0 };
    run(sim, clock, 1);
    expect(sim.ninjaWar.startBattle('konoha-golden', clock.now)).toBe(true);
    const war = sim.ninjaWar.getState()!;
    expect(war.duelSpots.length).toBe(3);
    const xs = war.duelSpots.map((s) => s.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(sim.building.corridor.rect.w / 2);
  });
});

describe('ngoài toà nhà', () => {
  const outside = (sim: Sim, c: { tx: number; ty: number }): boolean => !sim.building.grid.inside(c.tx, c.ty) || c.tx < 1;

  it('Anbu, Root và cảnh vệ đi tuần ngoài nhà, không bao giờ bước vào trong', () => {
    const sim = officeSim();
    const clock = { now: T0 };
    const patrols = [...sim.chars.values()].filter((c) => sim.isOutdoorPatrol(c));
    const names = patrols.map((c) => c.info.name ?? '');
    expect(names.some((n) => n.includes('Anbu'))).toBe(true);
    expect(names.some((n) => n.includes('Root'))).toBe(true);
    expect(names.some((n) => n.includes('Cảnh Vệ'))).toBe(true);
    const start = new Map(patrols.map((c) => [c.id, { x: c.x, y: c.y }]));
    const moved = new Set<string>();
    run(sim, clock, 40, () => {
      for (const c of patrols) {
        expect(outside(sim, c), `${c.id} ở (${c.tx},${c.ty})`).toBe(true);
        const s = start.get(c.id)!;
        if (Math.hypot(c.x - s.x, c.y - s.y) > 32) moved.add(c.id);
      }
    });
    expect(moved.size).toBe(patrols.length);
  });

  it('NPC trong nhà có lúc ra ngoài rồi quay về, đi bộ chứ không dịch chuyển tức thời', () => {
    const sim = officeSim();
    const clock = { now: T0 };
    const npcs = [...sim.chars.values()].filter((c) => sim.isLocalCast(c) && !sim.isOutdoorPatrol(c));
    const last = new Map(npcs.map((c) => [c.id, { x: c.x, y: c.y }]));
    const wentOut = new Set<string>();
    const cameBack = new Set<string>();
    let maxJump = 0;
    run(sim, clock, 240, () => {
      for (const c of npcs) {
        const p = last.get(c.id)!;
        maxJump = Math.max(maxJump, Math.hypot(c.x - p.x, c.y - p.y));
        p.x = c.x;
        p.y = c.y;
        if (outside(sim, c)) wentOut.add(c.id);
        else if (wentOut.has(c.id)) cameBack.add(c.id);
      }
    });
    expect(wentOut.size).toBeGreaterThan(0);
    expect(cameBack.size).toBeGreaterThan(0);
    expect(maxJump).toBeLessThan(16);
  });

  it('đang ở ngoài mà có đại chiến: đi bộ về qua cửa, không dịch chuyển; đội tuần tra không lên sàn', () => {
    const sim = officeSim();
    const clock = { now: T0 };
    run(sim, clock, 1);
    const naruto = sim.chars.get('npc:naruto')!;
    naruto.placeAtTile(-8, 30);
    naruto.queue.length = 0;
    naruto.step = null;
    expect(sim.ninjaWar.startBattle('konoha-golden', clock.now)).toBe(true);
    const war = sim.ninjaWar.getState()!;
    const drafted = [...war.teamAChars, ...war.teamBChars, ...war.spectatorChars];
    expect(drafted.some((c) => sim.isOutdoorPatrol(c))).toBe(false);
    expect(drafted).toContain(naruto);
    let p = { x: naruto.x, y: naruto.y };
    let maxJump = 0;
    run(sim, clock, 20, () => {
      maxJump = Math.max(maxJump, Math.hypot(naruto.x - p.x, naruto.y - p.y));
      p = { x: naruto.x, y: naruto.y };
    });
    expect(maxJump).toBeLessThan(16);
    expect(naruto.ty >= sim.building.corridor.rect.y && naruto.ty < sim.building.corridor.rect.y + sim.building.corridor.rect.h).toBe(true);
    expect(naruto.tx).toBeGreaterThanOrEqual(1);
  });
});

describe('đại chiến không động tới session thật', () => {
  it('session thật (đang làm hay đang rảnh) không bị chọn làm đấu thủ hay khán giả, kể cả khi trùng tên kịch bản', () => {
    const sim = officeSim();
    const clock = { now: T0 };
    sim.applySnapshot(
      snap([room('/a', 0)], [
        agent('kabuto', '/a', 'working', 'Yakushi Kabuto (Y Thuật)'),
        agent('rong', '/a', 'idle', 'Uzumaki Naruto (Hiền Nhân Cửu Vĩ)'),
      ]),
      clock.now,
    );
    run(sim, clock, 1);
    expect(sim.ninjaWar.startBattle('sannin-clash', clock.now)).toBe(true);
    const war = sim.ninjaWar.getState()!;
    const drafted = [...war.teamAChars, ...war.teamBChars, ...war.spectatorChars].map((c) => c.id);
    expect(drafted).not.toContain('kabuto');
    expect(drafted).not.toContain('rong');
    expect(war.teamAChars.length).toBeGreaterThan(0);
    expect(war.teamBChars.length).toBeGreaterThan(0);
  });

  it('đấu thủ và khán giả đã tới chỗ thì đứng yên quanh võ đài suốt pha giao tranh, không đi lang thang', () => {
    const sim = officeSim();
    const clock = { now: T0 };
    run(sim, clock, 1);
    expect(sim.ninjaWar.startBattle('konoha-golden', clock.now)).toBe(true);
    // pha tập kết 5,5 s, rồi chờ thêm để ai ở xa cũng chạy tới chỗ
    run(sim, clock, 12);
    const war = sim.ninjaWar.getState()!;
    expect(war.phase).toBe('clash');
    const arrived = [...war.teamAChars, ...war.teamBChars, ...war.spectatorChars].filter((c) => !c.step && !c.queue.length);
    expect(arrived.length).toBeGreaterThan(10);
    const at = new Map(arrived.map((c) => [c.id, { tx: c.tx, ty: c.ty }]));
    let maxDrift = 0;
    run(sim, clock, 9, () => {
      for (const c of arrived) {
        const p = at.get(c.id)!;
        maxDrift = Math.max(maxDrift, Math.abs(c.tx - p.tx) + Math.abs(c.ty - p.ty));
      }
    });
    expect(maxDrift).toBeLessThanOrEqual(1);
  });
});
