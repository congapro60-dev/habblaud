# Bài ra mắt Habblaud v1.3.0 (bản đăng mạng xã hội)

> Copy-paste được. Kèm 1 ảnh GIF `docs/screenshots/office.gif` hoặc screenshot phòng giám đốc.

---

🎮 **Habblaud — Văn phòng pixel cho đội AI của bạn, bản tiếng Việt vừa ra bản 1.3.0** 🤖✨

Thay vì nhìn terminal khô khan, Habblaud biến các AI Coding Agent thành nhân vật trong một tòa văn
phòng pixel. Mỗi project một phòng, mỗi agent một nhân vật — và mọi thứ hiển thị **trạng thái thật**:
ai đang gõ code, ai giơ tay chờ bạn duyệt, ai đi uống cà phê vì hết việc.

🔥 **Có gì trong bản 1.3.0?**

* 🏢 **Văn phòng sống thật:** agent đang code → ngồi bàn gõ phím; chờ lệnh shell → ăn bỏng ngô xem
  tiến trình; rảnh → đi cafe, tán gẫu bếp, chơi game, oẳn tù tì cược xu với đồng nghiệp.
* 👔 **Phòng giám đốc (mới):** giao yêu cầu bằng tiếng Việt, hệ thống tự tạo **WorkOrder** — journal
  bền vững, theo dõi trạng thái, quyền đọc/ghi, kèm trưởng phòng nhận việc, điều phối, báo cáo.
* 🧭 **Cockpit 9Router (mới):** đọc catalog, health, số model qua loopback; chọn route policy và model
  ngay trong Habblaud.
* 💰 **Codex picker phân nhóm (mới):** catalog local chia rõ FREE / TRONG GÓI / TRỪ VÍ / GÓI CAO HƠN —
  hết cảnh chọn nhầm model trừ ví.
* 🤖 **Kết nối Claude Code, Codex và OpenCode/9Router** (chỉ đọc session/event — không can thiệp).
* 📊 Theo dõi phiên, token, chi phí, timeline từng agent; terminal xem hội thoại trực tiếp.
* 🌆 **Habblaud World:** thành phố pixel online, mỗi máy là một tòa nhà sáng đèn khi agent làm việc;
  đi thăm, gõ cửa, thả like.
* 🇻🇳 **Giao diện tiếng Việt đầy đủ** (kèm PT/EN/ES/FR). Chạy hoàn toàn trên máy bạn: Habblaud không
  đọc credential, không gọi ra ngoài.

⚔️ **Sắp tới:** chế độ **Battle Royale Chibi** — các agent rảnh rẽ nhau ra đấu trường, võ công kiếm
hiệp với hiệu ứng hoành tráng. Đang phát triển.

🚀 Cài thử (macOS/Linux, cần Claude Code + Node 22.12+):

```bash
git clone https://github.com/congapro60-dev/habblaud.git
cd habblaud
npm install
npm run docker:up   # hoặc npm run dev chạy trực tiếp
```

Mở **http://localhost:4747** — văn phòng của bạn sáng đèn.

📦 Changelog đầy đủ: https://github.com/congapro60-dev/habblaud/releases/tag/v1.3.0

---

## Ghi chú cho người đăng

- Ảnh minh họa: dùng `docs/screenshots/office.gif` (văn phòng động), hoặc chụp mới Phòng giám đốc +
  Cockpit 9Router qua chế độ demo (`?mock=1`) để không lộ dự án thật.
- Nếu đăng nhóm Discord/Forum tiếng Việt, bỏ phần "Sắp tới" nếu chưa muốn hẹn trước tính năng.
- Câu cuối mỗi mục đã khớp chức năng thật của v1.3.0 theo `CHANGELOG.md` — đừng thêm quyền năng
  chưa có (ví dụ: điều khiển agent từ xa qua điện thoại cần bật `remote:setup` riêng, chưa bật mặc định).
