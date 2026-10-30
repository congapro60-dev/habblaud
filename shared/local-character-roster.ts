import { hash32 } from './hash';
import type { PersonName } from './names';

/** Các Kage / Nhẫn giả Huyền thoại đứng đầu các Làng ninja. */
export const LOCAL_DEPARTMENT_HEADS: Readonly<Record<string, PersonName>> = Object.freeze({
  claude: { name: 'Hokage Tsunade (Tam Nin)', look: 'f' },
  codex: { name: 'Kazekage Gaara (Sa Mạc)', look: 'm' },
  'gemini-antigravity': { name: 'Tsuchikage Ohnoki (Trần Độn)', look: 'm' },
  'opencode-9router': { name: 'Mizukage Mei Terumi (Dung Độn)', look: 'f' },
  review: { name: 'Raikage Ay (Lôi Độn)', look: 'm' },
  archive: { name: 'Tiên Nhân Jiraiya (Hiền Nhân Cóc)', look: 'm' },
});

/** Danh sách các Nhẫn giả, Akatsuki, Tam Nin, Kage tiền nhiệm & nhân vật chính. */
export const LOCAL_EMPLOYEE_NAMES: readonly PersonName[] = Object.freeze([
  // Nhân vật chính & Thế hệ vàng Làng Lá
  { name: 'Uzumaki Naruto (Hiền Nhân Cửu Vĩ)', look: 'm' },
  { name: 'Uchiha Sasuke (Rinnegan / Chidori)', look: 'm' },
  { name: 'Haruno Sakura (Bách Hào Thuật)', look: 'f' },
  { name: 'Hatake Kakashi (Sharingan / Thiên Điểu)', look: 'm' },
  { name: 'Maito Gai (Bát Môn Độn Giáp)', look: 'm' },
  { name: 'Rock Lee (Liên Hoa Sanh)', look: 'm' },
  { name: 'Nara Shikamaru (Bóng Trói Chi Thuật)', look: 'm' },
  { name: 'Hyuuga Neji (Bát Quái Lục Thập Tứ Chưởng)', look: 'm' },
  { name: 'Hyuuga Hinata (Bạch Nhãn / Song Sư Quyền)', look: 'f' },
  { name: 'Uchiha Itachi (Tsukuyomi / Amaterasu)', look: 'm' },
  { name: 'Uchiha Shisui (Kotoamatsukami)', look: 'm' },
  { name: 'Uchiha Obito (Kamui Không Gian)', look: 'm' },
  { name: 'Uchiha Madara (Susanoo Hoàn Hảo)', look: 'm' },
  { name: 'Senju Hashirama (Hokage Đệ Nhất / Mộc Độn)', look: 'm' },
  { name: 'Senju Tobirama (Hokage Đệ Nhị / Phi Lôi Thần)', look: 'm' },
  { name: 'Sarutobi Hiruzen (Hokage Đệ Tam / Ngũ Hành)', look: 'm' },
  { name: 'Namikaze Minato (Tia Chớp Vàng Konoha)', look: 'm' },

  // Tam Nin Huyền Thoại & Động Triệu Hồi (Cóc, Rắn, Sên)
  { name: 'Jiraiya (Đại Tiên Nhân Núi Myoboku)', look: 'm' },
  { name: 'Orochimaru (Bạch Xà Quỷ Môn)', look: 'm' },
  { name: 'Tsunade (Bách Hào Chi Thuật)', look: 'f' },

  // Tổ chức Akatsuki (Đầy đủ 10 thành viên chính & các thế hệ)
  { name: 'Pain Tendo (Thiên Đạo / Shinra Tensei)', look: 'm' },
  { name: 'Konan (Thiên Thần Giấy / Kami no Shisha)', look: 'f' },
  { name: 'Uchiha Itachi (Tsukuyomi / Amaterasu)', look: 'm' },
  { name: 'Kisame Hoshigaki (Quái Vật Làng Sương)', look: 'm' },
  { name: 'Deidara (Bộc Độn C4 Nghệ Thuật)', look: 'm' },
  { name: 'Sasori (Xích Bí Kỹ Trăm Con Rối)', look: 'm' },
  { name: 'Hidan (Bất Tử Chú Thuật)', look: 'm' },
  { name: 'Kakuzu (Địa Oán Ngu 5 Trái Tim)', look: 'm' },
  { name: 'Zetsu Trắng Đen (Bào Tử Ký Sinh)', look: 'm' },
  { name: 'Tobi Uchiha Obito (Mặt Nạ Xoắn Ốc)', look: 'm' },
  { name: 'Orochimaru (Bạch Xà Akatsuki)', look: 'm' },
  { name: 'Juzou Biwa (Thất Kiếm / Tiền Nhiệm Itachi)', look: 'm' },

  // Lực lượng Anbu Konoha & Đội Cảnh Vệ Uchiha (Uchiha Police Force)
  { name: 'Anbu Ám Bộ Konoha (Mặt Nạ Cáo Trắng)', look: 'm' },
  { name: 'Anbu Itachi (Đội Trưởng Ám Bộ)', look: 'm' },
  { name: 'Anbu Kakashi (Huyết Nhãn Sharingan)', look: 'm' },
  { name: 'Uchiha Fugaku (Thủ Lĩnh Cảnh Vệ Konoha)', look: 'm' },
  { name: 'Uchiha Shisui (Thuấn Thân / Kotoamatsukami)', look: 'm' },
  { name: 'Cảnh Vệ Uchiha (Huy Hiệu Quạt Lửa Konoha)', look: 'm' },

  // Jinchūriki của Toàn Bộ 9 Vĩ Thú
  { name: 'Gaara (Jinchūriki Nhất Vĩ Shukaku)', look: 'm' },
  { name: 'Yugito Nii (Jinchūriki Nhị Vĩ Matatabi)', look: 'f' },
  { name: 'Yagura Karatachi (Jinchūriki Tam Vĩ Isobu)', look: 'm' },
  { name: 'Roshi (Jinchūriki Tứ Vĩ Son Goku)', look: 'm' },
  { name: 'Han (Jinchūriki Ngũ Vĩ Kokuo)', look: 'm' },
  { name: 'Utakata (Jinchūriki Lục Vĩ Saiken)', look: 'm' },
  { name: 'Fuu (Jinchūriki Thất Vĩ Chomei)', look: 'f' },
  { name: 'Killer Bee (Jinchūriki Bát Vĩ Gyūki)', look: 'm' },
  { name: 'Uzumaki Naruto (Jinchūriki Cửu Vĩ Kurama)', look: 'm' },

  // Binh Đoàn Uế Thổ Chuyển Sinh (Edo Tensei)
  { name: 'Edo Madara (Uế Thổ Susanoo Toàn Năng)', look: 'm' },
  { name: 'Edo Hashirama (Uế Thổ Mộc Độn Chân Thần)', look: 'm' },
  { name: 'Edo Tobirama (Uế Thổ Khởi Nguyên Phi Lôi)', look: 'm' },
  { name: 'Edo Hiruzen (Uế Thổ Ngũ Hành Hầu Vương)', look: 'm' },
  { name: 'Edo Minato (Uế Thổ Cửu Vĩ Kim Tiên)', look: 'm' },
  { name: 'Edo Itachi (Uế Thổ Izanami Bất Diệt)', look: 'm' },
  { name: 'Edo Nagato (Uế Thổ Lục Đạo Toàn Luân)', look: 'm' },
  { name: 'Edo Mu (Tsuchikage Đệ Nhị Vô Ảnh)', look: 'm' },
  { name: 'Edo Gengetsu (Mizukage Đệ Nhị Ảo Thuật)', look: 'm' },
  { name: 'Edo Ay Đệ Tam (Lôi Giáp Bất Hoại)', look: 'm' },
  { name: 'Edo Rasa (Kazekage Đệ Tứ Sa Kim)', look: 'm' },

  // Lục Đạo Tiên Nhân & Thần Tộc Otsutsuki
  { name: 'Hagoromo Otsutsuki (Lục Đạo Tiên Nhân)', look: 'm' },
  { name: 'Hamura Otsutsuki (Tiên Nhân Mặt Trăng)', look: 'm' },
  { name: 'Kaguya Otsutsuki (Thần Thụ Khởi Nguyên)', look: 'f' },

  // Danh nhẫn các Làng Ninja khác
  { name: 'Kankuro (Hắc Bí Kỹ Rối Sát Thủ)', look: 'm' },
  { name: 'Temari (Quạt Ba Tiêu Phong Độn)', look: 'f' },
  { name: 'Darui (Hắc Lôi / Lam Độn)', look: 'm' },
  { name: 'Zabuza Momochi (Quỷ Nhân Kiếm Chém Sương)', look: 'm' },
  { name: 'Haku (Băng Độn Ma Kính Băng Tinh)', look: 'm' },
]);

export function pickLocalCharacterName(id: string, used: ReadonlySet<string>): PersonName {
  const n = LOCAL_EMPLOYEE_NAMES.length;
  const start = hash32(id) % n;
  for (let i = 0; i < n; i++) {
    const cand = LOCAL_EMPLOYEE_NAMES[(start + i) % n];
    if (!used.has(cand.name)) return cand;
  }
  const base = LOCAL_EMPLOYEE_NAMES[start];
  for (let k = 2; ; k++) {
    const name = `${base.name} ${k}`;
    if (!used.has(name)) return { name, look: base.look };
  }
}

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
