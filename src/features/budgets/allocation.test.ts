import { allocationSummary } from './allocation';

describe('allocationSummary', () => {
  it('tính tỷ lệ và phần chưa phân bổ', () => {
    expect(allocationSummary(6_000_000, 15_000_000)).toEqual({
      total: 6_000_000,
      income: 15_000_000,
      ratio: 0.4,
      free: 9_000_000,
      over: false,
    });
  });

  it('phân bổ vượt thu nhập thì báo vượt', () => {
    const a = allocationSummary(16_000_000, 15_000_000);
    expect(a).toMatchObject({ over: true, free: -1_000_000 });
    expect(a!.ratio).toBeGreaterThan(1);
  });

  it('chưa biết thu nhập → null', () => {
    expect(allocationSummary(1_000, null)).toBeNull();
    expect(allocationSummary(1_000, 0)).toBeNull();
  });
});
