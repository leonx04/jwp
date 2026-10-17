import { vnDateToMs } from '@/lib/date';

import { buildWrapped, type WrappedTx } from './wrapped';

const tx = (date: string, amount: number, title: string, cat: string | null, type: WrappedTx['type'] = 'expense'): WrappedTx => ({
  type,
  amount,
  date: vnDateToMs(date, '12:00'),
  title,
  categoryName: cat,
  isAdjustment: false,
  debtId: null,
});

const period = { start: '2026-10-01', end: '2026-10-31', today: '2026-10-10' };

describe('buildWrapped', () => {
  const items = [
    tx('2026-10-01', 15_000_000, 'Lương', 'Lương', 'income'),
    tx('2026-10-02', 35_000, 'Cafe', 'Ăn uống'),
    tx('2026-10-03', 40_000, 'cafe', 'Ăn uống'),
    tx('2026-10-03', 900_000, 'Đổ xăng', 'Xe'),
    tx('2026-10-05', 35_000, 'Cafe', 'Ăn uống'),
    tx('2026-10-06', 1_000_000, 'Chuyển', null, 'transfer'),
  ];

  it('tổng, tiết kiệm, bỏ chuyển khoản', () => {
    const w = buildWrapped(items, period);
    expect(w).toMatchObject({ income: 15_000_000, expense: 1_010_000, txCount: 5 });
    expect(w.savingRate).toBeCloseTo(0.9327, 3);
    expect(w.verdict).toBe('great');
  });

  it('danh mục hàng đầu, ngày chi nhiều nhất, nơi hay ghé, khoản lớn nhất', () => {
    const w = buildWrapped(items, period);
    expect(w.topCategories[0]).toMatchObject({ name: 'Xe', amount: 900_000 });
    expect(w.priciestDay).toEqual({ date: '2026-10-03', amount: 940_000, count: 2 });
    expect(w.favorite).toEqual({ title: 'Cafe', count: 3, total: 110_000 });
    expect(w.biggest).toMatchObject({ title: 'Đổ xăng', amount: 900_000 });
  });

  it('ngày không chi: tính tới hôm nay', () => {
    // 10 ngày đã qua, có chi ở 3 ngày (2, 3, 5)
    expect(buildWrapped(items, period).noSpendDays).toBe(7);
  });

  it('không có thu nhập → verdict none; chi vượt thu → over', () => {
    expect(buildWrapped([tx('2026-10-02', 10, 'a', null)], period).verdict).toBe('none');
    expect(
      buildWrapped([tx('2026-10-01', 100, 'l', null, 'income'), tx('2026-10-02', 300, 'a', null)], period).verdict,
    ).toBe('over');
  });
});

describe('khoản lớn nhất không có tiêu đề', () => {
  it('dùng tên danh mục thay cho tiêu đề trống', () => {
    const w = buildWrapped([tx('2026-10-02', 2_500_000, '', 'Gửi Mẹ')], period);
    expect(w.biggest).toMatchObject({ title: 'Gửi Mẹ', amount: 2_500_000 });
  });
});
