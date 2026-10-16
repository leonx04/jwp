import { saveAccount } from '@/features/accounts/repository';
import { saveCategory } from '@/features/categories/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { budgetProgress, parseIdList, serializeIdList } from './compute';
import { listBudgets } from './queries';
import { deleteBudget, saveBudget } from './repository';

const base = { periodStart: '2026-10-01', periodEnd: '2026-10-31' };

describe('budgetProgress', () => {
  it('còn trong hạn mức', () => {
    const p = budgetProgress({ amount: 1_000_000, spent: 300_000, today: '2026-10-10', ...base });
    expect(p.state).toBe('ok');
    expect(p.remaining).toBe(700_000);
    expect(p.daysLeft).toBe(22);
    expect(p.perDay).toBe(31_818);
  });

  it('từ 80% là cảnh báo, vượt là over, đúng 100% chưa vượt', () => {
    expect(budgetProgress({ amount: 1000, spent: 800, today: '2026-10-10', ...base }).state).toBe(
      'warning',
    );
    expect(budgetProgress({ amount: 1000, spent: 1000, today: '2026-10-10', ...base }).state).toBe(
      'warning',
    );
    const over = budgetProgress({ amount: 1000, spent: 1200, today: '2026-10-10', ...base });
    expect(over.state).toBe('over');
    expect(over.remaining).toBe(-200);
    expect(over.perDay).toBe(0);
  });

  it('dự báo vượt theo tốc độ chi (sau ít nhất 3 ngày)', () => {
    // 10 ngày chi 500k trên hạn mức 1,2tr → cuối kỳ ~1,55tr
    const p = budgetProgress({ amount: 1_200_000, spent: 500_000, today: '2026-10-10', ...base });
    expect(p.projected).toBe(1_550_000);
    expect(p.willExceed).toBe(true);
    // đầu kỳ chưa đủ dữ liệu → không dự báo
    const early = budgetProgress({
      amount: 1_200_000,
      spent: 500_000,
      today: '2026-10-02',
      ...base,
    });
    expect(early.willExceed).toBe(false);
  });

  it('ngày cuối kỳ còn 1 ngày', () => {
    expect(budgetProgress({ amount: 100, spent: 10, today: '2026-10-31', ...base }).daysLeft).toBe(
      1,
    );
  });
});

describe('danh sách id', () => {
  it('parse / serialize', () => {
    expect(parseIdList(' a, b ,,c')).toEqual(['a', 'b', 'c']);
    expect(parseIdList(null)).toEqual([]);
    expect(serializeIdList(['a', 'b', 'a'])).toBe('a,b');
    expect(serializeIdList([])).toBeNull();
  });
});

describe('listBudgets', () => {
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
    const fuel = saveCategory(db, { name: 'Đổ xăng', color: '#0f0', icon: 'speedometer-outline' });
    const at = (d: string) => vnDateToMs(d, '12:00');
    const spend = (accountId: string, categoryId: string | null, amount: number, d: string) =>
      saveTransaction(db, { type: 'expense', amount, accountId, categoryId, date: at(d) });
    return { db, mb, tp, food, fuel, spend };
  };
  const opts = { today: '2026-10-12', startDayOfMonth: 1 };

  it('chỉ tính chi tiêu thuộc danh mục / ví / kỳ của ngân sách', () => {
    const { db, mb, tp, food, fuel, spend } = setup();
    spend(mb, food, 100_000, '2026-10-03');
    spend(tp, food, 50_000, '2026-10-05');
    spend(mb, fuel, 60_000, '2026-10-06');
    spend(mb, food, 999_999, '2026-09-30'); // kỳ trước
    saveTransaction(db, {
      type: 'income',
      amount: 5_000_000,
      accountId: mb,
      date: vnDateToMs('2026-10-02', '12:00'),
    });
    saveBudget(db, { name: 'Ăn uống', amount: 500_000, categoryIds: [food] });
    saveBudget(db, { name: 'MB', amount: 1_000_000, accountIds: [mb] });
    saveBudget(db, { name: 'Tất cả', amount: 2_000_000 });

    const [food$, mb$, all$] = listBudgets(db, opts);
    expect(food$.spent).toBe(150_000);
    expect(mb$.spent).toBe(160_000);
    expect(all$.spent).toBe(210_000);
  });

  it('khoản sổ nợ, điều chỉnh số dư và chuyển khoản không tính', () => {
    const { db, mb, tp, spend } = setup();
    spend(mb, null, 100_000, '2026-10-03');
    saveTransaction(db, {
      type: 'expense',
      amount: 77_000,
      accountId: mb,
      date: vnDateToMs('2026-10-04', '12:00'),
      isAdjustment: true,
    });
    saveTransaction(db, {
      type: 'transfer',
      amount: 300_000,
      accountId: mb,
      toAccountId: tp,
      date: vnDateToMs('2026-10-04', '12:00'),
    });
    saveBudget(db, { name: 'Tất cả', amount: 1_000_000 });
    expect(listBudgets(db, opts)[0].spent).toBe(100_000);
  });

  it('sửa, xoá và kiểm tra dữ liệu', () => {
    const { db } = setup();
    const id = saveBudget(db, { name: 'A', amount: 100 });
    saveBudget(db, { id, name: 'A2', amount: 200 });
    expect(listBudgets(db, opts)[0]).toMatchObject({ name: 'A2', amount: 200 });
    deleteBudget(db, id);
    expect(listBudgets(db, opts)).toHaveLength(0);
    expect(() => saveBudget(db, { name: '', amount: 5 })).toThrow();
    expect(() => saveBudget(db, { name: 'x', amount: 0 })).toThrow();
  });

  it('tháng bắt đầu từ ngày 15', () => {
    const { db, mb, spend } = setup();
    spend(mb, null, 10_000, '2026-10-10'); // kỳ 15/09–14/10
    spend(mb, null, 20_000, '2026-10-16'); // kỳ sau
    saveBudget(db, { name: 'T', amount: 100_000 });
    expect(listBudgets(db, { today: '2026-10-12', startDayOfMonth: 15 })[0].spent).toBe(10_000);
  });

  it('mỗi ngân sách có thể có chu kỳ riêng, không ảnh hưởng ngân sách khác', () => {
    const { db, mb, spend } = setup();
    spend(mb, null, 10_000, '2026-10-03'); // kỳ chung (ngày 1) và kỳ riêng 05/09–04/10
    spend(mb, null, 20_000, '2026-10-06'); // chỉ nằm trong kỳ riêng 05/10–04/11 khi hôm nay ≥ 05/10
    saveBudget(db, { name: 'Chung', amount: 100_000 });
    saveBudget(db, { name: 'Lương ngày 5', amount: 100_000, startDay: 5 });

    const [common, payday] = listBudgets(db, { today: '2026-10-10', startDayOfMonth: 1 });
    expect(common).toMatchObject({ spent: 30_000, startDay: null, periodStart: '2026-10-01' });
    expect(payday).toMatchObject({
      spent: 20_000,
      startDay: 5,
      periodStart: '2026-10-05',
      periodEnd: '2026-11-04',
    });
    // Chưa đến ngày 5: kỳ riêng vẫn là kỳ trước
    const [, early] = listBudgets(db, { today: '2026-10-04', startDayOfMonth: 1 });
    expect(early).toMatchObject({ periodStart: '2026-09-05', periodEnd: '2026-10-04' });
  });

  it('kiểm tra ngày bắt đầu chu kỳ hợp lệ', () => {
    const { db } = setup();
    expect(() => saveBudget(db, { name: 'x', amount: 5, startDay: 0 })).toThrow();
    expect(() => saveBudget(db, { name: 'x', amount: 5, startDay: 32 })).toThrow();
    expect(() => saveBudget(db, { name: 'x', amount: 5, startDay: 2.5 })).toThrow();
    const id = saveBudget(db, { name: 'x', amount: 5, startDay: 31 });
    saveBudget(db, { id, name: 'x', amount: 5, startDay: null });
    expect(listBudgets(db, opts)[0].startDay).toBeNull();
  });
});
