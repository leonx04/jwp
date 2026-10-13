import type { CategoryTotal, DailyFlow } from '@/features/stats/analysis';
import { vnDateToMs } from '@/lib/date';

import { buildMonthlyReport, reportToText, type ReportInput } from './report';

const fmt = (n: number) => `${n.toLocaleString('en-US')}đ`;
const period = { start: '2026-09-01', end: '2026-09-30' };

const day = (date: string, income: number, expense: number): DailyFlow => ({
  date,
  income,
  expense,
  count: 1,
});
const cat = (key: string, name: string, amount: number): CategoryTotal => ({
  key,
  categoryId: key,
  name,
  color: '#000',
  icon: null,
  amount,
  count: 1,
});

const base = (over: Partial<ReportInput> = {}): ReportInput => ({
  period,
  today: '2026-10-02',
  daily: [
    day('2026-09-01', 15_000_000, 0),
    day('2026-09-10', 0, 6_000_000),
    day('2026-09-20', 0, 4_200_000),
  ],
  previousDaily: [day('2026-08-01', 14_000_000, 0), day('2026-08-12', 0, 11_000_000)],
  categories: [
    cat('an', 'Ăn uống', 3_200_000),
    cat('nha', 'Tiền nhà', 5_000_000),
    cat('xe', 'Đi lại', 2_000_000),
  ],
  previousCategories: [cat('an', 'Ăn uống', 2_000_000), cat('nha', 'Tiền nhà', 5_000_000)],
  biggestExpenses: [
    {
      id: 'a',
      title: 'Tiền phòng',
      categoryName: 'Tiền nhà',
      amount: 5_000_000,
      date: vnDateToMs('2026-09-10'),
    },
  ],
  budgets: [],
  format: fmt,
  ...over,
});

describe('buildMonthlyReport', () => {
  it('tổng thu / chi, còn lại, tỷ lệ tiết kiệm, so với tháng trước (không làm tròn tiền)', () => {
    const r = buildMonthlyReport(base());
    expect(r).toMatchObject({
      income: 15_000_000,
      expense: 10_200_000,
      net: 4_800_000,
      previousExpense: 11_000_000,
      inProgress: false,
      hasData: true,
    });
    expect(r.savingRate).toBeCloseTo(32);
    expect(r.expenseChange).toBeCloseTo(-7.27, 1);
    expect(r.averagePerDay).toBeCloseTo(340_000);
    expect(r.topDay).toEqual({ date: '2026-09-10', amount: 6_000_000 });
  });

  it('danh mục: xếp theo số tiền, tỷ trọng, thay đổi so với kỳ trước; phần dư gom vào "khác"', () => {
    const many = [1, 2, 3, 4, 5, 6, 7].map((i) => cat(`c${i}`, `Mục ${i}`, i * 100_000));
    const r = buildMonthlyReport(base({ categories: many, previousCategories: [] }));
    expect(r.categories.map((c) => c.name)).toEqual(['Mục 7', 'Mục 6', 'Mục 5', 'Mục 4', 'Mục 3']);
    expect(r.otherAmount).toBe(300_000);
    expect(r.categories[0].change).toBeNull();

    const r2 = buildMonthlyReport(base());
    expect(r2.categories[0]).toMatchObject({ name: 'Tiền nhà', previous: 5_000_000, change: 0 });
    expect(r2.categories[1]).toMatchObject({ name: 'Ăn uống', previous: 2_000_000, change: 60 });
  });

  it('nhận xét: chi giảm, còn lại, danh mục tăng mạnh', () => {
    const texts = buildMonthlyReport(base()).highlights.map((h) => h.text);
    expect(texts[0]).toBe('Chi tiêu giảm 7% so với tháng trước (−800,000đ).');
    expect(texts).toContain('Còn lại 4,800,000đ, bằng 32% thu nhập.');
    expect(texts).toContain('Chi nhiều nhất cho Tiền nhà: 5,000,000đ (49% tổng chi).');
    expect(texts).toContain('Ăn uống tăng 1,200,000đ so với tháng trước.');
  });

  it('chi vượt thu; không có thu nhập', () => {
    const over = buildMonthlyReport(base({ daily: [day('2026-09-01', 1_000_000, 3_000_000)] }));
    expect(over.net).toBe(-2_000_000);
    expect(
      over.highlights.some((h) => h.text === 'Chi vượt thu 2,000,000đ.' && h.tone === 'bad'),
    ).toBe(true);
    const none = buildMonthlyReport(base({ daily: [day('2026-09-03', 0, 50_000)] }));
    expect(none.savingRate).toBeNull();
    expect(none.highlights.some((h) => h.key === 'no-income')).toBe(true);
  });

  it('tháng đang diễn ra: trung bình theo số ngày đã qua và ghi chú cùng kỳ', () => {
    const r = buildMonthlyReport(
      base({
        period: { start: '2026-10-01', end: '2026-10-31' },
        today: '2026-10-10',
        daily: [day('2026-10-02', 0, 1_000_000)],
        previousDaily: [day('2026-09-02', 0, 500_000)],
      }),
    );
    expect(r.inProgress).toBe(true);
    expect(r.averagePerDay).toBe(100_000);
    expect(r.highlights[0].text).toContain('cùng kỳ tháng trước');
  });

  it('ngân sách: vượt thì nêu tên, đạt hết thì khen', () => {
    const ok = buildMonthlyReport(
      base({ budgets: [{ name: 'Ăn uống', amount: 4_000_000, spent: 3_200_000 }] }),
    );
    expect(ok.highlights.find((h) => h.key === 'budgets')?.tone).toBe('good');
    const bad = buildMonthlyReport(
      base({
        budgets: [
          { name: 'Ăn uống', amount: 3_000_000, spent: 3_200_000 },
          { name: 'Đi lại', amount: 3_000_000, spent: 2_000_000 },
        ],
      }),
    );
    expect(bad.highlights.find((h) => h.key === 'budgets')?.text).toBe('Vượt ngân sách: Ăn uống.');
  });

  it('tháng trống → hasData false, không nhận xét thừa', () => {
    const r = buildMonthlyReport(
      base({
        daily: [],
        previousDaily: [],
        categories: [],
        previousCategories: [],
        biggestExpenses: [],
      }),
    );
    expect(r.hasData).toBe(false);
    expect(r.highlights).toEqual([]);
  });
});

describe('reportToText', () => {
  it('có đủ các phần chính', () => {
    const r = buildMonthlyReport(base());
    const text = reportToText(r, 'Báo cáo tháng 9/2026', '01/09 – 30/09', fmt);
    expect(text).toContain('Báo cáo tháng 9/2026 (01/09 – 30/09)');
    expect(text).toContain('Thu: 15,000,000đ');
    expect(text).toContain('Chi: 10,200,000đ');
    expect(text).toContain('Còn lại: 4,800,000đ (32% thu nhập)');
    expect(text).toContain('1. Tiền nhà: 5,000,000đ (49%)');
    expect(text).toContain('Tiền phòng: 5,000,000đ');
    expect(text).not.toContain('chưa kết thúc');
  });
});
