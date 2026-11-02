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
  - Ngoài toà nhà (đợt 1/4 đồ hoạ): `WalkGrid` chỉ phủ trong nhà, nên ngoài nhà dùng bước `walk` đi thẳng theo lộ trình vòng quanh (`sim/outdoors.ts`), qua cửa tây hành lang. Đội tuần tra `OUTDOOR_PATROL_ROSTER` (Anbu, Root, cảnh vệ) không vào nhà và không lên sàn đại chiến; NPC khác ra ngoài theo `OUTING_CHANCE`. Bước `go` từ ngoài nhà tự đi bộ về cửa rồi mới tìm đường. Đã gỡ nhân vật chạy theo làn xe; cảnh làng trong `layout/exterior.ts` + `render/props.ts`.
  - Phòng session thành bãi tập (đợt 2/4 đồ hoạ), chỉ đổi hình, giữ nguyên chỗ ngồi và cơ chế làm việc: `art/training-board.ts` vẽ bia tập thay màn hình theo `deskScreen` (phi tiêu, kunai khi làm việc; cuộn bí kíp khi đọc; thanh chakra khi chờ lệnh; nháy đỏ khi cần xử lý). Sàn `tatami`, bàn và đôn gỗ, tủ và kệ cuộn. Làng ninja không tự đổi sang Giáng Sinh, Halloween theo lịch (`world/index.ts`); chọn tay trong cài đặt vẫn được.
  - Vĩ thú và hoá hình (đợt 3/4 đồ hoạ): sprite pixel 19 loại trong `art/beasts.ts` (fan art tự vẽ); `sim/beast-show.ts` xoay vòng mỗi 28 tới 45 giây để loại nào cũng được thấy, và khi vào giao tranh thì đấu thủ hoá hình; `render/beast-fx.ts` vẽ tụ chakra, cầu vĩ thú, sóng xung kích, tên chiêu. Chỉ NPC cục bộ tham gia. Đã gỡ phần linh thú vector cũ trong đại chiến.
  - Nhẫn thuật (đợt 4/4 đồ hoạ): `sim/jutsu.ts` là bảng chiêu theo tên và nhịp đánh qua lại (không lưu trạng thái); `render/jutsu-fx.ts` vẽ 31 chiêu, mỗi chiêu một dáng, chia pha tụ, bay, trúng đòn, không dùng gradient. Thay toàn bộ phần vẽ theo tên cũ trong `renderer.ts`.
  - Quota 9Router: nút trên thanh công cụ (`client/src/ui/router-quota.ts`), API `GET /api/router/quota` (`server/router-quota.ts`). Server hỏi 9Router mỗi 2 phút qua `/api/providers/client` + `/api/usage/:id`, lưu bản tốt gần nhất vào `<dataDir>/router-quota.json`; API trả bản lưu ngay và làm mới ở nền, `?force=1` mới chờ 9Router. Không lưu số mới khi 9Router chết, chỉ hiện bản cũ kèm giờ cập nhật.
- **Chưa có / còn nợ (chủ dự án đã yêu cầu):**
  - Tên chiêu của vĩ thú có thể bị bảng tên phòng che (bảng tên phòng là lớp DOM nằm trên canvas). Năm vĩ thú chưa có NPC jinchūriki nên hiện ra trong rừng thay vì hoá hình.
  - Cockpit `server/router.ts` vẫn chỉ đọc `/v1/models` (endpoint này hay treo khi 9Router quá tải) nên Dinh Hokage vẫn ghi quota `unknown`; chưa nối với dữ liệu quota mới.

## Bẫy đã gặp
- `client/src/ui/index.ts`: component gọi `ctx.invalidate()` ngay trong constructor → `rafId`/`hiddenTimer` phải khai báo trước khi tạo component (lỗi TDZ từng làm sập toàn bộ UI).
- `NinjaWarDirector.subscribe` gọi callback ngay lập tức.
- `startInstantDuel` phải đẩy bước `gather` để áp tư thế và nhả `ch.gathering` khi trận kết thúc.
- `git stash@{0}` "backup-phien-truoc-khi-lui" (30/10) vẫn còn, chưa ai rà nội dung.
- `usage.ts fit()` phải theo dõi cả các khối cạnh thẻ quota: chúng rộng ra sau khi tải trang mà cửa sổ không đổi cỡ, thẻ sẽ đè lên nút (đã sửa bằng ResizeObserver).
- Server dev bật qua khung xem trước của Claude desktop (`npm run dev`) từng treo trước `listen`, không rõ nguyên nhân; chạy `node node_modules/tsx/dist/cli.mjs watch ... --dev < /dev/null` thì lên bình thường.

## Kiểm thử & Build
- `npx tsc --noEmit -p tsconfig.json`: 0 lỗi.
- `npx vitest run client/src/world/`: pass hết (gồm `ninja-cast.test.ts`, `outdoors.test.ts`); `client/src/art/training-board.test.ts`: 4/4 pass; `client/src/art/art.test.ts` còn 5 test cũ mô tả màn hình máy tính, đỏ từ trước. `server/router-quota.test.ts`: 8/8 pass.
- Toàn bộ `vitest run`: còn các test hỏng có sẵn từ trước (art, server process/openssl, shared/demo, timeline/timelapse) — đã đối chiếu, hỏng y hệt trên code trước bản sửa.
- Tốc độ khung hình (headless không GPU, đo liên tục 80 giây): 16-27 khung/giây, ngang trước khi thêm chiêu. Đừng đo ngay sau khi sửa file: Vite biên dịch lại và app dựng sprite lần đầu làm số tụt còn 1-2 khung/giây. Lúc đầu trang, `getImageData` trong `opaqueBounds` chiếm phần lớn thời gian.
- Chụp màn hình headless: `playwright-core` của repo + Edge, trỏ vào `http://127.0.0.1:4747` (server `npm run dev`, Vite middleware).
