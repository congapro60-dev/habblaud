# Plan: Chibi Battle Royale — Thế giới Ninja (phiên bản Naruto)

Status: approved-for-build
Version: 2026-10-30 / v0.2
Source of truth: README.md (Social life, Habblaud World), AGENTS.md (cảnh báo dữ liệu thật),
CHANGELOG.md [1.3.0], `client/src/world/battle/core.ts`, `client/src/art/api.ts` (characterSprite).

## 0. Thế giới ninja (yêu cầu của giám đốc, 2026-10-30)

- Nhân vật là **nhẫn giả**; mỗi engine/provider là một **làng ninja**:
  `claude` = Làng Lá 🍃 · `codex` = Làng Cát ⏳ · `opencode` = Làng Sương 🌫️ ·
  `gemini-antigravity` = Làng Đá 🪨 · khác = Làng Cỏ 🌿.
- Nhẫn giả **giao chiến tự do** khi gặp nhau lúc rảnh (giai đoạn sau: va chạm ngay trong văn phòng
  theo khuôn hangout); hiện tại: trận đấu trong Đấu trường.
- **Kỹ năng (jutsu) chuẩn Naruto:** Phi tiêu (shuriken), Hỏa Đạn (phun lửa + cháy dai),
  Triệu Hồi (linh thú, có thể thất bại), Ảnh Phân Thân (đánh kép),
  Thân Thế Thân (né + phản đòn), Tụ Chakra (đòn kế ×2). Kỹ năng khác thêm sau.
- Nhẫn giả giữ **ngoại hình thật** của agent trong văn phòng (characterSprite theo seed/appearance),
  đội băng đô màu làng.

## 1. Objective and outcome

Khi có từ 2 agent đang **rảnh** (hoặc chờ shell quá lâu), Habblaud mở một **đấu trường chibi nội bộ**:
các nhân vật biến hình thành võ sĩ chibi, đánh loại trực tiếp bằng kiếm khí/tu tiên với hiệu ứng hoành
tráng. Người xem chỉ thấy show — agent thật không đổi trạng thái, không tốn token, không bị gửi prompt.

Kết quả đầu tiên: lõi đấu trường thuần TS chạy được (matchmaking, vòng đấu, kỹ năng, coins) + test,
chưa cần art.

## 2. Users, audience, and use cases

- Người dùng duy nhất: giám đốc sở hữu máy. Xem giải trí khi để agent chạy nền.
- Kích hoạt: từ UI "Xem đấu trường" hoặc tự chạy khi ≥2 agent rảnh ≥90s (giống ngưỡng hangout).

## 3. Scope

### In scope (v0.1)

- Lõi thuần TS, không DOM: `client/src/world/battle/core.ts` — roster, bracket loại trực tiếp, vòng
  đấu, kỹ năng (slash / palm / charge khí), sát thương theo seed, thắng/thua, phần thưởng xu cục bộ.
- Deterministic theo seed: cùng đầu vào → cùng diễn biến (test được, quay lại được).
- Text log vòng đấu qua `tr()` để sau này hiển thị (chuỗi nguồn PT theo quy ước i18n).

### Out of scope (chưa làm trong v0.1)

- **Không đụng** `shared/world/` và `server/world/` — không một byte nào của trận đấu đi lên
  Habblaud World (AGENTS.md: dữ liệu thật; trận đấu là hư cấu → phải ở lại máy).
- Art chibi (sprite, hiệu ứng kiếm khí) — lớp sau, thay asset, không đụng logic.
- Không đổi trạng thái agent, không gửi prompt, không viết file, không đụng server.
- Không cộng xu vào ví thật của social nếu chưa có đường nhận rõ ràng (tránh lẫn kinh tế).

## 4. Design

- `Fighter`: id agent, tên, ký hiệu 2 chữ (như badge trưởng phòng), family (claude/codex/…), seed.
- `Battleroyale`: N = 3..8 võ sĩ; mỗi vòng, cặp đấu rút ngẫu nhiên theo seed; ai HP ≤ 0 bị loại;
  sau `maxRounds` thì ai máu nhiều nhất thắng (chống lặp vô hạn).
- Kỹ năng: `slash` x1.0 ổn định, `palm` x0.6 nhưng 25% gây choáng (bỏ lượt sau), `charge` nhân x2
  đòn kế tiếp. Chọn kỹ năng bằng hash(seed + round) — không random toàn cục.
- Phần thưởng: thắng +🪙50, vào trận +🪙10 — ghi vào kết quả trận, việc nạp vào wallet do caller quyết.

## 5. Privacy and security

- Toàn bộ ở client, storage `null` thì chỉ trong bộ nhớ trận đó.
- Không đọc file, không gọi mạng, không log nội dung phiên; tên nhân vật dùng tên đã có trong Sim.

## 6. Acceptance criteria

1. `npm run typecheck` pass; test battle xanh.
2. Cùng seed → cùng chuỗi vòng đấu và cùng nhà vô địch (deterministic test).
3. HP không âm, không lặp vô hạn, luôn có đúng 1 nhà vô địch.
4. Không file nào ngoài `client/src/world/battle/` và `docs/spec/` thay đổi.

## 7. Work order

1. Lõi logic + test (v0.1 — bản này).
2. Scene đấu trường + art chibi (asset riêng, theme riêng).
3. Kích hoạt từ UI + auto khi ≥2 rảnh; log qua feed.
4. i18n đầy đủ 5 ngôn ngữ cho text trận đấu.

## 8. Stop points

- Dừng nếu phải đụng `shared/world/`/`server/world/` để "đưa trận lên World" — từ chối, trình bày lý do.
- Dừng nếu cần đổi trạng thái agent thật để "cho chân thực" — trận đấu phải luôn là show.
