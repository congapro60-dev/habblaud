# Codex picker đa nhà cung cấp

## Bổ sung PShareHub qua 9Router — 2026-10-26

Approved-for-build: người dùng yêu cầu nối route PShareHub và catalog Desktop, chọn model trong cuộc chat hiện tại. Chỉ thêm route `pshare/glm-5.3-flash` dùng upstream `glm-5.3-flash` giá catalog bằng 0; không gọi canonical có phí, không sửa provider/combos trả phí, không đổi default.

Plan: backup config/catalog và snapshot SQLite router; tạo node riêng `pshare` để không đụng node `psh` cũ; canary text rồi shell read-only trên dữ liệu tổng hợp; thêm một entry vào catalog đang được config sử dụng; giữ entry khi refresh catalog; kiểm parse bằng CLI bundled Desktop. Nếu tool chọn picker không hỗ trợ model ngoài, không sửa storage/thread DB hoặc giả vờ đã đổi model; bàn giao thao tác picker cho người dùng.

Checks: backup PASS (`*.bak-20261026-203406-pshare-router`, SQLite `before-pshare-picker-1793021646967.sqlite`); route/account/giá PASS theo catalog upstream; text PASS `GLM-OK` exit 0; tools PASS đọc `PSHARE_ROUTER_FIXTURE_4397_GREEN`, liệt kê `fixture.txt`/`catalog.json`, command exit 0; catalog PASS 102 entry, 101 entry trước giữ nguyên; retention self-test PASS; Desktop bundled CLI parse PASS, visibility=list, priority=140. GUI/current thread chưa đổi: computer-use cấm thao tác UI ChatGPT/Codex; người dùng cần chọn picker sau khi app nạp lại catalog.

Route: prefix `pshare`, node `openai-compatible-chat-55dd944a-999f-4cb3-9586-6a2e848ca522`, connection `861cf02c-7e5d-4fdb-9a0c-b4ccfcbcddb6`, endpoint `https://api.psharehub.com/v1`, transport chat-completions upstream qua Responses của ninerouter. Log router tương quan canary xác nhận alias `glm-5.3-flash` và connection này. Không gọi canonical có phí; không thêm combo. Giá 0 là catalog của alias, không bảo đảm quota vô hạn hoặc hard cap.

Review: một lõi route; prefix không tự chọn provider; Codex vẫn dùng ninerouter nên slug phải thực sự tồn tại trên router. User đã cho phép dùng key trong file cho PShareHub và router local. Tối đa một canary text + một tool; lỗi tạm thời thử lại tối đa một lần. Chi phí upstream/served-model độc lập còn unknown.

Status: approved-for-build — 2026-10-26.
Authority: người dùng yêu cầu đưa cả free, xKiro đã mua và Vilao vào picker; triển khai tiếp trong lượt này. Không đổi default GPT-6.1 Sol, không commit/push, không xóa Desk/WIP.

## Phạm vi và thứ tự

1. Đối chiếu catalog sống, usage xKiro, cấu hình OpenCode và bản xuất người dùng cung cấp. Không xuất credential/base64.
2. Thêm Vilao của người dùng vào 9Router bằng API local, tái sử dụng credential đang có trong OpenCode. Không dùng key chia sẻ hết hạn.
3. Sinh catalog Codex, tên có nhóm chi phí + nhà cung cấp; giữ slug inference thật. Không sửa ứng dụng Codex hoặc tạo nhóm giả không được API hỗ trợ.
4. Self-test offline, parse catalog bằng CLI bundled Desktop, canary shell chỉ đọc trên fixture tổng hợp. Model chưa thử ghi rõ chưa xác minh; vision mặc định tắt.
5. Review khác họ model nếu có route hoạt động; báo riêng kiểm CLI và kiểm GUI. Không tự restart Codex làm mất phiên đang chạy.

## Quy tắc

- xKiro: `access_tier=free` và giá input/output bằng 0 mới nhãn FREE. Gói Pro và ví là hai nguồn phí khác nhau; tier paid/premium không tự chứng minh gói bao model PAYG. Chưa xác minh model nào bắt buộc ví: nhãn GÓI/VÍ, không cam kết luôn trong gói.
- Vilao: catalog tài khoản có giá theo token và tối thiểu 3 VND/request: nhãn TRỪ VÍ, không gọi miễn phí vì đã nạp tiền.
- Catalog là khám phá model, không phải bảo đảm quota, served identity, tools, vision, quyền truy cập. Không tự động fallback trả phí, không thêm auto-all hoặc route OAuth mới.
- Không copy key vào repo/catalog/log. Chỉ gửi credential đến upstream đã cấu hình hoặc API 9Router loopback được yêu cầu.
- Trần context lấy theo route và tối đa 256K cho model ngoài; không gán 1.05M toàn cục. Ảnh chỉ bật khi probe đúng route.
- Dừng: auth/permission thất bại, route không đúng, billing không xác định; không dò key hoặc sweep toàn bộ inference.

## Checks

| Check | Trạng thái | Bằng chứng |
|---|---|---|
| Catalog/usage sống xKiro | pass | 97 model; Pro, 8M free/ngày, 35 USD/7 ngày; ví 0 USD tại thời điểm kiểm |
| Catalog Vilao của người dùng | pass | 2 model active: deepseek-v4.1-flash, gemini-3.8-flash; giá token và min 3 VND/request |
| Qwen free Codex shell | pass | xk/qwen/qwen3.8-max:free: command_execution exit 0, PICKER_TOOL_OK |
| Vilao qua 9Router | pass | Thêm node vilao60 bằng API local; credential đối chiếu trùng OpenCode, không in giá trị |
| Nhóm giá, không lộ key | pass | --self-test: classification, JSONC, context, capability isolation, credential-free catalog; node --check, git diff --check |
| Catalog parse Desktop bundled | pass | 0.164.0-alpha.11.1 debug models exit 0, 101 entry: 10 native + 91 external |
| Một route trong gói, một route Vilao gọi tool | pass | xk/anthropic/claude-sonnet-5.5 và vilao60/deepseek-v4.1-flash: command_execution exit 0, PICKER_XKIRO_PLAN_OK / PICKER_VILAO_OK |
| Review khác hãng | degraded | Qwen3.8 Max trả review; shell trong CODEX_HOME sạch bị policy chặn. Các cáo buộc JSONC sai được bác bằng self-test; giữ fail-safe khi thiếu giá/PAYG. Sonnet review bổ sung timeout 65s, không tuyên bố review pass |
| GUI picker sau nạp lại | unresolved | Chưa restart app |

## Review kế hoạch

Single-model review: không fork app, không thêm dependency, không biến provider catalog thành chứng minh entitlement. Điểm thách thức: bỏ Plus chỉ khả thi cho inference route không dùng account ChatGPT; cloud/plugin có quyền riêng, không thể cam kết mọi tính năng còn nguyên.

## Kết quả và giới hạn

- 43 FREE, 43 TRONG GÓI*, 3 TRỪ VÍ (2 Vilao + Grok 4.5), 2 GÓI CAO HƠN (Astra/Fable 5.1). Model chưa canary giữ nhãn thử nghiệm. Không sweep 91 inference.
- Catalog xKiro và trang giá xác định PAYG riêng; không suy nhãn :free hoặc tier paid thành chế độ billing. Model thiếu row giá giữ GÓI/VÍ.
- Đã bỏ override model_context_window=1050000 toàn cục để model ngoài dùng giới hạn riêng tối đa 256K. Default gpt-6.1-sol giữ nguyên. Backup config.toml.backup-multi-provider-20261026.
- Có thay đổi cấu hình đồng thời sang qa-v32-validated-models.json; kiểm tra đủ 91 entry, giữ pointer mới. Generator đọc path hiện hành, không đổi pointer hoặc ghi đè config người dùng.
- CODEX_HOME sạch không có auth ChatGPT vẫn hoàn tất inference và review Qwen qua 9Router. Shell thử nghiệm bị sandbox policy chặn; không nới policy để ép pass. Plugin featured endpoint trả 401: quyền plugin tách khỏi inference.
- Account upstream đối chiếu key local trùng OpenCode cho xKiro và Vilao. `served_model` độc lập vẫn unknown; không xác minh tên model qua tự khai.
