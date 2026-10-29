import { hash32 } from './hash';
import type { PersonName } from './names';

/** Tên hiển thị nội bộ Habblaud. Không import từ `shared/world/`. */
export const LOCAL_DEPARTMENT_HEADS: Readonly<Record<string, PersonName>> = Object.freeze({
  claude: { name: 'Đặng Tuệ Minh', look: 'f' },
  codex: { name: 'Dương Phạm Tường Vi', look: 'f' },
  'gemini-antigravity': { name: 'Nguyễn Mai Phương', look: 'f' },
  'opencode-9router': { name: 'Trần Đức Khải', look: 'm' },
  review: { name: 'Đinh Bình Minh', look: 'm' },
  archive: { name: 'Đinh Nhật Minh', look: 'm' },
});

export const LOCAL_EMPLOYEE_NAMES: readonly PersonName[] = Object.freeze([
  { name: 'Nguyễn Lê Gia Phong', look: 'm' },
  { name: 'Nguyễn Tiến Ích Lâm', look: 'm' },
  { name: 'Hoàng Lâm', look: 'm' },
  { name: 'Đặng Lam Anh', look: 'f' },
  { name: 'Nguyễn Hoàng Bách', look: 'm' },
  { name: 'Đỗ Hải Phong', look: 'm' },
  { name: 'Trần Phúc Minh', look: 'm' },
  { name: 'Nguyễn Thế Minh', look: 'm' },
  { name: 'Nguyễn Vũ Hà Thành', look: 'm' },
  { name: 'Hồ Anh Phong', look: 'm' },
  { name: 'Vũ Đặng Minh Khôi', look: 'm' },
  { name: 'Phạm Đức Cường', look: 'm' },
  { name: 'Lê Anh Thư', look: 'f' },
  { name: 'Vũ Minh Ngọc', look: 'f' },
  { name: 'Trịnh Tường Anh', look: 'f' },
  { name: 'Trịnh Trần Chí Thành', look: 'm' },
  { name: 'Nguyễn Duy Tuấn Linh', look: 'm' },
  { name: 'Nguyễn An Nam', look: 'm' },
  { name: 'Lê Trung Đức', look: 'm' },
  { name: 'Đoàn Thanh Vân', look: 'f' },
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
