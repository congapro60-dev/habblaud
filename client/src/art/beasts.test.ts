import { describe, expect, it } from 'vitest';
import { BEAST_FRAMES, BEAST_KINDS, renderBeast } from './beasts';

/** Số pixel có màu và chuỗi nhận dạng của ảnh. */
function info(kind: (typeof BEAST_KINDS)[number], frame: number): { filled: number; key: string } {
  const b = renderBeast(kind, frame);
  let filled = 0;
  for (let i = 3; i < b.data.length; i += 4) if (b.data[i] > 0) filled++;
  return { filled, key: b.data.join() };
}

describe('sprite vĩ thú và linh thú', () => {
  it('đủ 10 vĩ thú, 4 linh thú, 3 Susanoo, Lục Đạo', () => {
    expect(BEAST_KINDS.length).toBe(19);
    expect(BEAST_KINDS).toContain('juubi');
    expect(BEAST_KINDS).toContain('hagoromo');
  });

  it('mỗi loại đều có hình đủ lớn và khác hẳn các loại còn lại', () => {
    const keys = new Set<string>();
    for (const kind of BEAST_KINDS) {
      const { filled, key } = info(kind, 0);
      expect(filled, kind).toBeGreaterThan(900);
      keys.add(key);
    }
    expect(keys.size).toBe(BEAST_KINDS.length);
  });

  it('có chuyển động: các khung hình không giống hệt nhau', () => {
    for (const kind of BEAST_KINDS) {
      const frames = new Set(Array.from({ length: BEAST_FRAMES }, (_, f) => info(kind, f).key));
      expect(frames.size, kind).toBeGreaterThan(1);
    }
  });
});
