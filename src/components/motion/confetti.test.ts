import { confettiPieces } from './confettiPieces';

describe('confettiPieces', () => {
  it('cùng số lượng mỗi lần, cố định (không đổi giữa các lần gọi), hướng lên và đủ màu', () => {
    const a = confettiPieces(30);
    const b = confettiPieces(30);
    expect(a).toHaveLength(30);
    expect(a).toEqual(b);
    expect(a.every((p) => p.vy < 0)).toBe(true);
    expect(new Set(a.map((p) => p.color)).size).toBeGreaterThan(3);
    expect(a.every((p) => p.size >= 7 && p.size <= 14)).toBe(true);
  });
});
