# HANDOFF - Habblaud Đấu Trường Ninja

## Trạng thái hiện tại (Nov 01, 2026)
- **Đã có (kiểm chứng bằng test + ảnh chụp headless):**
  - Dàn NPC cục bộ: 33 ninja (`RESIDENT_NINJA_ROSTER`), 6 trưởng phòng ảo (Kage) và Giám đốc Vũ Việt Cường. Chỉ tồn tại ở client, không vào snapshot.
  - Giám đốc & trưởng phòng chạy `planNinjaLeaderRoutine` (đi phòng khác, tuần hành lang, tỉ thí, về bàn) qua nhánh dàn cục bộ của `runCharacter`.
  - Akatsuki & Thất Kiếm (`TROUBLEMAKER_NPC_IDS`): `runTroublemaker` tuần hành lang / xông vào võ đường, thách đấu ninja cục bộ gần nhất bằng `social.startInstantDuel`.
  - Hành lang (`building.corridor`) là "nhà" hợp lệ qua `sim.localArea(id)` — trước đây NPC `core:corredor` rơi vào Cổng Làng và kẹt ở đó.
  - Đại chiến 3 vs 3 mỗi 3 phút (`NinjaWarDirector`): mỗi cặp đánh tại một điểm riêng (`duelSpots`) rải dọc hành lang; chỉ NPC & trưởng phòng ảo lên sàn/làm khán giả.
  - Session thật (Claude/Codex/OpenCode): không bao giờ bị kéo vào trận; làm việc thì ngồi bàn, rảnh mới đi dạo (hành vi gốc). Có vệt sáng xanh dưới chân để phân biệt với NPC trùng tên.
  - Âm thanh Web Audio, Kuchiyose (Gamabunta/Manda/Katsuyu), Bingo Book, HUD WASD/C.
- **Chưa có / còn nợ (chủ dự án đã yêu cầu):**
  - Phòng dự án vẫn là bàn máy tính — chưa đổi thành bãi tập/địa danh Naruto (bản HANDOFF cũ ghi đã đổi là sai).
  - Vĩ thú, jinchūriki hoá hình, Thập Vĩ, Lục Đạo; skill riêng từng nhân vật chưa đủ đặc trưng.
  - Anbu/Root/cảnh vệ tuần tra ngoài toà nhà; bỏ xe chạy trên đường; cảnh làng ninja ở rừng/đường.
  - Quota tracker 9router trong web (cockpit hiện chỉ đọc `/v1/models`, quota luôn `unknown`).

## Bẫy đã gặp
- `client/src/ui/index.ts`: component gọi `ctx.invalidate()` ngay trong constructor → `rafId`/`hiddenTimer` phải khai báo trước khi tạo component (lỗi TDZ từng làm sập toàn bộ UI).
- `NinjaWarDirector.subscribe` gọi callback ngay lập tức.
- `startInstantDuel` phải đẩy bước `gather` để áp tư thế và nhả `ch.gathering` khi trận kết thúc.
- `git stash@{0}` "backup-phien-truoc-khi-lui" (30/10) vẫn còn, chưa ai rà nội dung.

## Kiểm thử & Build
- `npx tsc --noEmit -p tsconfig.json`: 0 lỗi.
- `npx vitest run client/src/world/sim/`: 90/90 pass (gồm `ninja-cast.test.ts`).
- Toàn bộ `vitest run`: còn các test hỏng có sẵn từ trước (art, server process/openssl, shared/demo, timeline/timelapse) — đã đối chiếu, hỏng y hệt trên code trước bản sửa.
- Chụp màn hình headless: `playwright-core` của repo + Edge, trỏ vào `http://127.0.0.1:4747` (server `npm run dev`, Vite middleware).
