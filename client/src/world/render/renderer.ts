// Desenho do mundo por frame: camada externa -> pisos -> paredes/itens de parede -> entidades
// ordenadas por profundidade -> luz/escuridão -> ícones. A passada em espaço de tela (texto
// nítido) fica em overlay.ts.
import { TILE, type ArtModule, type CharacterFrameRequest, type IconName, type ScreenMode, type Sprite } from '../../art/api';
import type { SeasonalTheme, WorldOptions } from '../api';
import type { WorldAssets } from '../assets';
import type { Camera } from '../camera';
import { resolveNinjaAvatarUrl } from '../../../../shared/local-character-roster';
import { BUILDING_H, COL_W, CORE_COLS, CORRIDOR_Y, EXT_EAST, EXT_NORTH, EXT_WEST } from '../constants';
import { layoutExterior, slotShell, type ExteriorLayout, type SlotShell } from '../layout/exterior';
import { slotAt } from '../layout/geometry';
import type { ExteriorProp } from '../layout/types';
import { screenModeFor } from '../sim/behavior';
import type { Character } from '../sim/character';
import type { RoomState } from '../sim/room-state';
import { cobwebScale, hourglassIcon, HOURGLASS_FLIP_MS, STORM_LIFT } from '../sim/shell';
import type { Sim } from '../sim/sim';
import { buildAnim, furnitureScale, NO_ANIM, sweepDelay, type BuildAnim } from './anim';
import { daylightModeOf, parseHourParam } from './daylight';
import { RoomFxRenderer } from './github-fx';
import { Lighting } from './lighting';
import { Particles } from './particles';
import { carSprite, propSprite, shadowSprite } from './props';
import { countBadge, fallbackIcon } from './shell-sprites';
import { decorateElevator, drawSeasonalLights, drawSeasonalWindow, seasonalCostume, seasonalFurniture } from './seasonal';

/** Màu băng đô ninja theo làng của agent. */
function villageColorFor(family: string): string {
  switch (family) {
    case 'claude': return '#3f7a3f'; // Làng Lá 🍃
    case 'codex': return '#c2a24a';  // Làng Cát ⏳
    case 'opencode': return '#5b7fa6'; // Làng Sương 🌫️
    case 'gemini-antigravity':
    case 'gemini':
    case 'antigravity': return '#8a6a4a'; // Làng Đá 🪨
    case 'review': return '#b28a36'; // Làng Mây ⚡
    default: return '#4d9970'; // Làng Cỏ 🌿
  }
}
import { buildAreaVis, furnitureSprites, opaqueBounds, paintShell, toWallVis, WALL_MARGIN, wallItemOrigin, wallSprites, type AreaVis, type FurnVis, type WallVis } from './scene';

const enum K {
  FurnBase,
  FurnFront,
  Char,
  Prop,
  Car,
}

interface Ent {
  k: K;
  y: number;
  ref: FurnVis | Character | ExteriorProp | Car | null;
  area: AreaVis | null;
  scale: number;
}

interface Car {
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  variant: number;
}

/** Posição da cabeça (px de mundo) de cada personagem desenhado neste frame. */
export interface HeadInfo {
  x: number;
  y: number;
  feetY: number;
  visible: boolean;
  /** Retângulo do sprite (px de mundo) para hit-test. */
  bx: number;
  by: number;
  bw: number;
  bh: number;
  depth: number;
}

const TV_MODES: ScreenMode[] = ['browser', 'idle', 'chat', 'code'];
/**
 * Boca do balde de pipoca (px relativos aos pés) na pose 'wait' sentada, por direção — segue o rig
 * da arte: abraçado no peito de frente, ao lado do quadril de costas, no colo de perfil.
 */
const POPCORN_DX: Readonly<Record<string, number>> = { down: 0, up: -9, left: -5, right: 5 };
const POPCORN_DY: Readonly<Record<string, number>> = { down: 11, up: 8, left: 9, right: 9 };
/** Teia ao lado de um vizinho: no máximo isto (px) para fora do corpo. */
const WEB_MAX_OUT = 9;
/** Tom das bordas da área externa (vinheta) e do gramado além dela. */
const VIGNETTE_ALPHA = 0.2;
const VIGNETTE_EDGE = `rgba(18,40,26,${VIGNETTE_ALPHA})`;

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly areas = new Map<string, AreaVis>();
  readonly heads = new Map<string, HeadInfo>();
  exterior: ExteriorLayout;
  shells: SlotShell[] = [];
  shellWindows: WallVis[] = [];
  private base: HTMLCanvasElement | null = null;
  private baseX = 0;
  private baseY = 0;
  private baseCols = -1;
  private layoutVersion = -1;
  private assetsVersion = 0;
  private builtAssetsVersion = 0;
  cars: Car[] = [];
  private nextCarAt = 0;
  private ents: Ent[] = [];
  private pool: Ent[] = [];
  private date = new Date();
  private icons: { x: number; y: number; name: IconName; bounce: number; alpha: number; badge: number }[] = [];
  /** Pipoca, confete e chuva (pool fixo). */
  readonly particles = new Particles();
  /** Festa e alarme das salas (eventos do GitHub). */
  private readonly roomFx = new RoomFxRenderer();
  /** dt do frame atual (s), para as partículas emitidas durante o desenho. */
  private dt = 0;
  private iconCount = 0;
  private elevatorVis: WallVis[] = [];
  private occupiedSlots = new Set<number>();
  /** Hora forçada (?hora=21:30 na URL ou depuração) ou null para a hora local. */
  hourOverride: number | null = parseHourParam(typeof location === 'undefined' ? '' : location.search);
  /** Relógio da hora do dia (céu, iluminação, relógio de parede); o timelapse troca pelo instante reproduzido. */
  clock: () => number = () => Date.now();
  /** Ciclo dia/noite: mapa de luz e brilhos. */
  readonly lighting: Lighting;
  assets: WorldAssets | null = null;
  /** Último fator noturno aplicado (usado pelo overlay). */
  night = 0;
  private clearColor = '#7fae62';
  private grass: CanvasPattern | null = null;
  private theme: SeasonalTheme = 'none';
  private ninjaImgCache = new Map<string, HTMLImageElement>();

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly art: ArtModule,
    private readonly sim: Sim,
    private readonly camera: Camera,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.exterior = layoutExterior(sim.building.cols);
    this.lighting = new Lighting(art, sim);
  }

  setAssets(a: WorldAssets | null): void {
    this.assets = a;
    this.assetsVersion++;
  }

  // =================================================================== sincronização com a simulação

  /** Mantém caches e visuais coerentes com o prédio atual. */
  sync(theme: SeasonalTheme = 'none'): void {
    const sim = this.sim;
    const themeChanged = theme !== this.theme;
    this.theme = theme;
    const assetsChanged = this.builtAssetsVersion !== this.assetsVersion || themeChanged;
    if (this.baseCols !== sim.building.cols || assetsChanged) this.buildBase();
    if (this.layoutVersion !== sim.layoutVersion || assetsChanged) {
      this.layoutVersion = sim.layoutVersion;
      const want = new Set<string>();
      for (const a of [...sim.building.core, sim.building.corridor]) {
        want.add(a.id);
        const cur = this.areas.get(a.id);
        if (!cur || cur.layout !== a || assetsChanged) this.areas.set(a.id, buildAreaVis(this.art, a, undefined, this.assets, theme));
      }
      for (const room of sim.rooms.values()) {
        if (!room.present) continue;
        want.add(room.id);
      }
      for (const id of [...this.areas.keys()]) if (!want.has(id)) this.areas.delete(id);
      this.elevatorVis = this.areas.get('core:recepcao')?.wallItems.filter((w) => w.kind === 'elevator') ?? [];
    }
    // salas: (re)constrói quando surgem, mudam de layout ou de versão (nome/tema)
    this.occupiedSlots.clear();
    for (const room of sim.rooms.values()) {
      if (!room.present) continue;
      this.occupiedSlots.add(room.slot);
      const cur = this.areas.get(room.id);
      if (!cur || cur.layout !== room.layout || cur.version !== room.version || assetsChanged) {
        this.areas.set(room.id, buildAreaVis(this.art, room.layout, room, this.assets, theme));
      } else cur.room = room;
    }
    for (const [id, vis] of this.areas) if (vis.room && !vis.room.present) this.areas.delete(id);
    this.builtAssetsVersion = this.assetsVersion;
  }

  /** Camada base: área externa, pátios dos slots e fechamentos do corredor. */
  private buildBase(): void {
    const cols = this.sim.building.cols;
    this.baseCols = cols;
    this.exterior = layoutExterior(cols);
    const b = this.exterior.bounds;
    this.baseX = b.x * TILE;
    this.baseY = b.y * TILE;
    const c = document.createElement('canvas');
    c.width = b.w * TILE;
    c.height = b.h * TILE;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(-this.baseX, -this.baseY);
    paintShell(this.art, ctx, this.exterior.floors, []);
    // Đường đất Làng Lá tự nhiên: gờ đất và đá sỏi rải rác (không dùng vạch sơn vàng xe hơi hiện đại)
    const ly = this.exterior.streetY + Math.round(this.exterior.streetH / 2) - 1;
    ctx.fillStyle = 'rgba(120, 80, 40, 0.45)';
    for (let x = this.baseX + 4; x < this.baseX + c.width; x += 18) {
      const stoneOffset = ((x * 19) % 7) - 3;
      ctx.fillRect(x, ly + stoneOffset, 6, 2);
    }
    this.shells = [];
    this.shellWindows = [];
    for (let col = CORE_COLS; col < cols; col++) {
      for (const side of ['north', 'south'] as const) {
        const sh = slotShell(slotAt(col, side), col === cols - 1);
        this.shells.push(sh);
        paintShell(this.art, ctx, sh.floors, sh.walls);
        for (const w of sh.windows) this.shellWindows.push(toWallVis(w, `shell:${sh.slot}`));
      }
    }
    this.desaturate(ctx);
    // fundo além da área desenhada: a própria grama (amostra espelhada 2x2, sem emendas), já no
    // tom da borda da vinheta
    const s = 4 * TILE;
    try {
      const tile = document.createElement('canvas');
      tile.width = 2 * s;
      tile.height = 2 * s;
      const tctx = tile.getContext('2d')!;
      tctx.imageSmoothingEnabled = false;
      for (const [mx, my] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const) {
        tctx.setTransform(mx ? -1 : 1, 0, 0, my ? -1 : 1, mx ? 2 * s : 0, my ? 2 * s : 0);
        tctx.drawImage(c, 0, 0, s, s, 0, 0, s, s);
      }
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      // média da amostra: suaviza as manchas grandes (que viram faixas ao repetir), mantém o capim
      const d = tctx.getImageData(0, 0, 2 * s, 2 * s).data;
      let r = 0;
      let g = 0;
      let bl = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        bl += d[i + 2];
      }
      const n = d.length / 4;
      const avg = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(bl / n)})`;
      tctx.globalAlpha = 0.6;
      tctx.fillStyle = avg;
      tctx.fillRect(0, 0, 2 * s, 2 * s);
      tctx.globalAlpha = 1;
      tctx.fillStyle = VIGNETTE_EDGE;
      tctx.fillRect(0, 0, 2 * s, 2 * s);
      this.grass = this.ctx.createPattern(tile, 'repeat');
      // cor de fundo (antes do padrão carregar): a média já com o tom da vinheta
      const k = VIGNETTE_ALPHA;
      this.clearColor = `rgb(${Math.round((r / n) * (1 - k) + 18 * k)},${Math.round((g / n) * (1 - k) + 40 * k)},${Math.round((bl / n) * (1 - k) + 26 * k)})`;
    } catch {
      this.grass = null;
      this.clearColor = '#6f9a5a';
    }
    this.finishBase(ctx, cols);
    this.base = c;
  }

  /** Grama ~15% menos saturada: o gramado não compete com o escritório. */
  private desaturate(ctx: CanvasRenderingContext2D): void {
    const b = this.exterior.bounds;
    ctx.save();
    try {
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = 'rgba(128,128,128,0.16)';
      ctx.fillRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE);
    } catch {
      // navegador sem o modo de mistura: segue sem dessaturar
    }
    ctx.restore();
  }

  /** Acabamento da camada externa: bordas levemente mais escuras (vinheta) e o capacho da entrada. */
  private finishBase(ctx: CanvasRenderingContext2D, cols: number): void {
    const b = this.exterior.bounds;
    const x0 = b.x * TILE;
    const y0 = b.y * TILE;
    const w = b.w * TILE;
    const h = b.h * TILE;
    ctx.save();
    // vinheta: escurece com a distância ao prédio e chega ao tom da grama "de fora" exatamente na
    // borda da área desenhada (máscara de 1 px por tile, ampliada com suavização)
    const bwT = cols * COL_W;
    const smooth = (a: number, z: number, v: number) => {
      const t = Math.max(0, Math.min(1, (v - a) / Math.max(1e-6, z - a)));
      return t * t * (3 - 2 * t);
    };
    try {
      const m = document.createElement('canvas');
      m.width = b.w;
      m.height = b.h;
      const mctx = m.getContext('2d')!;
      const img = mctx.createImageData(b.w, b.h);
      for (let ty = 0; ty < b.h; ty++) {
        for (let tx = 0; tx < b.w; tx++) {
          const wx = b.x + tx + 0.5;
          const wy = b.y + ty + 0.5;
          const fx = wx < 0 ? smooth(6, -b.x, -wx) : wx > bwT ? smooth(6, b.x + b.w - bwT, wx - bwT) : 0;
          const fy = wy < 0 ? smooth(5, -b.y, -wy) : wy > BUILDING_H ? smooth(12, b.y + b.h - BUILDING_H, wy - BUILDING_H) : 0;
          const i = (ty * b.w + tx) * 4;
          img.data[i] = 18;
          img.data[i + 1] = 40;
          img.data[i + 2] = 26;
          img.data[i + 3] = Math.round(Math.max(fx, fy) * VIGNETTE_ALPHA * 255);
        }
      }
      mctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(m, x0, y0, w, h);
      ctx.imageSmoothingEnabled = false;
    } catch {
      // sem vinheta
    }
    // capacho diante da fachada de vidro da entrada (oeste do corredor)
    const my = (CORRIDOR_Y + 1.25) * TILE;
    ctx.fillStyle = '#3f4652';
    ctx.fillRect(-1.75 * TILE, my, 1.5 * TILE, 2.5 * TILE);
    ctx.fillStyle = '#596170';
    ctx.fillRect(-1.75 * TILE + 2, my + 2, 1.5 * TILE - 4, 2.5 * TILE - 4);
    ctx.fillStyle = '#4b525f';
    for (let y = my + 4; y < my + 2.5 * TILE - 4; y += 3) ctx.fillRect(-1.75 * TILE + 3, y, 1.5 * TILE - 6, 1);

    // Vách núi đá khắc khuôn mặt các Hokage (Hokage Rock / Ải Núi Hokage) ở sườn phía Bắc
    this.drawHokageRockMonument(ctx, cols);

    ctx.restore();
  }

  /** Vẽ dãy tượng đá khổng lồ các Hokage khắc trên núi đá phía sau Konoha */
  private drawHokageRockMonument(ctx: CanvasRenderingContext2D, cols: number): void {
    const totalW = cols * COL_W * TILE;
    // Đẩy vách núi Hokage về gần sát bờ tường phía Bắc để lọt trọn vào tầm mắt người chơi (-120px đến -10px)
    const rockY = -120;
    const rockH = 110;

    ctx.save();
    // 1. Dãy vách núi đá khổng lồ màu nâu xám đặc trưng của Hỏa Quốc
    const grad = ctx.createLinearGradient(0, rockY, 0, rockY + rockH);
    grad.addColorStop(0, '#423326');
    grad.addColorStop(0.3, '#6e5641');
    grad.addColorStop(0.7, '#8a7258');
    grad.addColorStop(1, '#a68f76');
    ctx.fillStyle = grad;
    ctx.fillRect(-EXT_WEST * TILE, rockY, totalW + (EXT_WEST + EXT_EAST) * TILE, rockH);

    // Đường gờ viền đá chân núi và đỉnh núi lởm chởm rêu phong phong trần
    ctx.fillStyle = '#302419';
    for (let x = -EXT_WEST * TILE; x < totalW + EXT_EAST * TILE; x += 10) {
      const crag = ((x * 17) % 11) - 5;
      ctx.fillRect(x, rockY + rockH - 8 + crag, 10, 8 - crag);
      ctx.fillStyle = ((x * 7) % 3 === 0) ? '#2d4a22' : '#302419'; // Đốm rêu xanh bám chân núi
    }

    // 2. Chạm khắc 6 gương mặt Hokage vĩ đại sắc nét và bề thế:
    // 1: Hashirama (Đệ Nhất) | 2: Tobirama (Đệ Nhị) | 3: Hiruzen (Đệ Tam)
    // 4: Minato (Đệ Tứ) | 5: Tsunade (Đệ Ngũ) | 6: Kakashi (Đệ Lục)
    const faces = [
      { name: 'Hashirama', title: '初代', hair: '#171412', mark: 'hashirama' },
      { name: 'Tobirama', title: '二代', hair: '#f1f5f9', mark: 'tobirama' },
      { name: 'Hiruzen', title: '三代', hair: '#57534e', mark: 'hiruzen' },
      { name: 'Minato', title: '四代', hair: '#eab308', mark: 'minato' },
      { name: 'Tsunade', title: '五代', hair: '#fde047', mark: 'tsunade' },
      { name: 'Kakashi', title: '六代', hair: '#cbd5e1', mark: 'kakashi' },
    ];

    const faceSpacing = 72;
    const startX = Math.max(20, (totalW - faces.length * faceSpacing) / 2);

    faces.forEach((f, i) => {
      const fx = startX + i * faceSpacing;
      const fy = rockY + 16;

      // Hốc đá bóng đổ sâu thẳm bao quanh
      ctx.fillStyle = 'rgba(28, 20, 14, 0.72)';
      ctx.beginPath();
      ctx.ellipse(fx + 26, fy + 32, 30, 36, 0, 0, Math.PI * 2);
      ctx.fill();

      // Khối đá khuôn mặt Hokage hùng vĩ
      ctx.fillStyle = '#c2ae97';
      ctx.beginPath();
      ctx.ellipse(fx + 26, fy + 32, 23, 29, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mảng gờ sáng nổi bật
      ctx.fillStyle = '#dbcaa8';
      ctx.beginPath();
      ctx.ellipse(fx + 24, fy + 30, 19, 25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tóc khắc đá biểu trưng
      ctx.fillStyle = f.hair;
      ctx.beginPath();
      ctx.ellipse(fx + 26, fy + 14, 25, 15, 0, Math.PI, 0);
      ctx.fill();

      // Chi tiết khuôn mặt: Hốc mắt, sống mũi cao, cằm vuông cương trực
      ctx.fillStyle = '#5c4533';
      ctx.fillRect(fx + 16, fy + 26, 6, 4); // Mắt trái
      ctx.fillRect(fx + 30, fy + 26, 6, 4); // Mắt phải
      ctx.fillRect(fx + 25, fy + 27, 3, 14); // Sống mũi tạc đá
      ctx.fillRect(fx + 21, fy + 44, 11, 4);  // Miệng

      // CHI TIẾT NHẬN DIỆN TỪNG ĐỜI HOKAGE:
      if (f.mark === 'hashirama') {
        // Tóc dài buông xõa hai bên vai & Băng bảo hộ trán
        ctx.fillStyle = '#171412';
        ctx.fillRect(fx + 3, fy + 18, 6, 32);
        ctx.fillRect(fx + 43, fy + 18, 6, 32);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(fx + 14, fy + 17, 24, 5); // Băng trán ninja
      } else if (f.mark === 'tobirama') {
        // Giáp Happuri bạc bảo vệ má + Vệt sẹo đỏ chiến binh
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(fx + 9, fy + 25, 5, 20);
        ctx.fillRect(fx + 38, fy + 25, 5, 20);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(fx + 11, fy + 32, 2, 8); // Vệt đỏ má trái
        ctx.fillRect(fx + 39, fy + 32, 2, 8); // Vệt đỏ má phải
        ctx.fillRect(fx + 25, fy + 48, 3, 5); // Vệt đỏ ở cằm
      } else if (f.mark === 'hiruzen') {
        // Mũ Hokage trùm đầu & Nếp nhăn hiền từ
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(fx + 12, fy + 4, 28, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(fx + 22, fy + 5, 8, 6);
        ctx.fillStyle = '#3e2c1c';
        ctx.fillRect(fx + 18, fy + 33, 3, 2); // Nốt ruồi đặc trưng
      } else if (f.mark === 'minato') {
        // Tóc gai nhọn tia chớp vàng Minato chìa rộng hai bên
        ctx.fillStyle = '#eab308';
        ctx.fillRect(fx + 3, fy + 10, 8, 12);
        ctx.fillRect(fx + 41, fy + 10, 8, 12);
        ctx.fillRect(fx + 22, fy + 2, 8, 8);
      } else if (f.mark === 'tsunade') {
        // Ấn Bách Hào Thuật màu tím giữa trán & Tóc vàng rẽ ngôi
        ctx.fillStyle = '#9333ea';
        ctx.beginPath();
        ctx.moveTo(fx + 26, fy + 18);
        ctx.lineTo(fx + 29, fy + 22);
        ctx.lineTo(fx + 26, fy + 26);
        ctx.lineTo(fx + 23, fy + 22);
        ctx.closePath();
        ctx.fill();
      } else if (f.mark === 'kakashi') {
        // Khăn bịt mặt ninja che nửa dưới khuôn mặt + Băng đeo trán xéo che một mắt
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(fx + 15, fy + 36, 22, 16); // Mặt nạ vải che miệng & cằm
        ctx.fillStyle = '#475569';
        ctx.fillRect(fx + 14, fy + 20, 10, 12); // Băng trán kéo chéo che mắt trái
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(fx + 18, fy + 23, 2, 6); // Vệt sẹo Sharingan
      }

      // Khối bệ đá khắc Hán tự tôn vinh từng đời Hokage
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(fx + 13, fy + 58, 26, 12);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.title, fx + 26, fy + 68);
    });

    ctx.restore();
  }

  // =================================================================== frame

  frame(now: number, dt: number, opts: WorldOptions, sel: { agent: string | null; room: string | null; hover: string | null }): void {
    const { ctx, camera } = this;
    this.date.setTime(this.clock());
    this.dt = dt;
    this.updateCars(now, dt);
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = this.clearColor;
    ctx.fillRect(0, 0, W, H);
    const { scale, ox, oy } = camera.transform();
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    const vx0 = -ox / scale;
    const vy0 = -oy / scale;
    const vx1 = vx0 + W / scale;
    const vy1 = vy0 + H / scale;
    if (this.grass && this.base) {
      const bx1 = this.baseX + this.base.width;
      const by1 = this.baseY + this.base.height;
      if (vx0 < this.baseX || vy0 < this.baseY || vx1 > bx1 || vy1 > by1) {
        // padrão ancorado na origem do mundo (múltiplo do tile), alinhado à camada base
        ctx.fillStyle = this.grass;
        ctx.save();
        ctx.translate(this.baseX, this.baseY);
        ctx.fillRect(vx0 - this.baseX - 1, vy0 - this.baseY - 1, vx1 - vx0 + 2, vy1 - vy0 + 2);
        ctx.restore();
      }
    }
    const visible = (x: number, y: number, w: number, h: number) => x < vx1 && x + w > vx0 && y < vy1 && y + h > vy0;

    // ---- camada base (só a parte visível)
    if (this.base) {
      const sx = Math.max(0, Math.floor(vx0 - this.baseX) - 1);
      const sy = Math.max(0, Math.floor(vy0 - this.baseY) - 1);
      const sw = Math.min(this.base.width - sx, Math.ceil(vx1 - vx0) + 3);
      const sh = Math.min(this.base.height - sy, Math.ceil(vy1 - vy0) + 3);
      if (sw > 0 && sh > 0) ctx.drawImage(this.base, sx, sy, sw, sh, this.baseX + sx, this.baseY + sy, sw, sh);
    }
    // hora do ciclo dia/noite (preferência ou hora forçada; o relógio de parede acompanha a forçada)
    if (this.hourOverride !== null) {
      const min = Math.round(this.hourOverride * 60);
      this.date.setHours(Math.floor(min / 60) % 24, min % 60);
    }
    const hour = this.lighting.update(now, daylightModeOf(opts), this.hourOverride, this.date);
    const t = now;

    // janelas da fachada nos slots vazios
    for (const w of this.shellWindows) {
      const slot = Number(w.areaId.slice(6));
      const room = this.roomInSlot(slot);
      if (room && room.phase === 'ready') continue;
      if (!visible(w.cx - 24, w.baseY - 40, 48, 44)) continue;
      this.drawWindow(w, hour, t, 1);
    }

    // ---- áreas: piso, paredes e itens de parede
    for (const vis of this.areas.values()) {
      const p = vis.px;
      if (!visible(p.x, p.y - WALL_MARGIN, p.w, p.h + WALL_MARGIN)) continue;
      const anim = vis.room ? buildAnim(vis.room.phase, vis.room.progress(now)) : NO_ANIM;
      this.drawFloor(vis, anim);
    }
    for (const vis of this.areas.values()) {
      const p = vis.px;
      if (!visible(p.x, p.y - WALL_MARGIN, p.w, p.h + WALL_MARGIN)) continue;
      const anim = vis.room ? buildAnim(vis.room.phase, vis.room.progress(now)) : NO_ANIM;
      this.drawWalls(vis, anim, now, hour);
    }
    const view = { x0: vx0, y0: vy0, x1: vx1, y1: vy1 };
    // alarme de CI: tom vermelho no piso (por baixo dos móveis e personagens)
    this.roomFx.drawFloor(ctx, this.sim, now, view);

    // ---- entidades ordenadas por profundidade
    const ents = this.ents;
    ents.length = 0;
    let used = 0;
    const push = (k: K, y: number, ref: Ent['ref'], area: AreaVis | null, scale: number) => {
      let e = this.pool[used];
      if (!e) this.pool[used] = e = { k, y, ref, area, scale };
      else {
        e.k = k;
        e.y = y;
        e.ref = ref;
        e.area = area;
        e.scale = scale;
      }
      used++;
      ents.push(e);
    };
    for (const vis of this.areas.values()) {
      const p = vis.px;
      if (!visible(p.x - TILE, p.y - 3 * TILE, p.w + 2 * TILE, p.h + 4 * TILE)) continue;
      const anim = vis.room ? buildAnim(vis.room.phase, vis.room.progress(now)) : NO_ANIM;
      for (const f of vis.furniture) {
        const s = anim.mode === 'none' ? 1 : furnitureScale(anim, f.order);
        if (s <= 0.01) continue;
        if (!visible(f.ax - 3 * TILE, f.ay - 4 * TILE, 6 * TILE, 4 * TILE + 4)) continue;
        push(K.FurnBase, f.ay, f, vis, s);
        const fs = furnitureSprites(this.art, f, this.furnState(f, now));
        if (fs?.front) push(K.FurnFront, f.ay + 0.5, f, vis, s);
      }
    }
    // os agentes e, na visita, o visitante
    for (const ch of this.sim.people()) {
      const head = this.headOf(ch);
      head.visible = false;
      if (ch.inside || ch.alpha <= 0.01 || now < ch.hiddenUntil) continue;
      if (!visible(ch.x - 24, ch.y - 48, 48, 56)) {
        head.x = ch.x;
        head.y = ch.y - 26;
        head.feetY = ch.y;
        continue;
      }
      push(K.Char, ch.depth(), ch, null, 1);
    }
    for (const prop of this.exterior.props) {
      if (!visible(prop.x - 24, prop.y - 56, 48, 60)) continue;
      let alpha = 1;
      if (prop.whenRoom !== undefined) {
        // ex.: cerca viva diante do caminho do jardim — surge junto com a sala
        const room = this.roomInSlot(prop.whenRoom);
        if (!room) continue;
        if (room.phase === 'building' || room.phase === 'dismantling') {
          const pr = room.progress(now);
          alpha = room.phase === 'building' ? Math.min(1, pr * 3) : 1 - Math.min(1, Math.max(0, (pr - 0.75) * 4));
          if (alpha <= 0.02) continue;
        }
      }
      push(K.Prop, prop.y, prop, null, alpha);
    }
    for (const sh of this.shells) {
      const room = this.roomInSlot(sh.slot);
      let alpha = 1;
      if (room) {
        if (room.phase !== 'building' && room.phase !== 'dismantling') continue;
        const pr = room.progress(now);
        alpha = room.phase === 'building' ? 1 - Math.min(1, pr * 3) : Math.min(1, Math.max(0, (pr - 0.75) * 4));
        if (alpha <= 0.02) continue;
      }
      for (const prop of sh.props) {
        if (!visible(prop.x - 24, prop.y - 56, 48, 60)) continue;
        push(K.Prop, prop.y, prop, null, alpha);
      }
    }
    for (const car of this.cars) if (visible(car.x - 24, car.y - 24, 48, 28)) push(K.Car, car.y, car, null, 1);
    ents.sort((a, b) => a.y - b.y || a.k - b.k);

    this.iconCount = 0;
    for (const e of ents) {
      switch (e.k) {
        case K.FurnBase:
          this.drawFurniture(e.ref as FurnVis, e.area!, e.scale, false, now);
          break;
        case K.FurnFront:
          this.drawFurniture(e.ref as FurnVis, e.area!, e.scale, true, now);
          break;
        case K.Char:
          this.drawCharacter(e.ref as Character, now, sel);
          break;
        case K.Prop:
          this.drawProp(e.ref as ExteriorProp, e.scale);
          break;
        case K.Car:
          this.drawCar(e.ref as Car);
          break;
      }
    }
    this.drawPingPong(now);
    this.drawNinjaDuelFx(now);
    this.drawNinjaTeamBattleFx(now);
    // ---- espera de shell: teias de aranha, confete/pipoca/chuva (por cima das entidades)
    this.drawCobwebs(now);
    this.drainEffects(now);
    this.roomFx.emit(this.particles, this.sim, now, dt, view);
    this.particles.update(dt);
    this.particles.draw(ctx, vx0, vy0, vx1, vy1, now);

    // ---- luz: noite, salas apagadas, brilhos
    this.night = this.lighting.night;
    this.drawLighting(now, vx0, vy0, vx1, vy1);
    if (this.theme !== 'none') {
      for (const vis of this.areas.values()) {
        if (vis.room && vis.room.phase !== 'ready') continue;
        if (!visible(vis.px.x, vis.px.y, vis.px.w, vis.px.h)) continue;
        drawSeasonalLights(ctx, this.theme, vis.layout, vis.room ? vis.room.light(now) : 1);
      }
    }
    // giroflex e balão "!" do alarme de CI (brilham também no escuro)
    this.roomFx.drawLights(ctx, this.sim, this.heads, now, view);

    // ---- ícones sobre as cabeças (por cima da escuridão)
    for (let i = 0; i < this.iconCount; i++) {
      const ic = this.icons[i];
      const s = this.icon(ic.name);
      if (!s) continue;
      ctx.globalAlpha = ic.alpha;
      const ix = Math.round(ic.x - s.ax);
      const iy = Math.round(ic.y - s.ay - ic.bounce);
      ctx.drawImage(s.canvas, ix, iy);
      if (ic.badge > 1) {
        // "×N": mais de um shell rodando
        const b = countBadge(ic.badge);
        ctx.drawImage(b.canvas, ix + s.canvas.width - 1, iy + s.canvas.height - b.ay + 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  private headOf(ch: Character): HeadInfo {
    let h = this.heads.get(ch.id);
    if (!h) this.heads.set(ch.id, (h = { x: 0, y: 0, feetY: 0, visible: false, bx: 0, by: 0, bw: 0, bh: 0, depth: 0 }));
    return h;
  }

  /** Remove entradas de personagens que já saíram. */
  pruneHeads(): void {
    for (const id of this.heads.keys()) if (!this.sim.person(id)) this.heads.delete(id);
  }

  roomInSlot(slot: number): RoomState | undefined {
    if (!this.occupiedSlots.has(slot)) return undefined;
    for (const r of this.sim.rooms.values()) if (r.slot === slot && r.present) return r;
    return undefined;
  }

  // =================================================================== áreas

  private drawFloor(vis: AreaVis, anim: BuildAnim): void {
    const { ctx } = this;
    const p = vis.px;
    if (anim.floor >= 1) {
      ctx.drawImage(vis.floor, p.x, p.y);
      return;
    }
    if (anim.floor <= 0) return;
    // varredura: tiles surgem em diagonal (e somem na ordem inversa na desmontagem)
    const w = vis.layout.rect.w;
    const h = vis.layout.rect.h;
    const k = anim.floor * 1.06;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (sweepDelay(i, j, w, h) > k) continue;
        ctx.drawImage(vis.floor, i * TILE, j * TILE, TILE, TILE, p.x + i * TILE, p.y + j * TILE, TILE, TILE);
      }
    }
  }

  private drawWalls(vis: AreaVis, anim: BuildAnim, now: number, hour: number): void {
    const { ctx } = this;
    const p = vis.px;
    if (anim.walls <= 0) return;
    const rise = Math.round((1 - anim.walls) * 10);
    if (anim.walls < 1) ctx.globalAlpha = anim.walls;
    ctx.drawImage(vis.walls, p.x, p.y - WALL_MARGIN + rise);
    // itens de parede dinâmicos
    for (const w of vis.wallItems) this.drawWallItem(vis, w, now, hour, rise);
    ctx.globalAlpha = 1;
    if (vis.sign && anim.sign > 0) {
      const slide = Math.round((1 - anim.sign) * -18);
      ctx.globalAlpha = anim.sign;
      this.drawSign(vis, vis.sign, slide);
      ctx.globalAlpha = 1;
    }
  }

  private drawWallItem(vis: AreaVis, w: WallVis, now: number, hour: number, rise: number): void {
    const { ctx } = this;
    switch (w.kind) {
      case 'window':
        this.drawWindow(w, hour, now, 1, rise);
        return;
      case 'elevator': {
        const idx = this.elevatorVis.indexOf(w);
        const state = this.sim.elevators[idx]?.state ?? 0;
        const s = wallSprites(this.art, 'elevator', w.variant, state, w.seed);
        if (!s) return;
        const o = wallItemOrigin(w, s.base);
        ctx.drawImage(s.base.canvas, o.x, o.y + rise);
        decorateElevator(ctx, this.theme, w.cx, w.baseY + rise);
        return;
      }
      case 'light_switch': {
        const on = vis.room ? vis.room.lightOn : true;
        const s = wallSprites(this.art, 'light_switch', on ? 'on' : 'off', 0, w.seed);
        if (!s) return;
        const o = wallItemOrigin(w, s.base);
        ctx.drawImage(s.base.canvas, o.x, o.y + rise);
        return;
      }
      case 'clock': {
        const s = wallSprites(this.art, 'clock', w.variant, 0, w.seed);
        if (!s) return;
        const o = wallItemOrigin(w, s.base);
        ctx.drawImage(s.base.canvas, o.x, o.y + rise);
        const r = s.base.rects?.face;
        if (r) this.safe(() => this.art.drawClock(ctx, { x: o.x + r.x, y: o.y + rise + r.y, w: r.w, h: r.h }, this.date));
        return;
      }
      case 'whiteboard': {
        const s = wallSprites(this.art, 'whiteboard', w.variant, 0, w.seed);
        if (!s) return;
        const o = wallItemOrigin(w, s.base);
        ctx.drawImage(s.base.canvas, o.x, o.y + rise);
        const r = s.base.rects?.board;
        if (r) this.safe(() => this.art.drawBoard(ctx, { x: o.x + r.x, y: o.y + rise + r.y, w: r.w, h: r.h }, vis.room?.board ?? [], now));
        return;
      }
      case 'tv': {
        const s = wallSprites(this.art, 'tv', w.variant, 0, w.seed);
        if (!s) return;
        const o = wallItemOrigin(w, s.base);
        ctx.drawImage(s.base.canvas, o.x, o.y + rise);
        const r = s.base.rects?.tv;
        // roda na TV do lounge: o programa escolhido (futebol, novela, desenho) ou o videogame
        const live = this.sim.social.tvScreen();
        const mode = live ? live.mode : TV_MODES[Math.floor(now / 9000) % TV_MODES.length];
        const seed = live ? live.seed : w.seed;
        if (r) this.safe(() => this.art.drawScreen(ctx, { x: o.x + r.x, y: o.y + rise + r.y, w: r.w, h: r.h }, mode, now, seed));
        return;
      }
      case 'mirror': {
        const s = wallSprites(this.art, 'mirror', w.variant, 0, w.seed);
        if (!s) return;
        const o = wallItemOrigin(w, s.base);
        ctx.drawImage(s.base.canvas, o.x, o.y + rise);
        const r = s.base.rects?.glass;
        if (r) this.drawReflection(w, o.x + r.x, o.y + rise + r.y, r.w, r.h);
        return;
      }
      default: {
        const s = wallSprites(this.art, w.kind, w.variant, 0, w.seed);
        if (!s) return;
        const o = wallItemOrigin(w, s.base);
        ctx.drawImage(s.base.canvas, o.x, o.y + rise);
      }
    }
  }

  private drawWindow(w: WallVis, hour: number, now: number, alpha: number, rise = 0): void {
    const { ctx } = this;
    const s = wallSprites(this.art, 'window', w.variant, 0, w.seed);
    if (!s) return;
    const o = wallItemOrigin(w, s.base);
    let r = s.base.rects?.glass;
    if (!r) {
      const b = opaqueBounds(s.base.canvas);
      r = { x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 4 };
    }
    ctx.globalAlpha *= alpha;
    this.safe(() => this.art.drawWindowView(ctx, { x: o.x + r.x, y: o.y + rise + r.y, w: r.w, h: r.h }, hour, now, w.seed));
    drawSeasonalWindow(ctx, this.theme, { x: o.x + r.x, y: o.y + rise + r.y, w: r.w, h: r.h }, now, w.seed);
    ctx.drawImage(s.base.canvas, o.x, o.y + rise);
  }

  /** Placa com o nome (o texto nítido é escrito pelo overlay em espaço de tela). */
  private drawSign(vis: AreaVis, w: WallVis, slide: number): void {
    const { ctx } = this;
    if (!vis.room && this.assets?.signage && vis.id === 'core:recepcao') {
      const a = this.assets.signage;
      const maxW = 5 * TILE;
      const maxH = 24;
      // escala inteira (pixels nítidos) sempre que couber
      const fit = Math.min(maxW / a.w, maxH / a.h);
      const k = fit >= 1 ? Math.floor(fit) : fit;
      const dw = Math.round(a.w * k);
      const dh = Math.round(a.h * k);
      ctx.save();
      ctx.imageSmoothingEnabled = k < 1;
      ctx.drawImage(a.img, Math.round(w.cx - dw / 2), Math.round(w.baseY - 8 - dh) + slide, dw, dh);
      ctx.restore();
      return;
    }
    const s = wallSprites(this.art, 'sign', w.variant, 0, w.seed);
    if (!s) return;
    const o = wallItemOrigin(w, s.base);
    ctx.drawImage(s.base.canvas, o.x, o.y + slide);
  }

  /** Retângulo (px de mundo) da área de texto da placa de uma área, se houver. */
  signRect(vis: AreaVis): { x: number; y: number; w: number; h: number } | null {
    if (!vis.sign) return null;
    if (!vis.room && this.assets?.signage && vis.id === 'core:recepcao') return null;
    const s = wallSprites(this.art, 'sign', vis.sign.variant, 0, vis.sign.seed);
    if (!s) return null;
    const o = wallItemOrigin(vis.sign, s.base);
    const r = s.base.rects?.sign ?? (() => {
      const b = opaqueBounds(s.base.canvas);
      return { x: b.x + 3, y: b.y + 3, w: b.w - 6, h: b.h - 6 };
    })();
    return { x: o.x + r.x, y: o.y + r.y, w: r.w, h: r.h };
  }

  /**
   * Retângulo (px de mundo) do quadro (`painting`) da parede de uma área, pintado junto com as paredes: a cena Visita
   * põe o quadro de carimbos da portaria em cima do da recepção.
   */
  paintingRect(areaId: string): { x: number; y: number; w: number; h: number } | null {
    const vis = this.areas.get(areaId);
    const it = vis?.layout.wallItems.find((x) => x.kind === 'painting');
    if (!vis || !it) return null;
    const w = toWallVis(it, vis.id);
    const s = wallSprites(this.art, 'painting', it.variant === 'wide' ? undefined : it.variant, 0, w.seed);
    if (!s) return null;
    const o = wallItemOrigin(w, s.base);
    const b = opaqueBounds(s.base.canvas);
    return { x: o.x + b.x, y: o.y + b.y, w: b.w, h: b.h };
  }

  /** Luminância média da área de texto da placa (para escolher a cor do texto). */
  signIsDark(vis: AreaVis): boolean {
    const s = vis.sign ? wallSprites(this.art, 'sign', vis.sign.variant, 0, vis.sign.seed) : null;
    if (!s) return false;
    const c = s.base.canvas as HTMLCanvasElement & { __dark?: boolean };
    if (c.__dark !== undefined) return c.__dark;
    let dark = false;
    try {
      const r = s.base.rects?.sign ?? { x: 2, y: 2, w: c.width - 4, h: c.height - 4 };
      const d = c.getContext('2d')!.getImageData(r.x, r.y, Math.max(1, r.w), Math.max(1, r.h)).data;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        n++;
      }
      dark = n > 0 && sum / n < 120;
    } catch {
      dark = false;
    }
    c.__dark = dark;
    return dark;
  }

  // =================================================================== entidades

  private furnState(f: FurnVis, now: number): number {
    if (f.kind === 'coffee_machine') return (this.sim.machineUntil.get(f.id) ?? 0) > now ? 1 : 0;
    if (f.kind === 'toilet_stall') return this.sim.stallBusy.has(f.id) ? 1 : 0;
    return 0;
  }

  private drawFurniture(f: FurnVis, area: AreaVis, scale: number, front: boolean, now: number): void {
    const { ctx } = this;
    const state = this.furnState(f, now);
    const fs = furnitureSprites(this.art, f, state);
    if (!fs) return;
    const s = front ? fs.front : seasonalFurniture(this.theme, f.kind, area.layout, f.seed) ?? fs.base;
    if (!s) return;
    const dx = Math.round(f.ax - s.ax);
    const dy = Math.round(f.ay - s.ay);
    const scaled = scale !== 1;
    if (scaled) {
      ctx.save();
      ctx.translate(f.ax, f.ay);
      ctx.scale(scale, scale);
      ctx.translate(-f.ax, -f.ay);
    }
    ctx.drawImage(s.canvas, dx, dy);
    if (!front) {
      if (f.kind === 'desk' && s.rects?.screen) {
        const r = s.rects.screen;
        const mode = this.deskScreen(f, area);
        this.safe(() => this.art.drawScreen(ctx, { x: dx + r.x, y: dy + r.y, w: r.w, h: r.h }, mode, now, f.seed));
      } else if (f.kind === 'coffee_machine' && state === 1) {
        this.drawSteam(f.ax, dy + 2, now, f.seed);
      } else if (f.kind === 'arcade' && s.rects?.screen) {
        // duelo no fliperama: as duas máquinas mostram a partida
        const seed = this.sim.social.arcadeSeed();
        const r = s.rects.screen;
        if (seed !== null) this.safe(() => this.art.drawScreen(ctx, { x: dx + r.x, y: dy + r.y, w: r.w, h: r.h }, 'game', now, seed));
      }
    }
    if (scaled) ctx.restore();
  }

  /** Tela do monitor: segue a atividade de quem senta ali. */
  deskScreen(f: FurnVis, area: AreaVis): ScreenMode {
    const room = area.room;
    if (room && room.light(this.sim.now) < 0.3) return 'off';
    const owner = f.seatSpot ? this.sim.spots.ownerOf(f.seatSpot) : undefined;
    const ch = owner ? this.sim.chars.get(owner) : undefined;
    if (!ch || ch.leaving) return 'off';
    const seated = ch.atSpot === f.seatSpot;
    if (ch.mode === 'wait') return 'alert';
    if (!seated) return 'idle';
    if (ch.mode === 'work') return screenModeFor(ch.info.activity?.kind);
    // esperando um shell: terminal com a barra de progresso andando (o "filme" da pipoca)
    if (ch.mode === 'shell') return 'progress';
    return 'idle';
  }

  private drawSteam(x: number, y: number, now: number, seed: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const ph = ((now / 900 + i / 3 + (seed % 7) / 7) % 1 + 1) % 1;
      ctx.globalAlpha = 0.75 * (1 - ph);
      const sx = Math.round(x - 1 + Math.sin(ph * 6 + i * 2) * 1.5 + (i - 1));
      const sy = Math.round(y - ph * 9);
      ctx.fillRect(sx, sy, 1, 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawCharacter(ch: Character, now: number, sel: { agent: string | null; hover: string | null }): void {
    const { ctx } = this;
    const head = this.headOf(ch);
    // faixa lateral de quem anda (dois no mesmo caminho não viram um boneco de duas cabeças)
    const x = Math.round(ch.x + ch.offX);
    const y = Math.round(ch.y + ch.offY);
    ctx.globalAlpha = ch.alpha;
    // anéis no chão (seleção, hover, alerta)
    if (ch.mode === 'wait') this.drawAlertRing(x, y, now);
    if (sel.agent === ch.id) this.drawRing(x, y, '#7fe3ff', now, true);
    else if (sel.hover === ch.id) this.drawRing(x, y, '#ffffff', now, false);
    if (!ch.seated) {
      const sh = shadowSprite();
      ctx.drawImage(sh.canvas, x - sh.ax, y - sh.ay);
    }
    let sprite: Sprite | null = null;
    const req: CharacterFrameRequest = this.req;
    req.appearance = ch.appearance;
    req.dir = ch.dir;
    req.pose = ch.pose;
    req.held = ch.held;
    req.charName = ch.info.name;
    const nameLower = (ch.info.name ?? '').toLowerCase();
    const isAkatsuki = nameLower.includes('pain') || nameLower.includes('konan') || nameLower.includes('itachi') || nameLower.includes('kisame') || nameLower.includes('deidara') || nameLower.includes('sasori') || nameLower.includes('hidan') || nameLower.includes('kakuzu') || nameLower.includes('tobi') || nameLower.includes('orochimaru');
    const isHokage = nameLower.includes('hokage') || nameLower.includes('tsunade') || nameLower.includes('hashirama') || nameLower.includes('tobirama') || nameLower.includes('hiruzen') || nameLower.includes('minato') || nameLower.includes('kakashi') || nameLower.includes('cường');
    const isKazekage = nameLower.includes('kazekage') || nameLower.includes('gaara') || nameLower.includes('rasa');
    const isMizukage = nameLower.includes('mizukage') || nameLower.includes('mei') || nameLower.includes('yagura') || nameLower.includes('zabuza');
    const isRaikage = nameLower.includes('raikage') || nameLower.includes('ay') || nameLower.includes('darui');
    const isTsuchikage = nameLower.includes('tsuchikage') || nameLower.includes('ohnoki') || nameLower.includes('mu');

    if (isHokage || isKazekage || isMizukage || isRaikage || isTsuchikage) {
      req.costume = 'kage';
      req.kageRole = isHokage ? 'hokage' : isKazekage ? 'kazekage' : isMizukage ? 'mizukage' : isRaikage ? 'raikage' : 'tsuchikage';
      req.costumeColor = isHokage ? '#dc2626' : isKazekage ? '#d97706' : isMizukage ? '#0284c7' : isRaikage ? '#ca8a04' : '#57534e';
    } else {
      req.costume = 'ninja';
      req.kageRole = undefined;
      req.costumeColor = isAkatsuki ? '#a61c1c' : villageColorFor(ch.info.engine ?? ch.info.provider ?? 'claude');
    }
    try {
      sprite = this.charSprite(req, ch.animT);
    } catch {
      sprite = null;
    }
    if (!sprite && (req.pose === 'wait' || req.held === 'popcorn')) {
      // arte ainda sem a pose de espera/pipoca: sentado parado
      req.pose = req.pose === 'wait' ? 'sit' : req.pose;
      req.held = 'none';
      try {
        sprite = this.charSprite(req, ch.animT);
      } catch {
        sprite = null;
      }
    }
    if (sprite) {
      const sx = x - sprite.ax;
      const sy = y - sprite.ay;
      ctx.drawImage(sprite.canvas, sx, sy);

      // Ảnh anime nguyên mẫu gốc Naruto bay lơ lửng uy phong trên đầu nhân vật
      const avatarUrl = resolveNinjaAvatarUrl(ch.info.name);
      if (avatarUrl) {
        let img = this.ninjaImgCache.get(avatarUrl);
        if (!img) {
          img = new Image();
          img.src = avatarUrl;
          this.ninjaImgCache.set(avatarUrl, img);
        }
        if (img.complete && img.naturalWidth > 0) {
          const sz = 24;
          const px = Math.round(x - sz / 2);
          const py = Math.round(sy - sz - 4);
          ctx.save();
          // Hào quang Chakra bao quanh avatar chân dung
          ctx.beginPath();
          ctx.arc(px + sz / 2, py + sz / 2, sz / 2 + 2, 0, Math.PI * 2);
          ctx.fillStyle = isAkatsuki ? 'rgba(220, 38, 38, 0.45)' : req.kageRole ? 'rgba(234, 179, 8, 0.55)' : 'rgba(56, 189, 248, 0.45)';
          ctx.fill();
          // Khung viền tròn avatar anime
          ctx.beginPath();
          ctx.arc(px + sz / 2, py + sz / 2, sz / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, px, py, sz, sz);
          ctx.restore();
          // Viền vàng kim hoặc đỏ cho avatar
          ctx.save();
          ctx.beginPath();
          ctx.arc(px + sz / 2, py + sz / 2, sz / 2, 0, Math.PI * 2);
          ctx.strokeStyle = req.kageRole ? '#fde047' : isAkatsuki ? '#ef4444' : '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      }

      const b = opaqueBounds(sprite.canvas);
      head.bx = sx + b.x;
      head.by = sy + b.y;
      head.bw = b.w;
      head.bh = b.h;
      head.y = sy + b.y;
    } else {
      head.bx = x - 7;
      head.by = y - 26;
      head.bw = 14;
      head.bh = 26;
      head.y = y - 26;
    }
    ctx.globalAlpha = 1;
    head.x = x;
    head.feetY = y;
    head.visible = true;
    head.depth = ch.depth();
    // ícone sobre a cabeça (desenhado depois da luz)
    let name: IconName | null = ch.mode === 'wait' ? 'alert' : ch.icon;
    const shell = ch.mode === 'shell' && ch.shellSince > 0 && !ch.leaving;
    let badge = 0;
    if (shell && (!name || name === 'zzz')) {
      // ampulheta virando (com "×N" quando há mais de um shell)
      name = hourglassIcon(now);
      badge = ch.shellCount;
    }
    if (name) {
      const bounce =
        name === 'alert'
          ? Math.round(Math.abs(Math.sin(now / 180)) * 4)
          : name === 'zzz'
            ? Math.round(Math.sin(now / 500) * 1.5)
            : name === 'hourglass' || name === 'hourglass_flip'
              ? now % HOURGLASS_FLIP_MS < 110 ? 1 : 0
              : Math.round(Math.max(0, 1 - (now - ch.iconAt) / 250) * 4);
      const lift = name === 'storm' ? STORM_LIFT : 0;
      this.pushIcon(x, head.y - 2 - lift, name, bounce, ch.alpha, badge);
      // chuva: pingos caem da nuvem até a cabeça
      if (name === 'storm' && Math.random() < this.dt * 24) this.particles.rain(x - 3 + Math.floor(Math.random() * 7), head.y - 3 - lift, lift + 1);
    }
    if (shell && ch.shellStage === 'nap' && ch.pose === 'sleep') {
      // cochilando: "zzz" flutuando acima e à direita da ampulheta (o selo "×N" fica embaixo)
      this.pushIcon(x + 10, head.y - 13, 'zzz', Math.round(Math.sin(now / 500) * 1.5), ch.alpha, 0);
    }
    // pipoca pulando do balde de vez em quando
    if (shell && ch.pose === 'wait' && ch.held === 'popcorn' && sprite && now >= ch.popcornAt) {
      ch.popcornAt = now + 450 + Math.random() * 1200;
      const px = x - 1 + (POPCORN_DX[ch.dir] ?? 0);
      const py = y - 1 - (POPCORN_DY[ch.dir] ?? 10);
      this.particles.popcorn(px, py);
      if (Math.random() < 0.3) this.particles.popcorn(px, py);
    }
  }

  private pushIcon(x: number, y: number, name: IconName, bounce: number, alpha: number, badge: number): void {
    if (this.iconCount >= 256) return;
    let ic = this.icons[this.iconCount];
    if (!ic) this.icons[this.iconCount] = ic = { x: 0, y: 0, name, bounce: 0, alpha: 1, badge: 0 };
    ic.x = x;
    ic.y = y;
    ic.name = name;
    ic.bounce = bounce;
    ic.alpha = alpha;
    ic.badge = badge;
    this.iconCount++;
  }

  /** Sprite do personagem no frame da animação (tolera arte sem a pose: contagem/duração inválidas). */
  private charSprite(req: CharacterFrameRequest, animT: number): Sprite {
    const { art } = this;
    const count = Math.max(1, art.poseFrameCount(req.pose) || 1);
    const dur = Math.max(30, art.poseFrameDuration(req.pose) || 500);
    req.frame = Math.floor(animT / dur) % count;
    return art.characterSprite(req);
  }

  /**
   * Teia de aranha no canto do personagem que espera um shell há mais de 10 min (escala inteira:
   * 1x, depois 2x com 20 min). Cochilando, fica coberto: uma teia de cada lado. A teia vai para o
   * lado sem vizinho; com vizinhos dos dois lados, cobre mais o próprio personagem (não invade a
   * mesa ao lado).
   */
  private drawCobwebs(now: number): void {
    // visita: nenhum tempo veio do mundo, então nada de teia
    if (this.sim.visit) return;
    const { ctx } = this;
    for (const ch of this.sim.chars.values()) {
      if (ch.mode !== 'shell' || !ch.shellSince || ch.leaving || !ch.seated || ch.atSpot !== ch.homeSpot) continue;
      const scale = cobwebScale(now - ch.shellSince);
      if (!scale) continue;
      const head = this.heads.get(ch.id);
      if (!head || !head.visible) continue;
      const web = this.icon('cobweb');
      if (!web) return;
      let left = (ch.info.seed & 1) === 0;
      const busyL = this.neighborAt(head, -1);
      const busyR = this.neighborAt(head, 1);
      if (left ? busyL && !busyR : busyR && !busyL) left = !left;
      ctx.globalAlpha = ch.alpha;
      this.drawWeb(web, head, left, scale, left ? busyL : busyR);
      if (ch.shellStage === 'nap') this.drawWeb(web, head, !left, 1, left ? busyR : busyL);
    }
    ctx.globalAlpha = 1;
  }

  /** Alguém visível logo ao lado (mesma fileira, até ~2 mesas) no lado `side` (-1 esquerda, 1 direita)? */
  private neighborAt(head: HeadInfo, side: -1 | 1): boolean {
    for (const h of this.heads.values()) {
      if (h === head || !h.visible || Math.abs(h.feetY - head.feetY) > 10) continue;
      const dx = (h.x - head.x) * side;
      if (dx > 0 && dx < 2.2 * TILE) return true;
    }
    return false;
  }

  /**
   * Uma teia presa no ombro (o canto da teia, em cima, fica para fora do corpo; espelhada do lado
   * direito). Com vizinho do lado, no máximo WEB_MAX_OUT px para fora: o resto cobre o personagem.
   */
  private drawWeb(web: Sprite, head: HeadInfo, left: boolean, scale: number, crowded: boolean): void {
    const { ctx } = this;
    const w = web.canvas.width * scale;
    const h = web.canvas.height * scale;
    const out = crowded ? Math.min(w - 3 * scale, WEB_MAX_OUT) : w - 3 * scale;
    const y = Math.round(head.by + 2);
    if (left) {
      ctx.drawImage(web.canvas, Math.round(head.bx - out), y, w, h);
      return;
    }
    const x = Math.round(head.bx + head.bw + out - w);
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(web.canvas, 0, 0, w, h);
    ctx.restore();
  }

  /**
   * Efeitos pedidos pela simulação: confete (shell concluído) sobre quem comemora, moedinhas voando de
   * quem perdeu a aposta para quem ganhou e o brilho de quem se arrumou no espelho.
   */
  private drainEffects(now: number): void {
    const fx = this.sim.effects;
    for (let i = 0; i < fx.length; i++) {
      const e = fx[i];
      const head = this.heads.get(e.charId);
      if (!head || !head.visible || now - e.at > 1500) continue;
      if (e.kind === 'confetti') this.particles.confetti(head.x, head.y - 4);
      else if (e.kind === 'sparkle') this.particles.sparkle(head.x, head.y + 4);
      else if (e.kind === 'coins') {
        const to = this.heads.get(e.toId);
        if (to && to.visible) this.particles.coins(head.x, head.y + 2, to.x, to.y + 2);
      }
    }
    fx.length = 0;
  }

  private reflectReq: CharacterFrameRequest = {
    appearance: undefined as unknown as CharacterFrameRequest['appearance'],
    dir: 'down',
    pose: 'stand',
    frame: 0,
    held: 'none',
    seated: false,
  };

  /**
   * Reflexo no espelho do banheiro: quem está em pé diante da pia, virado para o espelho, aparece de
   * frente no vidro (rosto centrado, meio transparente, com o véu azulado do vidro por cima).
   */
  private drawReflection(w: WallVis, gx: number, gy: number, gw: number, gh: number): void {
    const { ctx } = this;
    for (const ch of this.sim.chars.values()) {
      if (ch.inside || ch.alpha < 0.5 || ch.dir !== 'up' || ch.seated) continue;
      if (Math.abs(ch.x - w.cx) > 5) continue;
      const dy = ch.y - w.baseY;
      if (dy < 14 || dy > 30) continue;
      const req = this.reflectReq;
      req.appearance = ch.appearance;
      req.pose = ch.pose === 'groom' ? 'groom' : 'stand';
      req.held = ch.pose === 'groom' ? ch.held : 'none';
      req.seated = false;
      req.costume = 'ninja';
      req.costumeColor = villageColorFor(ch.info.engine ?? ch.info.provider ?? 'claude');
      let s: Sprite;
      try {
        s = this.charSprite(req, ch.animT);
      } catch {
        return;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();
      ctx.globalAlpha = 0.8 * ch.alpha;
      ctx.drawImage(s.canvas, Math.round(gx + gw / 2 - s.ax), Math.round(gy - 6));
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#cfe6f2';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.restore();
      return;
    }
  }

  private req: CharacterFrameRequest = {
    appearance: undefined as unknown as CharacterFrameRequest['appearance'],
    dir: 'down',
    pose: 'stand',
    frame: 0,
    held: 'none',
    seated: false,
  };

  private drawRing(x: number, y: number, color: string, now: number, pulse: boolean): void {
    const { ctx } = this;
    const k = pulse ? 1 + Math.sin(now / 220) * 0.08 : 1;
    ctx.save();
    ctx.globalAlpha *= pulse ? 0.95 : 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 8 * k, 3.5 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawAlertRing(x: number, y: number, now: number): void {
    const { ctx } = this;
    const ph = (now % 1100) / 1100;
    ctx.save();
    ctx.strokeStyle = '#ffb11f';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha *= 0.9 * (1 - ph);
    ctx.beginPath();
    ctx.ellipse(x, y, 6 + ph * 12, 2.5 + ph * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawProp(prop: ExteriorProp, alpha: number): void {
    if (prop.kind === 'paving') {
      const c = this.pavingCanvas(prop);
      if (alpha < 1) this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(c, prop.x, prop.y);
      this.ctx.globalAlpha = 1;
      return;
    }
    const s = propSprite(prop);
    if (alpha < 1) this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(s.canvas, Math.round(prop.x - s.ax), Math.round(prop.y - s.ay));
    this.ctx.globalAlpha = 1;
  }

  private pavings = new Map<string, HTMLCanvasElement>();

  /** Trecho de calçada (2x2 tiles) com o mesmo desenho da calçada vizinha (coordenadas de mundo). */
  private pavingCanvas(prop: ExteriorProp): HTMLCanvasElement {
    const key = `${prop.x},${prop.y}`;
    let c = this.pavings.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 2 * TILE;
    c.height = 2 * TILE;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(-prop.x, -prop.y);
    this.safe(() => this.art.drawFloor(ctx, 'sidewalk', prop.x, prop.y, 2 * TILE, 2 * TILE, { seed: prop.seed }));
    this.pavings.set(key, c);
    return c;
  }

  private drawCar(car: Car): void {
    const s = carSprite(car.variant, car.dir < 0);
    this.ctx.drawImage(s.canvas, Math.round(car.x - s.ax), Math.round(car.y - s.ay));
  }

  private updateCars(now: number, dt: number): void {
    const b = this.exterior.bounds;
    const x0 = b.x * TILE - 40;
    const x1 = (b.x + b.w) * TILE + 40;
    if (now >= this.nextCarAt) {
      this.nextCarAt = now + 4000 + Math.random() * 9000;
      const lane = this.exterior.lanes[Math.floor(Math.random() * this.exterior.lanes.length)];
      if (lane) this.cars.push({ x: lane.dir > 0 ? x0 : x1, y: lane.y, dir: lane.dir, speed: 38 + Math.random() * 30, variant: Math.floor(Math.random() * 6) });
    }
    for (const c of this.cars) c.x += c.dir * c.speed * Math.min(dt, 0.1);
    if (this.cars.length) this.cars = this.cars.filter((c) => c.x >= x0 - 10 && c.x <= x1 + 10);
  }

  private drawPingPong(now: number): void {
    const { ctx } = this;
    for (const g of this.sim.social.gatherings) {
      if (g.kind !== 'pingpong' || g.phase !== 'run') continue;
      let a: Character | undefined;
      let b: Character | undefined;
      for (const m of g.members) {
        if (m.role !== 'player' || m.left) continue;
        if (!a) a = this.sim.chars.get(m.id);
        else b = this.sim.chars.get(m.id);
      }
      if (!a || !b) continue;
      const left = a.x < b.x ? a : b;
      const right = a.x < b.x ? b : a;
      const period = 1100;
      const ph = ((now - g.startAt) % (period * 2)) / period;
      const u = ph < 1 ? ph : 2 - ph;
      const x = left.x + 9 + (right.x - left.x - 18) * u;
      const baseY = (left.y + right.y) / 2 - 9;
      const arc = Math.sin(Math.PI * ((u * 2) % 1)) * 6;
      ctx.fillStyle = 'rgba(30,40,60,0.35)';
      ctx.fillRect(Math.round(x) - 1, Math.round(baseY) + 1, 2, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x) - 1, Math.round(baseY - arc) - 1, 2, 2);
    }
  }

  /**
   * Hiệu ứng đại chiến nhẫn thuật tối thượng (Super Ultimate Jutsu FX):
   * Thiết kế hiệu ứng ĐẶC TRƯNG RIÊNG BIỆT 100% THEO TỪNG NHÂN VẬT & NHẪN THUẬT:
   * - Hidan: Vòng tròn Huyết Tế Ma Thuật Jashin tam giác + Xương đen trắng + Cọc huyết đâm xuyên
   * - Haku: Ma Kính Băng Tinh (Kagami) gương băng bao vây + Bão phi kim Senbon
   * - Nara Shikamaru: Kage Mane no Jutsu (Bóng Trói Chi Thuật) tỏa bóng đen răng cưa từ chân trói chặt đối thủ
   * - Orochimaru: Mở Quỷ Môn Quan Rashomon + Đại Mãng Xà Bạch Xà 8 đầu uốn lượn
   * - Zabuza Momochi: Sương Mù Dày Đặc Kirigakure no Jutsu + Đại Thủy Long Độn khổng lồ
   * - Pain Tendo: Địa Bộc Thiên Tinh (Chibaku Tensei) hút đá bay lên + Thần La Thiên Chinh (Shinra Tensei)
   * - Gaara: Đại Bão Sa Mạc Sa Phược Cữu (Sabaku Kyuu) + Tù Ngục Cát & Khiên cát Shukaku
   * - Uchiha (Sasuke/Itachi/Madara): Khung xương Susano'o tím rực lửa + Hắc Hỏa Amaterasu đen kịt
   * - Kakashi: Thiên Điểu Lôi Thiết Chidori / Raikiri sấm sét xanh biếc + Sharingan Kamui xoáy
   * - Tsunade: Cú đấm Quái Lực nứt toác mặt đất + Ấn Bách Hào tím phát sáng
   * - Senju Hashirama: Mộc Độn Thiên Thủ Quan Âm + Rồng Gỗ Mokuryuu
   * - Namikaze Minato / Tobirama: Phi Lôi Thần Thuật dịch chuyển tức thời + Tia chớp vàng
   * - Uzumaki Naruto: Đa Trọng Ảnh Phân Thân + Rasenshuriken Phong Độn & Hóa Cửu Vĩ / Lục Đạo
   */
  private drawNinjaDuelFx(now: number): void {
    const { ctx } = this;
    for (const g of this.sim.social.gatherings) {
      if (g.kind !== 'rps' || g.phase !== 'run') continue;
      let a: Character | undefined;
      let b: Character | undefined;
      for (const m of g.members) {
        if (m.role !== 'player' || m.left) continue;
        if (!a) a = this.sim.chars.get(m.id);
        else b = this.sim.chars.get(m.id);
      }
      if (!a || !b) continue;
      const left = a.x < b.x ? a : b;
      const right = a.x < b.x ? b : a;
      const midX = (left.x + right.x) / 2;
      const midY = (left.y + right.y) / 2 - 12;

      const aName = (a.info.name ?? '').toLowerCase();
      const bName = (b.info.name ?? '').toLowerCase();
      const charOf = (pattern: string): Character | undefined => (aName.includes(pattern) ? a : bName.includes(pattern) ? b : undefined);
      const enemyOf = (ch: Character): Character => (ch === left ? right : left);

      const hidanCh = charOf('hidan');
      const hakuCh = charOf('haku');
      const shikamaruCh = charOf('shikamaru');
      const orochimaruCh = charOf('orochimaru');
      const zabuzaCh = charOf('zabuza');
      const painCh = charOf('pain') || charOf('tendo');
      const gaaraCh = charOf('gaara');
      const sasukeCh = charOf('sasuke');
      const itachiCh = charOf('itachi');
      const madaraCh = charOf('madara');
      const kakashiCh = charOf('kakashi');
      const tsunadeCh = charOf('tsunade');
      const narutoCh = charOf('naruto');
      const hashiramaCh = charOf('hashirama');
      const minatoCh = charOf('minato');
      const tobiramaCh = charOf('tobirama');
      const jiraiyaCh = charOf('jiraiya');

      ctx.save();

      // =========================================================================================
      // 1. HIDAN (BẤT TỬ CHÚ THUẬT - TRẬN ĐỒ HUYẾT TẾ JASHIN & ĐỐI KHÁNG THỂ XÁC)
      // =========================================================================================
      if (hidanCh) {
        const enemy = enemyOf(hidanCh);
        // Vòng tròn trận đồ huyết tế màu đỏ máu có tam giác ngược bên trong dưới chân Hidan
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(hidanCh.x, hidanCh.y - 2, 18, 0, Math.PI * 2);
        ctx.stroke();

        // Tam giác huyết tế Jashin bên trong vòng tròn
        ctx.beginPath();
        for (let t = 0; t < 3; t++) {
          const tAng = (t * Math.PI * 2) / 3 - Math.PI / 2;
          const tx = hidanCh.x + Math.cos(tAng) * 16;
          const ty = hidanCh.y - 2 + Math.sin(tAng) * 16;
          if (t === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        }
        ctx.closePath();
        ctx.stroke();

        // Lời nguyền Huyết Kế: sợi tơ máu kết nối từ tim Hidan sang tim đối thủ
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(hidanCh.x, hidanCh.y - 14);
        ctx.quadraticCurveTo(midX, midY - 24, enemy.x, enemy.y - 14);
        ctx.stroke();
        ctx.setLineDash([]);

        // Hidan đâm cọc sắt nguyền rủa xuyên ngực (hiệu ứng tia máu văng)
        ctx.fillStyle = '#ef4444';
        for (let d = 0; d < 6; d++) {
          const dx = hidanCh.x + Math.sin(now / 70 + d) * 14;
          const dy = hidanCh.y - 14 + Math.cos(now / 90 + d) * 12;
          ctx.fillRect(dx, dy, 2, 2);
        }
      }

      // =========================================================================================
      // 2. HAKU (BĂNG ĐỘN: MA KÍNH BĂNG TINH & PHI KIM SENBON)
      // =========================================================================================
      if (hakuCh) {
        const enemy = enemyOf(hakuCh);
        // Mạng lưới các tấm gương băng hình chữ nhật bao quanh đối thủ (Makyou Hyoushou)
        const mirrorCount = 10;
        for (let m = 0; m < mirrorCount; m++) {
          const mAng = (m * Math.PI * 2) / mirrorCount;
          const mx = enemy.x + Math.cos(mAng) * 32;
          const my = enemy.y - 10 + Math.sin(mAng) * 22;
          // Tấm gương băng phản chiếu ánh xanh lục / xanh lam tuyết
          ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.fillRect(mx - 4, my - 12, 8, 20);
          ctx.strokeRect(mx - 4, my - 12, 8, 20);
          // Vệt sáng lấp lánh phản quang băng tuyết
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(mx - 2, my - 8, 2, 8);
        }

        // Bão mưa kim băng (Senbon) phóng vụt từ các tấm gương vào tâm đối thủ
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1;
        for (let sb = 0; sb < 8; sb++) {
          const needleProg = ((now * 2 + sb * 80) % 400) / 400;
          const fromAng = (sb * Math.PI * 2) / 8;
          const fx = enemy.x + Math.cos(fromAng) * 30 * (1 - needleProg);
          const fy = enemy.y - 10 + Math.sin(fromAng) * 20 * (1 - needleProg);
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + Math.cos(fromAng) * 6, fy + Math.sin(fromAng) * 4);
          ctx.stroke();
        }
      }

      // =========================================================================================
      // 3. NARA SHIKAMARU (ẢNH PHỐC THUẬT - BÓNG TRÓI CHI THUẬT KAGE MANE NO JUTSU)
      // =========================================================================================
      if (shikamaruCh) {
        const enemy = enemyOf(shikamaruCh);
        // Chiếc bóng đen ngoằn ngoèo rướn dài trên mặt đất từ chân Shikamaru sang chân đối phương
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.beginPath();
        ctx.moveTo(shikamaruCh.x - 3, shikamaruCh.y);
        ctx.lineTo(shikamaruCh.x + 3, shikamaruCh.y);
        // Đường bóng răng cưa biến hóa uốn lượn
        const segs = 8;
        for (let s = 1; s <= segs; s++) {
          const u = s / segs;
          const bx = shikamaruCh.x + (enemy.x - shikamaruCh.x) * u;
          const by = shikamaruCh.y + (enemy.y - shikamaruCh.y) * u + Math.sin(u * Math.PI * 3 + now / 120) * 4;
          const w = 3 + Math.sin(u * Math.PI) * 5;
          ctx.lineTo(bx + w, by);
        }
        ctx.lineTo(enemy.x, enemy.y);
        for (let s = segs; s >= 1; s--) {
          const u = s / segs;
          const bx = shikamaruCh.x + (enemy.x - shikamaruCh.x) * u;
          const by = shikamaruCh.y + (enemy.y - shikamaruCh.y) * u + Math.sin(u * Math.PI * 3 + now / 120) * 4;
          const w = 3 + Math.sin(u * Math.PI) * 5;
          ctx.lineTo(bx - w, by);
        }
        ctx.closePath();
        ctx.fill();

        // Vòng tròn bóng trói khóa chặt chân đối thủ
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(enemy.x, enemy.y, 14, 8, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Ảnh Thủ Phược Thuật (Kage Kubi Shibari): bóng đen bò lên bóp cổ kẻ địch
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(enemy.x - 3, enemy.y - 18, 6, 12);
      }

      // =========================================================================================
      // 4. OROCHIMARU (BẠCH XÀ CHI THUẬT & CỔNG QUỶ MÔN LA SINH MÔN RASHOMON)
      // =========================================================================================
      if (orochimaruCh) {
        // Cổng quỷ La Sinh Môn (Rashomon) khổng lồ trồi lên sau lưng Orochimaru
        const rY = orochimaruCh.y - 48;
        ctx.fillStyle = '#334155';
        ctx.fillRect(orochimaruCh.x - 18, rY, 36, 42); // Thân cổng sắt
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(orochimaruCh.x - 20, rY - 4, 40, 6);  // Mái cổng
        // Mặt quỷ đỏ hung dữ ở tâm cổng
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.arc(orochimaruCh.x, rY + 16, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(orochimaruCh.x - 5, rY + 13, 3, 2); // Mắt quỷ
        ctx.fillRect(orochimaruCh.x + 2, rY + 13, 3, 2);

        // Bầy Bạch Xà (Rắn trắng khổng lồ) trườn uốn lượn xung quanh
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 4;
        for (let sn = 0; sn < 3; sn++) {
          const sAngle = sn * 1.8 + now / 150;
          ctx.beginPath();
          ctx.moveTo(orochimaruCh.x, orochimaruCh.y - 10);
          ctx.quadraticCurveTo(
            midX + Math.sin(sAngle) * 20,
            midY + Math.cos(sAngle) * 15,
            midX + Math.cos(sAngle) * 35,
            midY - 10 + Math.sin(sAngle) * 20,
          );
          ctx.stroke();
        }
      }

      // =========================================================================================
      // 5. ZABUZA MOMOCHI (THẤT KIẾM SƯƠNG MÙ - THỦY ĐỘN: ĐẠI THỦY LONG & QUỶ KIẾM)
      // =========================================================================================
      if (zabuzaCh) {
        // Màn sương mù Làng Sương (Kirigakure no Jutsu) trắng đục bốc hơi nghi ngút
        ctx.fillStyle = 'rgba(241, 245, 249, 0.55)';
        for (let f = 0; f < 5; f++) {
          const fx = midX + Math.sin(now / 180 + f) * 38;
          const fy = midY + Math.cos(now / 220 + f) * 22;
          ctx.beginPath();
          ctx.arc(fx, fy, 22 + f * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Thủy Độn: Thủy Long Đạn Thuật (Water Dragon) uốn lượn hùng vĩ
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(zabuzaCh.x, zabuzaCh.y);
        ctx.bezierCurveTo(midX - 25, midY - 45, midX + 25, midY + 25, midX + 35, midY - 20);
        ctx.stroke();

        // Đầu rồng nước có răng nanh và mắt phát sáng
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(midX + 35, midY - 20, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(midX + 33, midY - 22, 3, 3);
      }

      // =========================================================================================
      // 6. GAARA (SA MẠC BÃO CÁT - SA PHƯỢC CỮU SABAKU KYUU & THIÊN CẨU CÁT SHUKAKU)
      // =========================================================================================
      if (gaaraCh) {
        const enemy = enemyOf(gaaraCh);
        // Cát vàng sa mạc cuộn trào từ bình hồ lô phủ kín sàn đấu
        ctx.fillStyle = 'rgba(217, 119, 6, 0.45)';
        ctx.beginPath();
        ctx.ellipse(midX, midY + 12, 45, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sa Phược Cữu (Sabaku Kyuu): Cát bao bọc bóp nghẹt đối thủ
        ctx.fillStyle = '#d97706';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y - 12, 16 + Math.sin(now / 60) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Bàn tay cát khổng lồ (Shukaku Sand Hand) chộp lấy đối phương
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(gaaraCh.x, gaaraCh.y - 12);
        ctx.quadraticCurveTo(midX, midY - 30, enemy.x, enemy.y - 12);
        ctx.stroke();

        // Con mắt cát (Daisan no Me) lơ lửng trên không
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(gaaraCh.x, gaaraCh.y - 38, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.fillRect(gaaraCh.x - 1, gaaraCh.y - 39, 2, 3);
      }

      // =========================================================================================
      // 7. PAIN TENDO (THẦN LA THIÊN CHINH & ĐỊA BỘC THIÊN TINH CHIBAKU TENSEI)
      // =========================================================================================
      if (painCh) {
        // Thần La Thiên Chinh (Shinra Tensei): Sóng xung kích bẻ cong không gian đẩy lùi vạn vật
        const shockRad = 16 + ((now % 1000) / 1000) * 65;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(painCh.x, painCh.y - 14, shockRad, 0, Math.PI * 2);
        ctx.stroke();

        // Địa Bộc Thiên Tinh (Chibaku Tensei): Quả cầu hắc ám hút đất đá trên cao
        const coreY = midY - 36;
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(midX, coreY, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Đá tảng bị hút bay lên trời
        for (let r = 0; r < 8; r++) {
          const rAng = (now / 350 + (r * Math.PI * 2) / 8) % (Math.PI * 2);
          const rx = midX + Math.cos(rAng) * 26;
          const ry = coreY + Math.sin(rAng) * 20;
          ctx.fillStyle = '#78716c';
          ctx.fillRect(rx - 3, ry - 3, 6, 6);
        }
      }

      // =========================================================================================
      // 8. UCHIHA (SASUKE / ITACHI / MADARA - SUSANO'O & HẮC HỎA AMATERASU)
      // =========================================================================================
      if (sasukeCh || itachiCh || madaraCh) {
        const uChar = sasukeCh ?? itachiCh ?? madaraCh!;
        const color = sasukeCh ? '#8b5cf6' : itachiCh ? '#dc2626' : '#2563eb';
        // Khung giáp Susano'o khổng lồ rực lửa Chakra bao quanh
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(uChar.x, uChar.y - 24, 35 + Math.sin(now / 80) * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Xương sườn Susano'o và thanh kiếm Chakra
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(uChar.x - 12, uChar.y - 42, 24, 28);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(uChar.x - 7, uChar.y - 35, 4, 3); // Mắt vàng rực
        ctx.fillRect(uChar.x + 3, uChar.y - 35, 4, 3);

        // Ngọn lửa đen Amaterasu bốc cháy dữ dội ở tâm sàn đấu
        ctx.fillStyle = '#09090b';
        for (let f = 0; f < 7; f++) {
          const fx = midX - 18 + f * 6;
          const fh = 8 + Math.sin(now / 50 + f) * 6;
          ctx.fillRect(fx, midY + 4 - fh, 4, fh);
        }
      }

      // =========================================================================================
      // 9. HATAKE KAKASHI (LÔI THIẾT RAIKIRI & KAMUI KHÔNG GIAN)
      // =========================================================================================
      if (kakashiCh) {
        const enemy = enemyOf(kakashiCh);
        // Lôi Thiết Raikiri (Thiên Điểu xanh biếc nổ lốp bốp trên tay)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(kakashiCh.x + 10, kakashiCh.y - 12, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        for (let s = 0; s < 6; s++) {
          const sAng = s * 1.1 + now / 40;
          ctx.beginPath();
          ctx.moveTo(kakashiCh.x + 10, kakashiCh.y - 12);
          ctx.lineTo(kakashiCh.x + 10 + Math.cos(sAng) * 22, kakashiCh.y - 12 + Math.sin(sAng) * 16);
          ctx.stroke();
        }

        // Hố đen Kamui vặn xoắn không gian ngay trên đầu kẻ địch
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 3; k++) {
          const kAng = now / 100 + k * 1.5;
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y - 24, 12 - k * 3, kAng, kAng + Math.PI * 1.2);
          ctx.stroke();
        }
      }

      // =========================================================================================
      // 10. TSUNADE (QUÁI LỰC NỨT ĐẤT & BÁCH HÀO THUẬT PHÁT SÁNG)
      // =========================================================================================
      if (tsunadeCh) {
        // Ấn Bách Hào Thuật phát sáng rực rỡ tím sen
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(tsunadeCh.x, tsunadeCh.y - 20, 8 + Math.sin(now / 60) * 3, 0, Math.PI * 2);
        ctx.fill();

        // Cú đấm Quái Lực phá tan mặt đất (vết nứt tỏa ra khắp sàn)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        for (let c = 0; c < 6; c++) {
          const cAng = (c * Math.PI * 2) / 6;
          ctx.beginPath();
          ctx.moveTo(midX, midY + 6);
          ctx.lineTo(midX + Math.cos(cAng) * 32, midY + 6 + Math.sin(cAng) * 18);
          ctx.stroke();
        }
      }

      // =========================================================================================
      // 11. SENJU HASHIRAMA (TIÊN PHÁP MỘC ĐỘN: CHÂN SỐ THIÊN THỦ & MỘC LONG)
      // =========================================================================================
      if (hashiramaCh) {
        // Tượng Phật Mộc Thần Thiên Thủ nghìn tay sau lưng Hashirama
        ctx.fillStyle = '#854d0e';
        ctx.beginPath();
        ctx.ellipse(hashiramaCh.x, hashiramaCh.y - 36, 24, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Vành đai các bàn tay gỗ tỏa ra như vầng thái dương
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 2;
        for (let aIdx = 0; aIdx < 16; aIdx++) {
          const angle = Math.PI + (aIdx * Math.PI) / 15;
          const reach = 38 + Math.sin(now / 80 + aIdx) * 5;
          ctx.beginPath();
          ctx.moveTo(hashiramaCh.x, hashiramaCh.y - 36);
          ctx.lineTo(hashiramaCh.x + Math.cos(angle) * reach, hashiramaCh.y - 36 + Math.sin(angle) * reach);
          ctx.stroke();
        }
      }

      // =========================================================================================
      // 12. UZUMAKI NARUTO (RASENSHURIKEN & BIJUUDAMA CỬU VĨ / LỤC ĐẠO)
      // =========================================================================================
      if (narutoCh) {
        // Phân thân Naruto vây quanh hỗ trợ tung Rasenshuriken
        const rRad = 12 + Math.sin(now / 40) * 3;
        const rGrad = ctx.createRadialGradient(midX, midY - 6, 2, midX, midY - 6, rRad + 14);
        rGrad.addColorStop(0, '#ffffff');
        rGrad.addColorStop(0.4, '#38bdf8');
        rGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = rGrad;
        ctx.beginPath();
        ctx.arc(midX, midY - 6, rRad + 14, 0, Math.PI * 2);
        ctx.fill();

        // 4 cánh quạt gió Phong Độn xoay vù vù tốc độ cao
        ctx.strokeStyle = '#f0f9ff';
        ctx.lineWidth = 2.5;
        for (let b = 0; b < 4; b++) {
          const bAngle = (now / 50 + (b * Math.PI) / 2) % (Math.PI * 2);
          ctx.beginPath();
          ctx.moveTo(midX, midY - 6);
          ctx.lineTo(midX + Math.cos(bAngle) * (rRad + 20), midY - 6 + Math.sin(bAngle) * (rRad + 20));
          ctx.stroke();
        }
      }

      // =========================================================================================
      // 13. MINATO & TOBIRAMA (PHI LÔI THẦN THUẬT - DỊCH CHUYỂN TỨC THỜI & TIA CHỚP VÀNG)
      // =========================================================================================
      if (minatoCh || tobiramaCh) {
        const fChar = minatoCh ?? tobiramaCh!;
        const fColor = minatoCh ? '#facc15' : '#38bdf8';
        ctx.strokeStyle = fColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(fChar.x, fChar.y - 12);
        ctx.lineTo(fChar.x + Math.sin(now / 50) * 45, fChar.y - 30);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // =========================================================================================
      // 14. ĐẠI HIỆN DIỆN CHUNG: ĐẠI CHIẾN CHAKRA BÙNG NỔ (NẾU KHÔNG TRÙNG RIÊNG TRÊN)
      // =========================================================================================
      if (!hidanCh && !hakuCh && !shikamaruCh && !orochimaruCh && !zabuzaCh && !gaaraCh && !painCh && !sasukeCh && !itachiCh && !kakashiCh && !tsunadeCh && !narutoCh && !hashiramaCh) {
        const pulse = 4 + Math.sin(now / 80) * 3;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(left.x, left.y - 10, 12 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(right.x, right.y - 10, 12 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Tia sét va chạm ở trung tâm
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(left.x + 8, left.y - 10);
        ctx.lineTo(midX, midY);
        ctx.lineTo(right.x - 8, right.y - 10);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawNinjaTeamBattleFx(now: number): void {
    const war = this.sim.ninjaWar?.getState();
    if (!war || war.phase === 'idle' || war.phase === 'disperse') return;
    const { ctx } = this;
    const ax = war.arenaCenter.x * TILE;
    const ay = war.arenaCenter.y * TILE;

    ctx.save();

    // 1. VÕ ĐÀI TRUNG TÂM & VÀNG HÀO QUANG ĐẠI CHIẾN
    const pulse = Math.sin(now / 150) * 8;
    const rad = 72 + pulse;
    const auraGrad = ctx.createRadialGradient(ax, ay, 10, ax, ay, rad + 40);
    auraGrad.addColorStop(0, war.phase === 'victory' ? 'rgba(255, 215, 0, 0.45)' : 'rgba(239, 68, 68, 0.35)');
    auraGrad.addColorStop(0.5, war.phase === 'victory' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.25)');
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(ax, ay, rad + 40, 0, Math.PI * 2);
    ctx.fill();

    // Vành đai ấn chú trận pháp bảo hộ sàn đấu
    ctx.strokeStyle = war.phase === 'victory' ? '#fbbf24' : '#f97316';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(ax, ay, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. KHI ĐANG GIAO TRANH (CLASH): VẼ CÁC ĐẠI CHIÊU NHẪN THUẬT CHO CÁC ĐẤU THỦ
    if (war.phase === 'clash') {
      // Tia sét và sóng năng lượng va chạm ở giữa tâm võ đài
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let s = 0; s < 5; s++) {
        const ang = (s * Math.PI * 2) / 5 + now / 200;
        const dist = 18 + Math.sin(now / 60 + s) * 12;
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + Math.cos(ang) * dist, ay + Math.sin(ang) * dist);
      }
      ctx.stroke();

      // Hiệu ứng từng nhẫn giả tham gia trận chiến
      const allCombatants = [...war.teamAChars, ...war.teamBChars];
      for (const ch of allCombatants) {
        const n = (ch.info.name ?? '').toLowerCase();
        if (n.includes('naruto')) {
          const rGrad = ctx.createRadialGradient(ch.x + (ch.dir === 'right' ? 14 : -14), ch.y - 10, 2, ch.x + (ch.dir === 'right' ? 14 : -14), ch.y - 10, 20);
          rGrad.addColorStop(0, '#ffffff');
          rGrad.addColorStop(0.5, '#38bdf8');
          rGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
          ctx.fillStyle = rGrad;
          ctx.beginPath();
          ctx.arc(ch.x + (ch.dir === 'right' ? 14 : -14), ch.y - 10, 20, 0, Math.PI * 2);
          ctx.fill();
        } else if (n.includes('sasuke')) {
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(ch.x + (ch.dir === 'right' ? 12 : -12), ch.y - 10, 14, 0, Math.PI * 2);
          ctx.stroke();
        } else if (n.includes('madara')) {
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(ch.x, ch.y - 16, 26, Math.PI, Math.PI * 2);
          ctx.stroke();
        } else if (n.includes('hashirama')) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(ch.x, ch.y - 14, 24, 0, Math.PI);
          ctx.stroke();
        } else if (n.includes('pain') || n.includes('tendo')) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ch.x, ch.y - 8, 30 + Math.sin(now / 70) * 8, 0, Math.PI * 2);
          ctx.stroke();
        } else if (n.includes('gai') || n.includes('lee')) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(ch.x, ch.y - 8, 18, 0, Math.PI * 2);
          ctx.stroke();
        } else if (n.includes('minato')) {
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ch.x - 12, ch.y - 8);
          ctx.lineTo(ch.x + 12, ch.y - 8);
          ctx.stroke();
        }
      }
    }

    // 3. KHI Ở PHASE VICTORY: CỘT SÁNG VINH QUANG CHIẾU XUỐNG ĐỘI CHIẾN THẮNG
    if (war.phase === 'victory' && war.winnerTeam) {
      const winnerChars = war.winnerTeam === 'A' ? war.teamAChars : war.teamBChars;
      for (const ch of winnerChars) {
        const sGrad = ctx.createLinearGradient(ch.x, ch.y - 120, ch.x, ch.y);
        sGrad.addColorStop(0, 'rgba(253, 224, 71, 0)');
        sGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.4)');
        sGrad.addColorStop(1, 'rgba(253, 224, 71, 0.8)');
        ctx.fillStyle = sGrad;
        ctx.fillRect(ch.x - 14, ch.y - 120, 28, 120);

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(ch.x, ch.y - 2, 16, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private icon(name: IconName): Sprite | null {
    try {
      const s = this.art.iconSprite(name);
      if (s && s.canvas.width > 0) return s;
    } catch {
      // arte ainda sem este ícone
    }
    return fallbackIcon(name);
  }

  // =================================================================== luz

  /**
   * Luz: o mapa do ciclo dia/noite (exterior, interiores e halos; nada de dia), a sombra das salas
   * com a luz apagada (e a transição de acender/apagar) e os brilhos por cima.
   */
  private drawLighting(now: number, vx0: number, vy0: number, vx1: number, vy1: number): void {
    const { ctx } = this;
    const view = { x0: vx0, y0: vy0, x1: vx1, y1: vy1 };
    this.lighting.drawAmbient(ctx, this, view, now, this.dt);
    const n = this.night;
    // salas com a luz apagada (e a transição de acender/apagar)
    for (const vis of this.areas.values()) {
      const room = vis.room;
      if (!room || !vis.layout.shade) continue;
      const light = room.light(now);
      const strength = (room.phase === 'building' ? 0.5 : 0.74) + 0.1 * n;
      // durante a montagem/desmontagem, a escuridão acompanha o piso visível (o pátio não escurece)
      const cover = room.phase === 'building' || room.phase === 'dismantling' ? buildAnim(room.phase, room.progress(now)).floor : 1;
      const dark = (1 - light) * strength * cover;
      if (dark <= 0.01) continue;
      const s = vis.layout.shade;
      ctx.fillStyle = `rgba(8,12,36,${dark})`;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    this.lighting.drawGlows(ctx, this, view, now);
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch {
      // arte incompleta (stub) não pode derrubar o mundo
    }
  }


}
