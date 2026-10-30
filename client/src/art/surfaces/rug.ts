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
        // Biểu tượng lá xoắn ốc Mộc Diệp chính thức của Konoha
        const leafColor = '#22c55e';
        const leafLine = '#f0fdf4';
        // Vòng xoắn ốc (swirl spiral) từ tâm
        const points: [number, number][] = [];
        for (let a = 0; a < Math.PI * 3.5; a += 0.15) {
          const r = 2.5 + a * 3.2;
          if (r > rad - 5) break;
          const px = Math.round(cx + Math.cos(a) * r);
          const py = Math.round(cy + Math.sin(a) * (r * 0.85));
          points.push([px, py]);
        }
        for (const [px, py] of points) {
          b.rect(px - 1, py - 1, 3, 3, leafColor);
          b.set(px, py, leafLine);
        }
        // Mũi nhọn lá cây chìa ra góc trên bên phải (đặc trưng Konoha)
        for (let i = 0; i < 9; i++) {
          b.rect(cx + 8 + i, cy - 8 - Math.floor(i * 0.7), 3, 3, leafColor);
          b.set(cx + 9 + i, cy - 8 - Math.floor(i * 0.7), leafLine);
        }
        // Cuống lá nhô ra ở góc dưới bên trái
        for (let j = 0; j < 5; j++) {
          b.rect(cx - 7 - j, cy + 6 + Math.floor(j * 0.6), 2, 2, leafColor);
        }
        break;
      }

      case 1: {
        // --- LÀNG CÁT (SUNAGAKURE ⏳) ---
        // Biểu tượng giọt cát / đồng hồ cát đối xứng chính thức
        const sunaGold = '#f59e0b';
        const sunaHi = '#fef08a';
        // Bầu trên
        for (let y = -14; y <= -2; y++) {
          const hw = Math.round(Math.sqrt(Math.max(0, 36 - (y + 8) * (y + 8))) * 1.6);
          b.hline(cx - hw, cx + hw, cy + y, sunaGold);
        }
        // Bầu dưới
        for (let y = 2; y <= 14; y++) {
          const hw = Math.round(Math.sqrt(Math.max(0, 36 - (y - 8) * (y - 8))) * 1.6);
          b.hline(cx - hw, cx + hw, cy + y, sunaGold);
        }
        // Eo thắt hẹp ở giữa
        b.rect(cx - 2, cy - 2, 5, 5, sunaGold);
        // Rãnh xẻ dọc thẳng đứng xuyên tâm (đặc trưng làng Cát)
        b.vline(cx, cy - 12, cy + 12, '#451a03');
        b.rect(cx - 1, cy - 1, 3, 3, sunaHi);
        break;
      }

      case 2: {
        // --- LÀNG MÂY (KUMOGAKURE ⚡) ---
        // Biểu tượng đám mây xoáy sấm sét Làng Mây
        const kumoBlue = '#38bdf8';
        const kumoHi = '#f0f9ff';
        // 2 khối mây tròn lồng vào nhau
        for (let dy = -8; dy <= 8; dy++) {
          for (let dx = -14; dx <= 6; dx++) {
            if ((dx + 5) * (dx + 5) + dy * dy <= 64) b.set(cx + dx, cy + dy, kumoBlue);
            if ((dx - 2) * (dx - 2) + dy * dy <= 49) b.set(cx + dx, cy + dy, kumoBlue);
          }
        }
        // Đuôi mây nhọn vát ngang sang phải
        for (let i = 0; i < 11; i++) {
          b.rect(cx + 6 + i, cy - 2 + Math.floor(i * 0.4), 3, 3 - Math.floor(i * 0.25), kumoBlue);
          b.set(cx + 6 + i, cy - 2 + Math.floor(i * 0.4), kumoHi);
        }
        // Xoáy mây bên trong
        b.ellipse(cx - 5, cy, 4, 3, '#0c4a6e');
        b.set(cx - 5, cy, kumoHi);
        break;
      }

      case 3: {
        // --- TỔ CHỨC AKATSUKI (☁️ ĐÁM MÂY ĐỎ) ---
        // Biểu tượng đám mây đỏ viền trắng Akatsuki chính thức
        // 1. Lớp viền trắng bên ngoài đám mây
        for (let dy = -11; dy <= 11; dy++) {
          for (let dx = -16; dx <= 16; dx++) {
            const inMainW = (dx * dx) / 169 + (dy * dy) / 64 <= 1;
            const inLump1W = ((dx + 6) * (dx + 6)) / 49 + ((dy + 4) * (dy + 4)) / 36 <= 1;
            const inLump2W = ((dx - 4) * (dx - 4)) / 64 + ((dy + 3) * (dy + 3)) / 49 <= 1;
            if (inMainW || inLump1W || inLump2W) {
              b.set(cx + dx, cy + dy, '#ffffff');
            }
          }
        }
        for (let j = 0; j < 9; j++) {
          b.rect(cx - 15 - j, cy + 3 - Math.floor(j * 0.5), 4, 4, '#ffffff');
        }

        // 2. Ruột đám mây màu đỏ thắm Akatsuki bên trong
        for (let dy = -9; dy <= 9; dy++) {
          for (let dx = -14; dx <= 14; dx++) {
            const inMainR = (dx * dx) / 121 + (dy * dy) / 36 <= 1;
            const inLump1R = ((dx + 6) * (dx + 6)) / 30 + ((dy + 4) * (dy + 4)) / 20 <= 1;
            const inLump2R = ((dx - 4) * (dx - 4)) / 40 + ((dy + 3) * (dy + 3)) / 28 <= 1;
            if (inMainR || inLump1R || inLump2R) {
              b.set(cx + dx, cy + dy, redAccent);
            }
          }
        }
        for (let j = 0; j < 7; j++) {
          b.rect(cx - 14 - j, cy + 4 - Math.floor(j * 0.5), 2, 2, redAccent);
        }
        break;
      }

      case 4: {
        // --- LÀNG SƯƠNG MÙ (KIRIGAKURE 🌫️) ---
        // Biểu tượng 4 dải sóng nước nghiêng song song // // // //
        const waveCol = '#06b6d4';
        const waveHi = '#e0f2fe';
        for (let line = 0; line < 4; line++) {
          const startX = cx - 11 + line * 7;
          for (let s = -10; s <= 10; s++) {
            const waveX = startX + Math.sin(s * 0.45) * 3 + Math.floor(s * 0.3);
            const waveY = cy + s;
            b.rect(waveX, waveY, 2, 2, waveCol);
            b.set(waveX, waveY, waveHi);
          }
        }
        break;
      }

      case 5: {
        // --- GIA TỘC UCHIHA / DINH HOKAGE (🔥 QUẠT UCHIWA) ---
        // Chiếc quạt uchiwa tròn: nửa trên đỏ, nửa dưới trắng, cán quạt trắng
        const uRad = rad - 6;
        for (let dy = -uRad; dy <= uRad; dy++) {
          for (let dx = -uRad; dx <= uRad; dx++) {
            if (dx * dx + dy * dy <= uRad * uRad) {
              b.set(cx + dx, cy + dy, dy < 0 ? redAccent : '#f8fafc');
            }
          }
        }
        // Đường phân chia đỏ - trắng và viền ngoài
        b.hline(cx - uRad, cx + uRad, cy, '#1e293b');
        // Chuôi/cán quạt màu trắng thò xuống đáy
        b.rect(cx - 1, cy + uRad, 3, 7, '#f8fafc');
        b.vline(cx - 1, cy + uRad, cy + uRad + 6, '#94a3b8');
        break;
      }

      case 6: {
        // --- LÀNG ĐÁ (IWAGAKURE 🪨) ---
        // Biểu tượng 2 tảng đá góc cạnh lồng vào nhau
        const rockCol = '#94a3b8';
        const rockHi = '#f1f5f9';
        const rockDk = '#334155';
        // Tảng đá lớn bên ngoài (hình đa giác đỉnh vát)
        for (let dy = -12; dy <= 12; dy++) {
          const span = Math.round(14 - Math.abs(dy) * 0.65);
          b.hline(cx - span, cx + span, cy + dy, rockDk);
          b.set(cx - span, cy + dy, rockHi);
          b.set(cx + span, cy + dy, rockCol);
        }
        // Tảng đá nhỏ bên trong
        for (let dy = -6; dy <= 6; dy++) {
          const span = Math.round(7 - Math.abs(dy) * 0.55);
          b.hline(cx - span, cx + span, cy + dy, rockHi);
          b.set(cx - span, cy + dy, '#ffffff');
        }
        break;
      }

      case 7: {
        // --- TỘC UZUMAKI / PHÒNG CẤM THUẬT (🌀 PHONG ẤN XOÁY NƯỚC) ---
        // Vòng xoắn ốc phong ấn Uzumaki đỏ thắm
        for (let a = 0; a < Math.PI * 4.2; a += 0.12) {
          const r = 1.8 + a * 2.8;
          if (r > rad - 4) break;
          const px = Math.round(cx + Math.cos(a) * r);
          const py = Math.round(cy + Math.sin(a) * (r * 0.9));
          b.rect(px - 1, py - 1, 3, 3, redAccent);
          b.set(px, py, '#fecaca');
        }
        break;
      }

      case 8: {
        // --- LÔI ĐÀI THI ĐẤU (🥋 BÁT QUÁI TRẬN ĐỒ - NHU QUYỀN HYUGA) ---
        // Vòng tròn Bát Quái 64 Chưởng: Âm dương thái cực ở tâm + 8 quẻ hào
        const taijiRad = 8;
        for (let dy = -taijiRad; dy <= taijiRad; dy++) {
          for (let dx = -taijiRad; dx <= taijiRad; dx++) {
            if (dx * dx + dy * dy <= taijiRad * taijiRad) {
              b.set(cx + dx, cy + dy, dx < 0 ? '#09090b' : '#f8fafc');
            }
          }
        }
        // 2 mắt âm dương
        b.set(cx - 3, cy, '#ffffff');
        b.set(cx + 3, cy, '#09090b');
        // Các quẻ hào xung quanh
        for (let trig = 0; trig < 8; trig++) {
          const tAng = (trig * Math.PI * 2) / 8;
          const tx = cx + Math.round(Math.cos(tAng) * (rad - 5));
          const ty = cy + Math.round(Math.sin(tAng) * (rad - 5));
          b.rect(tx - 2, ty - 1, 5, 2, goldHi);
        }
        break;
      }

      default: {
        // --- TIÊN NHÂN ĐỘNG (🐸 MYOBOKUZAN - CÓC TIÊN PHONG) ---
        // Chữ "Dầu" (油 - Abura) trên vòng hào quang Tiên Thuật
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

