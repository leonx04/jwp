import { grossToNet, netToGross, progressiveTax } from './tax';

describe('progressiveTax', () => {
  it('luỹ tiến 5 bậc', () => {
    expect(progressiveTax(0)).toBe(0);
    expect(progressiveTax(2_400_000)).toBe(120_000);
    expect(progressiveTax(10_000_000)).toBe(500_000);
    expect(progressiveTax(29_586_000)).toBe(500_000 + 1_958_600);
    // 10tr×5% + 20tr×10% + 30tr×20% + 40tr×30% + 20tr×35%
    expect(progressiveTax(120_000_000)).toBe(500_000 + 2_000_000 + 6_000_000 + 12_000_000 + 7_000_000);
  });
});

describe('grossToNet', () => {
  it('20 triệu, không phụ thuộc: bảo hiểm 10,5%, chỉ chịu thuế 5% phần vượt giảm trừ', () => {
    expect(grossToNet(20_000_000)).toMatchObject({
      insurance: 2_100_000,
      taxable: 2_400_000,
      pit: 120_000,
      net: 17_780_000,
    });
  });

  it('dưới ngưỡng giảm trừ thì không đóng thuế', () => {
    const r = grossToNet(15_000_000);
    expect(r.taxable).toBe(0);
    expect(r.pit).toBe(0);
    expect(r.net).toBe(15_000_000 - 1_575_000);
  });

  it('người phụ thuộc giảm thuế', () => {
    expect(grossToNet(30_000_000, 2).pit).toBeLessThan(grossToNet(30_000_000, 0).pit);
  });

  it('lương cao: BHXH/BHYT bị chặn bởi trần 20 lần lương cơ sở', () => {
    const r = grossToNet(50_000_000);
    expect(r.bhxh).toBe(Math.round(46_800_000 * 0.08));
    expect(r.bhyt).toBe(Math.round(46_800_000 * 0.015));
    expect(r.net).toBe(r.gross - r.insurance - r.pit);
    // BHTN có trần riêng (20 × lương tối thiểu vùng I) nên vẫn đóng 1% trên 50tr
    expect(r.bhtn).toBe(500_000);
    // thu nhập tính thuế 29,554tr → 0,5tr + 19,554tr × 10%
    expect(r.pit).toBe(2_455_400);
  });
});

describe('netToGross', () => {
  it('đổi ngược khớp với grossToNet', () => {
    for (const net of [10_000_000, 17_780_000, 25_000_000, 60_000_000]) {
      for (const deps of [0, 1, 2]) {
        const r = netToGross(net, deps);
        expect(r.net).toBeGreaterThanOrEqual(net);
        expect(grossToNet(r.gross - 1, deps).net).toBeLessThan(net);
      }
    }
  });

  it('thực nhận 17.780.000 ↔ gộp 20.000.000', () => {
    expect(netToGross(17_780_000).gross).toBe(20_000_000);
  });
});
