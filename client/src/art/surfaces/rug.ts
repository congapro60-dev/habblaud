// Thảm trải sàn võ quán & đấu trường nhẫn giả: Mang biểu tượng chính thức của 5 Làng Ninja
// và các đại gia tộc (Konoha 🍃, Suna ⏳, Kiri 🌫️, Kumo ⚡, Iwa 🪨, Akatsuki, Uchiha, Uzumaki).
import { ramp, shade } from '../core/color';
import { PixelBuf } from '../core/pixbuf';

export function renderRug(w: number, h: number, color: string, seed: number): PixelBuf {
  const b = new PixelBuf(w, h);
  const m = ramp(color, 0.06);
  const fringe = '#efe6d2';

  // Franjas nas laterais curtas
  const x0 = 1;
  const x1 = w - 2;
  for (let y = 2; y < h - 2; y += 2) {
    b.set(0, y, fringe);
    b.set(w - 1, y, fringe);
  }

  // Viền ngoài chiếu Tatami / Thảm võ đường
  b.rect(x0, 0, x1 - x0 + 1, h, m.dk);
  b.rect(x0 + 1, 1, x1 - x0 - 1, h - 2, m.base);

  // Filete claro interno
  b.rect(x0 + 2, 2, x1 - x0 - 3, 1, m.hi);
  b.rect(x0 + 2, h - 3, x1 - x0 - 3, 1, m.hi);
  b.rect(x0 + 2, 2, 1, h - 4, m.hi);
  b.rect(x1 - 2, 2, 1, h - 4, m.hi);

  // Nền đan cói chiếu Tatami võ quán
  const fx = x0 + 3;
  const fy = 3;
  const fw = x1 - x0 - 5;
  const fh = h - 6;

  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      // Họa tiết dệt chiếu Tatami ninja đan so le
      const weave = (Math.floor(x / 4) + Math.floor(y / 2)) % 2 === 0;
      b.set(fx + x, fy + y, weave ? m.lt : m.base);
    }
  }

  // NẾU LÀ THẢM LỚN TRONG PHÒNG (w >= 36 && h >= 28): VẼ BIỂU TƯỢNG CHÍNH THỨC CỦA CÁC LÀNG NINJA
  if (w >= 36 && h >= 28) {
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const rad = Math.min(Math.floor(w / 2) - 7, Math.floor(h / 2) - 5, 24);
    const kind = Math.abs(seed) % 10;

    // Vành đai tròn huy hiệu bảo hộ kim loại / mộc khắc
    const borderCol = '#cbd5e1';
    const darkBorder = '#334155';
    const goldHi = '#fde047';
    const redAccent = '#dc2626';

    // 1. Nền huy hiệu tròn ở tâm
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 <= rad * rad) {
          if (d2 >= (rad - 2) * (rad - 2)) {
            b.set(cx + dx, cy + dy, borderCol);
          } else if (d2 >= (rad - 3) * (rad - 3)) {
            b.set(cx + dx, cy + dy, darkBorder);
          } else {
            // Nền đệm bên trong huy hiệu
            b.set(cx + dx, cy + dy, shade(m.dk, -0.2));
          }
        }
      }
    }

    // 2. VẼ CHI TIẾT BIỂU TƯỢNG THEO TỪNG LÀNG / PHE PHÁI
    switch (kind) {
      case 0: {
        // --- LÀNG LÁ (KONOHAGAKURE 🍃) ---
        // Biểu tượng lá xoắn ốc Mộc Diệp chính thức của Konoha: giọt lá nghiêng + xoắn ốc trung tâm + mũi nhọn góc trên phải + cuống góc dưới trái
        const leafColor = '#22c55e';
        const leafHi = '#f0fdf4';
        const leafDk = '#14532d';

        // Viền thân lá (hình giọt lá Mộc Diệp)
        for (let a = 0; a < Math.PI * 2; a += 0.08) {
          const r = (rad - 7) * (0.85 + 0.25 * Math.sin(a - 0.7));
          const px = Math.round(cx + Math.cos(a) * r);
          const py = Math.round(cy + Math.sin(a) * (r * 0.9));
          b.rect(px - 1, py - 1, 3, 3, leafDk);
          b.set(px, py, leafColor);
        }

        // Mũi nhọn lá vươn lên góc trên bên phải (đặc trưng Mộc Diệp Konoha)
        for (let i = 0; i < 11; i++) {
          const tipX = cx + 6 + i;
          const tipY = cy - 6 - Math.floor(i * 0.75);
          b.rect(tipX - 1, tipY - 1, 3, 3, leafDk);
          b.set(tipX, tipY, leafHi);
        }

        // Cuống lá nhô ra ở góc dưới bên trái
        for (let j = 0; j < 6; j++) {
          const stemX = cx - 7 - j;
          const stemY = cy + 6 + Math.floor(j * 0.6);
          b.rect(stemX, stemY, 2, 2, leafDk);
          b.set(stemX, stemY, leafColor);
        }

        // Xoắn ốc trôn ốc Mộc Diệp sắc nét bên trong từ tâm
        for (let a = 0; a < Math.PI * 3.8; a += 0.12) {
          const r = 2.2 + a * 2.5;
          if (r > rad - 8) break;
          const px = Math.round(cx + Math.cos(a) * r);
          const py = Math.round(cy + Math.sin(a) * (r * 0.85));
          b.rect(px - 1, py - 1, 2, 2, leafColor);
          b.set(px, py, leafHi);
        }
        break;
      }

      case 1: {
        // --- LÀNG CÁT (SUNAGAKURE ⏳) ---
        // Biểu tượng chính thức của Làng Cát: Bầu tròn trên + Tam giác nhọn dưới + Rãnh dọc chia đôi xuyên tâm
        const sunaGold = '#f59e0b';
        const sunaHi = '#fef08a';
        const sunaDk = '#1c1917';

        // 1. Khối tròn trên (bầu trên của ấn chú Làng Cát)
        const topCY = cy - 6;
        const topR = 7;
        for (let dy = -topR; dy <= topR; dy++) {
          const span = Math.round(Math.sqrt(Math.max(0, topR * topR - dy * dy)));
          b.hline(cx - span, cx + span, topCY + dy, sunaGold);
          b.set(cx - span, topCY + dy, sunaDk);
          b.set(cx + span, topCY + dy, sunaDk);
        }

        // 2. Tam giác nhọn dưới (chĩa xuống đáy)
        for (let dy = 0; dy <= 13; dy++) {
          const span = Math.round(7 * (1 - dy / 13));
          b.hline(cx - span, cx + span, cy + dy, sunaGold);
          b.set(cx - span, cy + dy, sunaDk);
          b.set(cx + span, cy + dy, sunaDk);
        }

        // 3. Rãnh xẻ dọc thẳng đứng xuyên tâm (đặc trưng nhận diện tuyệt đối của Làng Cát)
        b.vline(cx - 1, topCY - topR, cy + 12, sunaDk);
        b.vline(cx, topCY - topR, cy + 12, sunaDk);
        b.vline(cx + 1, topCY - topR + 2, cy + 10, sunaHi);
        break;
      }

      case 2: {
        // --- LÀNG MÂY (KUMOGAKURE ⚡) ---
        // Biểu tượng chính thức của Làng Mây: 2 khối mây tròn lồng nhau, xoáy mây bên trong, đuôi mây nhọn vươn sang phải
        const kumoBlue = '#38bdf8';
        const kumoHi = '#f0f9ff';
        const kumoDk = '#0369a1';

        // Khối mây lớn bên trái
        for (let dy = -8; dy <= 8; dy++) {
          for (let dx = -13; dx <= 5; dx++) {
            if ((dx + 4) * (dx + 4) + dy * dy <= 64) {
              b.set(cx + dx, cy + dy, kumoBlue);
            }
          }
        }
        // Khối mây nhỏ nhô lên phía trên bên phải
        for (let dy = -6; dy <= 6; dy++) {
          for (let dx = -2; dx <= 10; dx++) {
            if ((dx - 4) * (dx - 4) + (dy + 2) * (dy + 2) <= 36) {
              b.set(cx + dx, cy + dy, kumoBlue);
            }
          }
        }
        // Đuôi mây nhọn vát ngang sang phải
        for (let i = 0; i < 12; i++) {
          const tw = Math.max(1, 4 - Math.floor(i * 0.35));
          for (let w = 0; w < tw; w++) {
            b.set(cx + 6 + i, cy + 2 + w, kumoBlue);
          }
          b.set(cx + 6 + i, cy + 2, kumoHi);
        }
        // Xoáy cuộn mây đặc trưng bên trong
        for (let a = 0; a < Math.PI * 2.8; a += 0.2) {
          const r = 1.5 + a * 1.6;
          const sx = Math.round(cx - 4 + Math.cos(a) * r);
          const sy = Math.round(cy + Math.sin(a) * (r * 0.85));
          b.set(sx, sy, kumoDk);
        }
        break;
      }

      case 3: {
        // --- TỔ CHỨC AKATSUKI (☁️ ĐÁM MÂY ĐỎ VIỀN TRẮNG) ---
        // Biểu tượng đám mây đỏ viền trắng Akatsuki chính thức nguyên tác manga
        // 1. Lớp viền trắng bên ngoài đám mây
        for (let dy = -12; dy <= 12; dy++) {
          for (let dx = -17; dx <= 17; dx++) {
            const inMainW = (dx * dx) / 180 + (dy * dy) / 68 <= 1;
            const inLobe1W = ((dx + 7) * (dx + 7)) / 55 + ((dy + 5) * (dy + 5)) / 40 <= 1;
            const inLobe2W = ((dx - 4) * (dx - 4)) / 70 + ((dy + 4) * (dy + 4)) / 50 <= 1;
            if (inMainW || inLobe1W || inLobe2W) {
              b.set(cx + dx, cy + dy, '#ffffff');
            }
          }
        }
        // Xoáy đuôi mây nhô ra phía dưới bên trái
        for (let j = 0; j < 9; j++) {
          b.rect(cx - 14 - j, cy + 3 - Math.floor(j * 0.5), 4, 4, '#ffffff');
        }

        // 2. Ruột đám mây màu đỏ thắm Akatsuki bên trong
        for (let dy = -10; dy <= 10; dy++) {
          for (let dx = -15; dx <= 15; dx++) {
            const inMainR = (dx * dx) / 130 + (dy * dy) / 42 <= 1;
            const inLobe1R = ((dx + 7) * (dx + 7)) / 35 + ((dy + 5) * (dy + 5)) / 24 <= 1;
            const inLobe2R = ((dx - 4) * (dx - 4)) / 48 + ((dy + 4) * (dy + 4)) / 32 <= 1;
            if (inMainR || inLobe1R || inLobe2R) {
              b.set(cx + dx, cy + dy, redAccent);
            }
          }
        }
        for (let j = 0; j < 7; j++) {
          b.rect(cx - 13 - j, cy + 4 - Math.floor(j * 0.5), 2, 2, redAccent);
        }
        break;
      }

      case 4: {
        // --- LÀNG SƯƠNG MÙ (KIRIGAKURE 🌫️) ---
        // Biểu tượng 4 dải sóng nước nghiêng song song // // // //
        const waveCol = '#06b6d4';
        const waveHi = '#e0f2fe';
        const waveDk = '#0e7490';
        for (let line = 0; line < 4; line++) {
          const startX = cx - 12 + line * 8;
          for (let s = -11; s <= 11; s++) {
            const waveX = startX + Math.round(Math.sin(s * 0.45) * 3 + s * 0.28);
            const waveY = cy + s;
            b.rect(waveX - 1, waveY, 3, 2, waveDk);
            b.rect(waveX, waveY, 2, 2, waveCol);
            b.set(waveX, waveY, waveHi);
          }
        }
        break;
      }

      case 5: {
        // --- GIA TỘC UCHIHA (🔥 QUẠT UCHIWA CHÍNH GỐC) ---
        // Chiếc quạt tròn uchiwa: NỬA TRÊN ĐỎ, NỬA DƯỚI TRẮNG, CÁN QUẠT TRẮNG THÒ XUỐNG DƯỚI
        const uRad = rad - 6;
        const fanBorder = '#0f172a';
        for (let dy = -uRad; dy <= uRad; dy++) {
          for (let dx = -uRad; dx <= uRad; dx++) {
            const distSq = dx * dx + dy * dy;
            if (distSq <= uRad * uRad) {
              if (distSq >= (uRad - 1) * (uRad - 1)) {
                b.set(cx + dx, cy + dy, fanBorder);
              } else {
                b.set(cx + dx, cy + dy, dy < 0 ? redAccent : '#ffffff');
              }
            }
          }
        }
        // Đường phân cách đỏ - trắng sắc nét ngang tâm quạt
        b.hline(cx - uRad + 1, cx + uRad - 1, cy, fanBorder);
        // Cán/chuôi quạt màu trắng kéo dài xuống dưới có viền đen
        b.rect(cx - 2, cy + uRad - 1, 5, 8, fanBorder);
        b.rect(cx - 1, cy + uRad, 3, 7, '#ffffff');
        break;
      }

      case 6: {
        // --- LÀNG ĐÁ (IWAGAKURE 🪨) ---
        // Biểu tượng chính thức của Làng Đá: 2 khối đá tảng góc cạnh lồng vào nhau (khối lớn sau, khối nhỏ trước)
        const rockCol = '#94a3b8';
        const rockHi = '#f1f5f9';
        const rockDk = '#334155';
        // 1. Tảng đá lớn phía sau (đỉnh vát nhọn)
        for (let dy = -13; dy <= 9; dy++) {
          const topSpan = dy < 0 ? Math.round(13 * (1 + dy / 14)) : 13;
          b.hline(cx - topSpan + 2, cx + topSpan + 2, cy + dy, rockCol);
          b.set(cx - topSpan + 2, cy + dy, rockHi);
          b.set(cx + topSpan + 2, cy + dy, rockDk);
        }
        // 2. Tảng đá nhỏ phía trước bên trái (chồng lên góc dưới)
        for (let dy = -4; dy <= 9; dy++) {
          const smallSpan = dy < 0 ? Math.round(7 * (1 + dy / 5)) : 7;
          b.hline(cx - 6 - smallSpan, cx - 6 + smallSpan, cy + dy, rockHi);
          b.set(cx - 6 - smallSpan, cy + dy, '#ffffff');
          b.set(cx - 6 + smallSpan, cy + dy, rockDk);
        }
        break;
      }

      case 7: {
        // --- TỘC UZUMAKI (🌀 PHONG ẤN XOÁY NƯỚC UZUSHIO) ---
        // Vòng xoắn ốc phong ấn Uzumaki đỏ thắm dày dặn với các mấu xoáy whirlpool nhô ra ở viền ngoài
        for (let a = 0; a < Math.PI * 4.2; a += 0.1) {
          const r = 2.2 + a * 2.7;
          if (r > rad - 5) break;
          const px = Math.round(cx + Math.cos(a) * r);
          const py = Math.round(cy + Math.sin(a) * (r * 0.9));
          b.rect(px - 1, py - 1, 3, 3, redAccent);
          b.set(px, py, '#fecaca');
        }
        // Các mấu nhọn xoáy nước nhô ra ngoài viền tròn
        for (let sp = 0; sp < 3; sp++) {
          const sAng = (sp * Math.PI * 2) / 3 + 0.5;
          for (let k = 0; k < 5; k++) {
            const sx = Math.round(cx + Math.cos(sAng + k * 0.1) * (rad - 6 + k));
            const sy = Math.round(cy + Math.sin(sAng + k * 0.1) * (rad - 6 + k));
            b.rect(sx - 1, sy - 1, 2, 2, redAccent);
          }
        }
        break;
      }

      case 8: {
        // --- BÁT QUÁI TRẬN ĐỒ (🥋 NHU QUYỀN HYUGA - 64 CHƯỞNG) ---
        // Vòng tròn Bát Quái: Âm dương thái cực ở tâm + 8 quẻ hào xung quanh
        const taijiRad = 8;
        for (let dy = -taijiRad; dy <= taijiRad; dy++) {
          for (let dx = -taijiRad; dx <= taijiRad; dx++) {
            if (dx * dx + dy * dy <= taijiRad * taijiRad) {
              b.set(cx + dx, cy + dy, dx < 0 ? '#09090b' : '#f8fafc');
            }
          }
        }
        b.set(cx - 3, cy, '#ffffff');
        b.set(cx + 3, cy, '#09090b');
        for (let trig = 0; trig < 8; trig++) {
          const tAng = (trig * Math.PI * 2) / 8;
          const tx = cx + Math.round(Math.cos(tAng) * (rad - 5));
          const ty = cy + Math.round(Math.sin(tAng) * (rad - 5));
          b.rect(tx - 2, ty - 1, 5, 2, goldHi);
        }
        break;
      }

      default: {
        // --- TIÊN NHÂN ĐỘNG (🐸 MYOBOKUZAN - CHỮ DẦU 油) ---
        // Biểu tượng Tiên Thuật Núi Myoboku: Chữ 油 (Dầu - Abura) trên vòng hào quang hoàng kim
        const toadGold = '#facc15';
        b.ellipse(cx, cy, 14, 14, '#78350f');
        b.ellipse(cx, cy, 12, 12, toadGold);
        // Ký tự 油 (Abura)
        b.vline(cx - 4, cy - 5, cy + 5, '#dc2626'); // ba chấm thủy
        b.rect(cx - 1, cy - 6, 7, 12, '#dc2626');
        b.rect(cx + 1, cy - 4, 3, 3, toadGold);
        b.rect(cx + 1, cy + 1, 3, 3, toadGold);
        break;
      }
    }
  }

  // Cantos arredondados
  for (const [cx, cy] of [[x0, 0], [x1, 0], [x0, h - 1], [x1, h - 1]] as const) b.clear(cx, cy);
  return b;
}

