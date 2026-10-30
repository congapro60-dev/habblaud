# HANDOFF - Habblaud Đấu Trường Ninja

## Trạng thái hiện tại (Oct 30, 2026)
- **Hệ thống Đấu Trường / Võ Quán Ninja**:
  - Chuyển đổi toàn diện các phòng dự án thành Võ Đường Ngũ Đại Làng Ninja (Làng Lá, Cát, Đá, Sương, Mây, Dinh Hokage).
  - Thay thế toàn bộ bàn làm việc, máy tính thành Bãi tập ném phi tiêu Shuriken, Cọc gỗ mộc nhân thể thuật (Wing Chun/Gōken wooden dummy), Giá kiếm Katana, Bùa nổ Kibaku Fuda, Cuộn bí kíp và Rương nhẫn cụ.
  - Tư thế gõ code (`type`) được render thành kết ấn nhẫn thuật và luyện tập phi tiêu.
  - Giao diện Drawer & Terminal đổi thành Cuộn Hồ Sơ Nhẫn Giả và Bia Luyện Võ Đạo (Terminal).
  - Dàn 32+ Ninja NPC thường trực (Đội 7, Đội Gai, Tam Nin, Akatsuki, Kage, Jinchūriki) tự do đi lại tuần tra, luyện công và thách đấu giao đấu tại chỗ (`startInstantDuel`), không chiếm chỗ bàn của session thật.
  - Bộ điều phối Đại chiến 3 vs 3 (`NinjaWarDirector`) kích hoạt tự động mỗi 3 phút với 6 kịch bản kinh điển, hiệu ứng canvas độc bản manga/anime và banner tỷ số.
  - HUD điều khiển phím WASD / C (`ninja-control-hud.ts`).
  - **Hệ thống Âm thanh Nhẫn Giả Web Audio API** (`synth.ts`, `sound-cues.ts`): Synth tiếng va chạm kunai/shuriken, sấm Chidori, bão gió Rasengan, bùa bộc phá Kibaku Fuda và chuông mõ khai chiến.
  - **Thuật Triệu Hồi Linh Thú Khổng Lồ (Kuchiyose no Jutsu)** (`renderer.ts`): Gamabunta (Cóc khổng lồ ngậm tẩu), Manda (Mãng xà tím khổng lồ) & Katsuyu (Ốc sên thần) xuất hiện giữa đại chiến.
  - **Sổ Đen Ninja Bingo Book & Vinh Danh MVP** (`ninja-war-director.ts`, `ninja-war-banner.ts`): Tự động ghi chép chiến tích, tỷ số các phe và vinh danh MVP cuối trận.

## Kiểm thử & Build
- `npx tsc --noEmit`: 0 errors.
- `npm run build:client`: Vite bundle thành công `dist/client/`.
- `vitest`: 30/30 tests passed.
