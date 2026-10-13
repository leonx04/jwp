import { saveAccount } from '@/features/accounts/repository';
import { saveBudget } from '@/features/budgets/repository';
import { saveCategory } from '@/features/categories/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { getBiggestExpenses, loadReportInput, reportPeriod } from './queries';
import { buildMonthlyReport } from './report';

const fmt = (n: number) => `${n}đ`;

const setup = () => {
  const db = createTestDb();
  const mb = saveAccount(db, {
    name: 'MB',
    color: '#000',
    icon: 'bank:MB',
    includeInBalance: true,
  });
  const tp = saveAccount(db, {
    name: 'TP',
    color: '#000',
    icon: 'bank:TPB',
    includeInBalance: true,
  });
  const food = saveCategory(db, { name: 'Ăn uống', color: '#f00', icon: 'restaurant-outline' });
  const rent = saveCategory(db, { name: 'Tiền nhà', color: '#00f', icon: 'home-outline' });
  const add = (
    type: 'income' | 'expense',
    date: string,
    amount: number,
    title: string,
    categoryId: string | null = null,
    extra = {},
  ) =>
    saveTransaction(db, {
      type,
      amount,
      accountId: mb,
      categoryId,
      title,
      date: vnDateToMs(date, '12:00'),
      ...extra,
    });
  return { db, mb, tp, food, rent, add };
};

describe('loadReportInput + buildMonthlyReport', () => {
  it('tổng hợp tháng 9, so với tháng 8, bỏ chuyển khoản / điều chỉnh / sổ nợ', () => {
    const { db, mb, tp, food, rent, add } = setup();
    add('income', '2026-09-01', 15_000_000, 'Lương');
    add('expense', '2026-09-05', 5_000_000, 'Tiền phòng', rent);
    add('expense', '2026-09-12', 3_200_000, 'Ăn uống', food);
    add('expense', '2026-09-20', 1_234_567, 'Mua đồ', null);
    add('expense', '2026-08-05', 5_000_000, 'Tiền phòng', rent);
    add('expense', '2026-08-15', 2_000_000, 'Ăn uống', food);
    // Không được tính
    saveTransaction(db, {
      type: 'transfer',
      amount: 9_000_000,
      accountId: mb,
      toAccountId: tp,
      date: vnDateToMs('2026-09-07', '12:00'),
    });
    add('expense', '2026-09-08', 777_000, 'Điều chỉnh', null, { isAdjustment: true });
    saveBudget(db, { name: 'Ăn uống', amount: 3_000_000, categoryIds: [food], accountIds: [] });

    const today = '2026-10-02';
    const period = reportPeriod(-1, today, 1);
    expect(period).toEqual({ start: '2026-09-01', end: '2026-09-30' });

    const input = loadReportInput(db, {
      period,
      today,
      transfersAsIncomeExpense: false,
      startDayOfMonth: 1,
    });
    const r = buildMonthlyReport({ ...input, format: fmt });

    expect(r).toMatchObject({
      income: 15_000_000,
      expense: 9_434_567,
      net: 5_565_433,
      previousExpense: 7_000_000,
      inProgress: false,
    });
    expect(r.categories.map((c) => [c.name, c.amount])).toEqual([
      ['Tiền nhà', 5_000_000],
      ['Ăn uống', 3_200_000],
      ['Chưa phân loại', 1_234_567],
    ]);
    expect(r.categories[1]).toMatchObject({ previous: 2_000_000, change: 60 });
    expect(r.biggestExpenses.map((e) => [e.title, e.amount])).toEqual([
      ['Tiền phòng', 5_000_000],
      ['Ăn uống', 3_200_000],
      ['Mua đồ', 1_234_567],
    ]);
    // Ngân sách Ăn uống 3.000.000 mà chi 3.200.000 → vượt
    expect(r.budgets).toEqual([
      { name: 'Ăn uống', amount: 3_000_000, spent: 3_200_000, over: true },
    ]);
    expect(r.highlights.some((h) => h.text === 'Vượt ngân sách: Ăn uống.')).toBe(true);
  });

  it('bật "tính chuyển khoản là thu/chi" thì chuyển khoản vào số liệu', () => {
    const { db, mb, tp, add } = setup();
    add('expense', '2026-09-05', 1_000_000, 'Chi', null);
    saveTransaction(db, {
      type: 'transfer',
      amount: 500_000,
      accountId: mb,
      toAccountId: tp,
      date: vnDateToMs('2026-09-07', '12:00'),
    });
    const period = reportPeriod(-1, '2026-10-02', 1);
    const r = buildMonthlyReport({
      ...loadReportInput(db, {
        period,
        today: '2026-10-02',
        transfersAsIncomeExpense: true,
        startDayOfMonth: 1,
      }),
      format: fmt,
    });
    expect(r.expense).toBe(1_500_000);
    expect(r.income).toBe(500_000);
  });

  it('tháng đang diễn ra so với cùng số ngày đầu tháng trước', () => {
    const { db, add } = setup();
    add('expense', '2026-10-03', 100_000, 'A');
    add('expense', '2026-09-03', 400_000, 'B');
    add('expense', '2026-09-25', 9_000_000, 'C (ngoài đoạn so sánh)');
    const today = '2026-10-10';
    const r = buildMonthlyReport({
      ...loadReportInput(db, {
        period: reportPeriod(0, today, 1),
        today,
        transfersAsIncomeExpense: false,
        startDayOfMonth: 1,
      }),
      format: fmt,
    });
    expect(r).toMatchObject({ inProgress: true, expense: 100_000, previousExpense: 400_000 });
  });

  it('tháng trống', () => {
    const { db } = setup();
    const r = buildMonthlyReport({
      ...loadReportInput(db, {
        period: reportPeriod(-1, '2026-10-02', 1),
        today: '2026-10-02',
        transfersAsIncomeExpense: false,
        startDayOfMonth: 1,
      }),
      format: fmt,
    });
    expect(r.hasData).toBe(false);
    expect(getBiggestExpenses(db, { from: 0, to: Date.now() })).toEqual([]);
  });
});
