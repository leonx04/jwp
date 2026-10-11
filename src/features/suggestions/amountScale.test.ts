import { scaleCandidates, suggestAmountScales, type AmountSample } from './amountScale';

const h = (...amounts: number[]): AmountSample[] => amounts.map((amount) => ({ amount, weight: 1 }));

describe('gợi ý độ lớn số tiền', () => {
  it('các bội 10 hợp lệ (≥ 1.000 ₫)', () => {
    expect(scaleCandidates(15).slice(0, 4)).toEqual([1_500, 15_000, 150_000, 1_500_000]);
    expect(scaleCandidates(2500)[0]).toBe(2_500);
  });

  it('chưa có lịch sử: khoản chi "15" → 15.000 trước', () => {
    expect(suggestAmountScales(15, [], 'expense').slice(0, 2)).toEqual([15_000, 150_000]);
  });

  it('chưa có lịch sử: khoản thu "15" → 15 triệu trước (lương)', () => {
    expect(suggestAmountScales(15, [], 'income')[0]).toBe(15_000_000);
  });

  it('cà phê hay 30–40k: gõ "35" → 35.000', () => {
    expect(suggestAmountScales(35, h(35_000, 30_000, 40_000, 35_000, 32_000), 'expense')[0]).toBe(35_000);
  });

  it('tiền nhà 3 triệu: gõ "3" → 3.000.000 dù là khoản chi', () => {
    expect(suggestAmountScales(3, h(3_000_000, 3_000_000, 2_800_000), 'expense')[0]).toBe(3_000_000);
  });

  it('đổ xăng hay 50–100k: gõ "8" → 80.000', () => {
    expect(suggestAmountScales(8, h(50_000, 100_000, 70_000, 90_000, 60_000, 80_000), 'expense')[0]).toBe(80_000);
  });

  it('số không hợp lệ', () => {
    expect(suggestAmountScales(0, [], 'expense')).toEqual([]);
  });
});
