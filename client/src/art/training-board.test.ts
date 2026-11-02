import { describe, expect, it } from 'vitest';
import { renderFurniture } from './furniture/index';
import type { ScreenMode } from './api';
import { drawTrainingBoard } from './training-board';

const RECT = { x: 100, y: 200, w: 18, h: 12 };

/** Ghi lại mọi khối màu đã vẽ. */
function record(mode: ScreenMode, t: number, seed: number): string[] {
  const calls: string[] = [];
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      expect(x).toBeGreaterThanOrEqual(RECT.x);
      expect(y).toBeGreaterThanOrEqual(RECT.y);
      expect(x + w).toBeLessThanOrEqual(RECT.x + RECT.w);
      expect(y + h).toBeLessThanOrEqual(RECT.y + RECT.h);
      calls.push(`${this.fillStyle}:${x},${y},${w},${h}`);
    },
  };
  drawTrainingBoard(ctx as unknown as CanvasRenderingContext2D, RECT, mode, t, seed);
  return calls;
}

describe('bia tập thay màn hình', () => {
  const modes: ScreenMode[] = ['off', 'standby', 'idle', 'code', 'terminal', 'browser', 'search', 'chat', 'docs', 'tasks', 'alert', 'progress'];

  it('mọi trạng thái đều vẽ và không tràn khỏi khung bia', () => {
    for (const mode of modes) {
      for (const seed of [0, 1, 2, 7]) {
        for (const t of [0, 500, 2_600, 9_999]) expect(record(mode, t, seed).length).toBeGreaterThan(0);
      }
    }
  });

  it('nhìn là phân biệt được: đang làm, đang đọc, cần xử lý, đang chờ, nghỉ, không có người', () => {
    const at = (m: ScreenMode) => record(m, 1_000, 0).join('|');
    const shown = new Set(['code', 'terminal', 'docs', 'alert', 'progress', 'idle', 'off'].map((m) => at(m as ScreenMode)));
    expect(shown.size).toBe(7);
  });

  it('có chuyển động khi session đang làm việc, và đứng yên khi nghỉ', () => {
    expect(record('code', 0, 0).join()).not.toBe(record('code', 1_000, 0).join());
    expect(record('alert', 0, 0).join()).not.toBe(record('alert', 350, 0).join());
    expect(record('idle', 0, 0).join()).toBe(record('idle', 1_000, 0).join());
  });

  it('bàn tập vẫn có vùng bia để hiện trạng thái, kể cả ở mọi biến thể', () => {
    for (const v of ['wood', 'white', 'dark']) {
      for (let seed = 0; seed < 6; seed++) {
        const r = renderFurniture('desk', v, 0, seed).base.rects?.screen;
        expect(r).toBeDefined();
        expect(r!.w).toBe(18);
        expect(r!.h).toBe(12);
      }
    }
  });
});
