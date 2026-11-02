// Bảng nhẫn thuật của từng nhân vật và nhịp đánh qua lại khi tỉ thí. Thuần dữ liệu: cùng thời điểm luôn ra cùng một chiêu,
// nên không cần lưu trạng thái trong Sim.

export type JutsuKind =
  | 'rasengan' | 'rasenshuriken' | 'shadow_clones' | 'chidori' | 'amaterasu' | 'fireball' | 'sand_coffin' | 'shadow_bind'
  | 'shinra_tensei' | 'chibaku_tensei' | 'wood_dragon' | 'water_dragon' | 'ice_mirrors' | 'clay_bomb' | 'puppet_strings'
  | 'paper_storm' | 'eight_gates' | 'chakra_punch' | 'hiraishin' | 'kamui' | 'gentle_fist' | 'wind_scythe' | 'lightning_rush'
  | 'snake_strike' | 'shuriken_storm' | 'jashin_ritual' | 'dust_release' | 'lava_release' | 'mist_slash' | 'needle_hair' | 'earth_grudge';

export interface Jutsu {
  kind: JutsuKind;
  label: string;
}

const j = (kind: JutsuKind, label: string): Jutsu => ({ kind, label });

const TABLE: readonly { pattern: string; jutsu: readonly Jutsu[] }[] = [
  { pattern: 'naruto', jutsu: [j('shadow_clones', 'Đa Trọng Ảnh Phân Thân'), j('rasengan', 'Rasengan'), j('rasenshuriken', 'Rasenshuriken')] },
  { pattern: 'sasuke', jutsu: [j('chidori', 'Chidori'), j('fireball', 'Hào Hoả Cầu'), j('amaterasu', 'Amaterasu')] },
  { pattern: 'sakura', jutsu: [j('chakra_punch', 'Quái Lực Quyền')] },
  { pattern: 'tsunade', jutsu: [j('chakra_punch', 'Thiên Luân Quyền')] },
  { pattern: 'kakashi', jutsu: [j('chidori', 'Raikiri'), j('kamui', 'Kamui')] },
  { pattern: 'gai', jutsu: [j('eight_gates', 'Bát Môn Độn Giáp')] },
  { pattern: 'lee', jutsu: [j('eight_gates', 'Liên Hoa Sanh')] },
  { pattern: 'neji', jutsu: [j('gentle_fist', 'Bát Quái 64 Chưởng')] },
  { pattern: 'hinata', jutsu: [j('gentle_fist', 'Song Sư Quyền')] },
  { pattern: 'shikamaru', jutsu: [j('shadow_bind', 'Ảnh Phược Thuật')] },
  { pattern: 'orochimaru', jutsu: [j('snake_strike', 'Tiềm Ảnh Xà Thủ')] },
  { pattern: 'hashirama', jutsu: [j('wood_dragon', 'Mộc Long Thuật')] },
  { pattern: 'tobirama', jutsu: [j('water_dragon', 'Thuỷ Long Đạn'), j('hiraishin', 'Phi Lôi Thần')] },
  { pattern: 'hiruzen', jutsu: [j('shuriken_storm', 'Thủ Lý Kiếm Ảnh Phân Thân'), j('fireball', 'Hoả Long Viêm Đạn')] },
  { pattern: 'minato', jutsu: [j('hiraishin', 'Phi Lôi Thần'), j('rasengan', 'Rasengan')] },
  { pattern: 'madara', jutsu: [j('fireball', 'Hoả Diệt Đại Thất'), j('chibaku_tensei', 'Thiên Ngại Chấn Tinh')] },
  { pattern: 'itachi', jutsu: [j('amaterasu', 'Amaterasu'), j('fireball', 'Hào Hoả Cầu')] },
  { pattern: 'shisui', jutsu: [j('hiraishin', 'Thuấn Thân'), j('fireball', 'Hào Hoả Cầu')] },
  { pattern: 'obito', jutsu: [j('kamui', 'Kamui')] },
  { pattern: 'pain', jutsu: [j('shinra_tensei', 'Thần La Thiên Chinh'), j('chibaku_tensei', 'Địa Bộc Thiên Tinh')] },
  { pattern: 'konan', jutsu: [j('paper_storm', 'Thần Chỉ Thuật')] },
  { pattern: 'kisame', jutsu: [j('water_dragon', 'Thuỷ Giao Đạn'), j('mist_slash', 'Samehada')] },
  { pattern: 'deidara', jutsu: [j('clay_bomb', 'Bộc Độn C4')] },
  { pattern: 'sasori', jutsu: [j('puppet_strings', 'Xích Bí Kỹ Bách Cơ')] },
  { pattern: 'kankuro', jutsu: [j('puppet_strings', 'Hắc Bí Kỹ Rối Sát Thủ')] },
  { pattern: 'hidan', jutsu: [j('jashin_ritual', 'Tử Tư Quỷ Huyết Tế')] },
  { pattern: 'kakuzu', jutsu: [j('earth_grudge', 'Địa Oán Ngu')] },
  { pattern: 'bee', jutsu: [j('lightning_rush', 'Lôi Hổ Bát Đao')] },
  { pattern: 'yugito', jutsu: [j('fireball', 'Quỷ Hoả Mèo Xanh')] },
  { pattern: 'zabuza', jutsu: [j('mist_slash', 'Vụ Ẩn Trảm Thủ'), j('water_dragon', 'Thuỷ Long Đạn')] },
  { pattern: 'haku', jutsu: [j('ice_mirrors', 'Ma Kính Băng Tinh')] },
  { pattern: 'temari', jutsu: [j('wind_scythe', 'Đại Liêm Đao Phong')] },
  { pattern: 'darui', jutsu: [j('lightning_rush', 'Hắc Lôi Lam Độn')] },
  { pattern: 'ay', jutsu: [j('lightning_rush', 'Lôi Trảm Liệt Xạ')] },
  { pattern: 'gaara', jutsu: [j('sand_coffin', 'Sa Phược Cữu')] },
  { pattern: 'ohnoki', jutsu: [j('dust_release', 'Trần Độn')] },
  { pattern: 'mei', jutsu: [j('lava_release', 'Dung Độn')] },
  { pattern: 'jiraiya', jutsu: [j('needle_hair', 'Châm Địa Tóc'), j('rasengan', 'Đại Rasengan')] },
];

const FALLBACK: readonly Jutsu[] = [j('shuriken_storm', 'Thủ Lý Kiếm')];

/** Khớp nguyên từ: 'ay' là Raikage Ay, không phải mọi tên có chữ "ay". */
function entryOf(name: string | undefined): (typeof TABLE)[number] | undefined {
  const lower = (name ?? '').toLowerCase();
  return TABLE.find((e) => new RegExp(`(^|[^a-z])${e.pattern}([^a-z]|$)`).test(lower));
}

export function jutsuOf(name: string | undefined): readonly Jutsu[] {
  return entryOf(name)?.jutsu ?? FALLBACK;
}

export function hasOwnJutsu(name: string | undefined): boolean {
  return !!entryOf(name);
}

export const ALL_JUTSU_KINDS: readonly JutsuKind[] = [...new Set(TABLE.flatMap((e) => e.jutsu.map((x) => x.kind)))];

/** Một chiêu kéo dài bao lâu. */
export const CAST_MS = 2_800;

export interface Cast {
  /** 0: người thứ nhất ra chiêu, 1: người thứ hai. */
  attacker: 0 | 1;
  jutsu: Jutsu;
  /** Tiến độ chiêu, 0..1. */
  p: number;
}

/** Hai bên thay phiên ra chiêu, mỗi lượt đổi sang chiêu kế tiếp của người đó. */
export function castAt(now: number, seed: number, nameA: string | undefined, nameB: string | undefined): Cast {
  const t = now + (seed % 100_000);
  const n = Math.floor(t / CAST_MS);
  const attacker = (n % 2 === 0 ? 0 : 1) as 0 | 1;
  const list = jutsuOf(attacker === 0 ? nameA : nameB);
  return { attacker, jutsu: list[Math.floor(n / 2) % list.length], p: (t % CAST_MS) / CAST_MS };
}
