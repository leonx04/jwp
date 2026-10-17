import { countAt, easeOutCubic } from './useCountUp';
import { REVEAL_MAX_STEPS, REVEAL_STEP_MS, revealDelay } from './timing';

describe('chuyển động', () => {
  it('easeOutCubic: 0 → 0, 1 → 1, nhanh lúc đầu rồi chậm dần, kẹp trong 0–1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.8);
    expect(easeOutCubic(-3)).toBe(0);
    expect(easeOutCubic(9)).toBe(1);
  });

  it('countAt: nội suy giữa số cũ và số mới, kể cả giảm', () => {
    expect(countAt(0, 1000, 0)).toBe(0);
    expect(countAt(0, 1000, 1)).toBe(1000);
    expect(countAt(1000, 400, 1)).toBe(400);
    expect(countAt(1000, 400, 0.5)).toBeLessThan(700);
  });

  it('revealDelay: tăng theo thứ tự, có trần để khỏi chờ lâu', () => {
    expect(revealDelay(0)).toBe(0);
    expect(revealDelay(2)).toBe(2 * REVEAL_STEP_MS);
    expect(revealDelay(50)).toBe(REVEAL_MAX_STEPS * REVEAL_STEP_MS);
    expect(revealDelay(-1)).toBe(0);
  });
});
