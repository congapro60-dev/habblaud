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

  // Tổ chức Akatsuki
  { name: 'Pain Tendo (Thiên Đạo / Shinra Tensei)', look: 'm' },
  { name: 'Konan (Thiên Thần Giấy / Kami no Shisha)', look: 'f' },
  { name: 'Kisame Hoshigaki (Quái Vật Làng Sương)', look: 'm' },
  { name: 'Deidara (Bộc Độn C4 Nghệ Thuật)', look: 'm' },
  { name: 'Sasori (Xích Bí Kỹ Trăm Con Rối)', look: 'm' },
  { name: 'Hidan (Bất Tử Chú Thuật)', look: 'm' },
  { name: 'Kakuzu (Địa Oán Ngu 5 Trái Tim)', look: 'm' },
  { name: 'Zetsu Trắng Đen (Bào Tử Ký Sinh)', look: 'm' },

  // Lục Đạo Tiên Nhân & Thần Tộc Otsutsuki
  { name: 'Hagoromo Otsutsuki (Lục Đạo Tiên Nhân)', look: 'm' },
  { name: 'Hamura Otsutsuki (Tiên Nhân Mặt Trăng)', look: 'm' },
  { name: 'Kaguya Otsutsuki (Thần Thụ Khởi Nguyên)', look: 'f' },

  // Jinchūriki & Vĩ Thú Hộ Vệ
  { name: 'Killer Bee (Bát Vĩ Gyūki / Thất Kiếm)', look: 'm' },
  { name: 'Yugito Nii (Nhị Vĩ Matatabi)', look: 'f' },
  { name: 'Yagura Karatachi (Mizukage Đệ Tứ / Tam Vĩ)', look: 'm' },
  { name: 'Roshi (Tứ Vĩ Son Goku / Nham Độn)', look: 'm' },
  { name: 'Han (Ngũ Vĩ Kokuo / Phản Lực Độn)', look: 'm' },
  { name: 'Utakata (Lục Vĩ Saiken / Bong Bóng Độn)', look: 'm' },
  { name: 'Fuu (Thất Vĩ Chomei / Lân Bột)', look: 'f' },

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
