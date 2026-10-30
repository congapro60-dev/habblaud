// Temas de sala (puros): paletas claras e bem distintas. Sementes consecutivas (slots vizinhos)
// recebem temas diferentes; a ordem da lista alterna famílias de cor de propósito.
import type { RoomTheme } from './api';

const THEMES: readonly RoomTheme[] = [
  // Làng Lá (Konoha - Gỗ cổ, xanh lá mộc)
  { carpet: '#607d56', carpet2: '#4e6945', wall: { base: '#d7c4b0', trim: '#7d5236', pattern: 'wood_panel' }, accent: '#2e7d32', deskVariant: 'wood', chairVariant: 'green' },
  // Làng Cát (Sunagakure - Sa mạc vàng cát)
  { carpet: '#c7a36c', carpet2: '#b89258', wall: { base: '#e2d3b8', trim: '#a1784c', pattern: 'brick' }, accent: '#b45309', deskVariant: 'dark', chairVariant: 'gray' },
  // Làng Mây (Kumogakure - Sấm sét & mây lam)
  { carpet: '#5b7692', carpet2: '#4a627a', wall: { base: '#cfdae6', trim: '#6a849f', pattern: 'wood_panel' }, accent: '#0284c7', deskVariant: 'wood', chairVariant: 'blue' },
  // Akatsuki (Mây đỏ, áo choàng đen bí thuật)
  { carpet: '#542629', carpet2: '#3d1c1e', wall: { base: '#3b3a42', trim: '#8c2424', pattern: 'brick' }, accent: '#dc2626', deskVariant: 'dark', chairVariant: 'black' },
  // Làng Sương Mù (Kirigakure - Sương nước u tịch)
  { carpet: '#4e6d72', carpet2: '#3d565b', wall: { base: '#cce2e6', trim: '#557e85', pattern: 'wood_panel' }, accent: '#0f766e', deskVariant: 'wood', chairVariant: 'gray' },
  // Dinh Hokage (Hỏa Độn & Mộc diệp hoàng kim)
  { carpet: '#854228', carpet2: '#6d351f', wall: { base: '#f0dfc8', trim: '#9e4624', pattern: 'wood_panel' }, accent: '#c2410c', deskVariant: 'wood', chairVariant: 'red' },
  // Làng Đá (Iwagakure - Đá kiên cố)
  { carpet: '#716e68', carpet2: '#5b5852', wall: { base: '#d6d1c9', trim: '#635e56', pattern: 'brick' }, accent: '#4b5563', deskVariant: 'dark', chairVariant: 'black' },
  // Thư viện Cấm Thuật (Giấy cổ bí truyền)
  { carpet: '#8a6e4d', carpet2: '#735939', wall: { base: '#e8dcce', trim: '#7a5a3a', pattern: 'wood_panel' }, accent: '#d97706', deskVariant: 'wood', chairVariant: 'gray' },
  // Lôi Đài Thi Đấu Nhẫn Thuật
  { carpet: '#5c483a', carpet2: '#473629', wall: { base: '#d8ccb8', trim: '#614d3b', pattern: 'brick' }, accent: '#7c2d12', deskVariant: 'wood', chairVariant: 'black' },
  // Tiên Nhân Động (Myobokuzan - Cóc Tiên Phong)
  { carpet: '#436850', carpet2: '#32503d', wall: { base: '#dfebd9', trim: '#4f755b', pattern: 'wood_panel' }, accent: '#15803d', deskVariant: 'wood', chairVariant: 'green' },
];

export const THEME_COUNT = THEMES.length;

export function roomTheme(seed: number): RoomTheme {
  const n = THEMES.length;
  const t = THEMES[((Math.floor(seed) % n) + n) % n];
  return { ...t, wall: { ...t.wall } };
}
