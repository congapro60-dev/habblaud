// Avatares dos agentes para a UI: gerados pelo módulo de arte uma única vez e reaproveitados como data URL.
import { partsKey } from '../../../shared/appearance';
import type { AgentInfo } from '../../../shared/types';
import { avatarCanvas } from '../art';
import { h } from './dom';

const cache = new Map<string, { url: string; w: number; h: number }>();

export type AvatarSource = Pick<AgentInfo, 'seed' | 'look' | 'kind' | 'parts'> & { name?: string };

/** Bản đồ nhận diện ảnh anime/manga chính thức của các Kage & Nhân vật Naruto */
export function resolveNinjaAvatarUrl(name?: string): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('tsunade')) return '/assets/ninja/avatars/tsunade.png';
  if (n.includes('gaara')) return '/assets/ninja/avatars/gaara.png';
  if (n.includes('ohnoki') || n.includes('onoki')) return '/assets/ninja/avatars/ohnoki.png';
  if (n.includes('mei')) return '/assets/ninja/avatars/mei.png';
  if (n.includes('raikage') || n.includes('ay')) return '/assets/ninja/avatars/ay.png';
  if (n.includes('jiraiya')) return '/assets/ninja/avatars/jiraiya.png';
  if (n.includes('pain') || n.includes('tendo')) return '/assets/ninja/avatars/pain.png';
  if (n.includes('naruto')) return '/assets/ninja/avatars/naruto.png';
  if (n.includes('sasuke')) return '/assets/ninja/avatars/sasuke.png';
  if (n.includes('kakashi')) return '/assets/ninja/avatars/kakashi.png';
  if (n.includes('shikamaru')) return '/assets/ninja/avatars/shikamaru.png';
  if (n.includes('neji')) return '/assets/ninja/avatars/neji.png';
  if (n.includes('hinata')) return '/assets/ninja/avatars/hinata.png';
  if (n.includes('itachi')) return '/assets/ninja/avatars/itachi.png';
  if (n.includes('obito')) return '/assets/ninja/avatars/obito.png';
  if (n.includes('madara')) return '/assets/ninja/avatars/madara.png';
  if (n.includes('hashirama')) return '/assets/ninja/avatars/hashirama.png';
  if (n.includes('tobirama')) return '/assets/ninja/avatars/tobirama.png';
  if (n.includes('hiruzen')) return '/assets/ninja/avatars/hiruzen.png';
  if (n.includes('minato')) return '/assets/ninja/avatars/minato.png';
  if (n.includes('orochimaru')) return '/assets/ninja/avatars/orochimaru.png';
  if (n.includes('konan')) return '/assets/ninja/avatars/konan.png';
  if (n.includes('kisame')) return '/assets/ninja/avatars/kisame.png';
  if (n.includes('deidara')) return '/assets/ninja/avatars/deidara.png';
  if (n.includes('sasori')) return '/assets/ninja/avatars/sasori.png';
  if (n.includes('lee')) return '/assets/ninja/avatars/lee.png';
  if (n.includes('sakura')) return '/assets/ninja/avatars/sakura.png';
  if (n.includes('zabuza')) return '/assets/ninja/avatars/zabuza.png';
  if (n.includes('haku')) return '/assets/ninja/avatars/haku.png';
  if (n.includes('gai')) return '/assets/ninja/avatars/gai.png';
  if (n.includes('bee')) return '/assets/ninja/avatars/killerbee.png';
  return null;
}

function avatarData(agent: AvatarSource, scale: number): { url: string; w: number; h: number } {
  const key = `${agent.seed}|${agent.look}|${agent.kind}|${scale}|${partsKey(agent.parts)}`;
  let entry = cache.get(key);
  if (!entry) {
    const c = avatarCanvas(agent.seed, { look: agent.look, sub: agent.kind === 'sub', scale, parts: agent.parts });
    entry = { url: c.toDataURL('image/png'), w: c.width, h: c.height };
    cache.set(key, entry);
  }
  return entry;
}

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

/** Escala inteira do módulo de arte para cada tamanho (pixels sempre nítidos). */
const SCALE: Record<AvatarSize, number> = { xs: 1, sm: 2, md: 2, lg: 4 };

/** Kích thước pixel cho khung avatar */
const PX_SIZE: Record<AvatarSize, number> = { xs: 20, sm: 30, md: 36, lg: 76 };

/** Moldura do avatar (caixa com fundo) + imagem em tamanho natural, alinhada pelos ombros. */
export function createAvatar(agent: AvatarSource, size: AvatarSize): HTMLElement {
  const box = createAvatarPlaceholder(size);
  updateAvatar(box, agent, size);
  return box;
}

/** Moldura vazia (agente desconhecido); `updateAvatar` preenche depois. */
export function createAvatarPlaceholder(size: AvatarSize): HTMLElement {
  return h('span', { class: `ui-avatar ui-avatar--${size}`, attrs: { 'aria-hidden': 'true' } });
}

/** Atualiza o avatar só se a aparência (semente, look, peças) mudou. */
export function updateAvatar(box: HTMLElement, agent: AvatarSource, size: AvatarSize): void {
  const ninjaUrl = resolveNinjaAvatarUrl(agent.name);
  const sig = `${agent.name ?? ''}|${agent.seed}|${agent.look}|${agent.kind}|${partsKey(agent.parts)}`;
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  let img = box.querySelector('img');
  if (!img) {
    img = h('img', { attrs: { alt: '', draggable: 'false', decoding: 'async' } });
    box.append(img);
  }

  if (ninjaUrl) {
    box.classList.add('ui-avatar--official-ninja');
    img.src = ninjaUrl;
    img.width = PX_SIZE[size];
    img.height = PX_SIZE[size];
    return;
  }

  box.classList.remove('ui-avatar--official-ninja');
  try {
    const data = avatarData(agent, SCALE[size]);
    img.width = data.w;
    img.height = data.h;
    img.src = data.url;
  } catch (err) {
    // A arte ainda pode estar em construção; a moldura vazia continua legível.
    console.warn('[ui] falha ao gerar avatar', err);
  }
}
