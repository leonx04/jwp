import { count, eq } from 'drizzle-orm';

import { scheduleOccurrences, schedules, transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { getAccountBalances } from '@/features/accounts/queries';
import {
  adjustBalance,
  deleteAccount,
  getAccountBalance,
  saveAccount,
} from '@/features/accounts/repository';
import { FEE_CATEGORY_ID, saveCategory } from '@/features/categories/repository';
import { createDefaultData } from '@/features/onboarding/defaults';
import { ensureTag, listTags, saveTag } from '@/features/tags/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { getPeriodSummary, listTransactions } from './queries';
import {
  deleteTransaction,
  getTransaction,
  restoreSnapshot,
  saveTransaction,
  TransactionValidationError,
} from './repository';

const at = (date: string, time = '12:00') => vnDateToMs(date, time);

function setup() {
  const db = createTestDb();
  const cash = saveAccount(db, {
    name: 'Tiền mặt',
    color: '#000000',
    icon: 'cash-outline',
    includeInBalance: true,
  });
  const bank = saveAccount(db, {
    name: 'MB bank',
    color: '#111111',
    icon: 'card-outline',
    includeInBalance: true,
  });
  const food = saveCategory(db, { name: 'Ăn uống', color: '#F97316', icon: 'restaurant-outline' });
  return { db, cash, bank, food };
}

const balanceOf = (db: AppDatabase, id: string) => getAccountBalance(db, id);

describe('thêm / sửa giao dịch', () => {
  it('thêm khoản chi có tag, sửa lại', () => {
    const { db, cash, food } = setup();
    const tag = ensureTag(db, '#Du lịch');
    const id = saveTransaction(db, {
      type: 'expense',
      amount: 35_000,
      accountId: cash,
      categoryId: food,
      title: '  Cà phê sữa  ',
      date: at('2026-10-11', '07:30'),
      tagIds: [tag, tag],
    });
    const tx = getTransaction(db, id)!;
    expect(tx).toMatchObject({ title: 'Cà phê sữa', titleKey: 'ca phe sua', amount: 35_000 });
    expect(tx.tagIds).toEqual([tag]);
    expect(balanceOf(db, cash)).toBe(-35_000);

    saveTransaction(db, { ...tx, id, amount: 40_000, tagIds: [] });
    expect(getTransaction(db, id)).toMatchObject({ amount: 40_000, tagIds: [] });
    expect(balanceOf(db, cash)).toBe(-40_000);
  });

  it('chuyển tiền giữa ví + phí chuyển khoản', () => {
    const { db, cash, bank } = setup();
    saveTransaction(db, {
      type: 'income',
      amount: 5_000_000,
      accountId: bank,
      date: at('2026-10-01'),
    });
    const id = saveTransaction(db, {
      type: 'transfer',
      amount: 1_000_000,
      accountId: bank,
      toAccountId: cash,
      fee: 3_300,
      date: at('2026-10-02'),
    });
    expect(balanceOf(db, bank)).toBe(5_000_000 - 1_000_000 - 3_300);
    expect(balanceOf(db, cash)).toBe(1_000_000);
    const fee = db.select().from(transactions).where(eq(transactions.parentId, id)).get()!;
    expect(fee).toMatchObject({ type: 'expense', amount: 3_300, categoryId: FEE_CATEGORY_ID });
    expect(getTransaction(db, id)!.fee).toBe(3_300);

    // Sửa phí về 0 → xoá giao dịch phí
    saveTransaction(db, {
      type: 'transfer',
      amount: 1_000_000,
      accountId: bank,
      toAccountId: cash,
      fee: 0,
      date: at('2026-10-02'),
      id,
    });
    expect(balanceOf(db, bank)).toBe(4_000_000);
    // Xoá chuyển khoản → xoá luôn phí (nếu có)
    deleteTransaction(db, id);
    expect(balanceOf(db, bank)).toBe(5_000_000);
    expect(balanceOf(db, cash)).toBe(0);
  });

  it('kiểm tra dữ liệu không hợp lệ', () => {
    const { db, cash } = setup();
    const base = { type: 'expense' as const, accountId: cash, date: Date.now() };
    expect(() => saveTransaction(db, { ...base, amount: 0 })).toThrow(TransactionValidationError);
    expect(() => saveTransaction(db, { ...base, amount: 1.5 })).toThrow(TransactionValidationError);
    expect(() =>
      saveTransaction(db, { ...base, type: 'transfer', amount: 1000, toAccountId: cash }),
    ).toThrow(/khác nhau/);
    expect(() => saveTransaction(db, { ...base, type: 'transfer', amount: 1000 })).toThrow(
      /ví nhận/,
    );
  });
});

describe('xoá và hoàn tác', () => {
  it('khôi phục đủ giao dịch, tag, phí và kỳ lịch đã trả', () => {
    const { db, cash, bank } = setup();
    const tag = ensureTag(db, 'Nhà');
    db.insert(schedules)
      .values({
        id: 'S1',
        type: 'expense',
        amount: 3_000_000,
        accountId: bank,
        startDate: '2026-10-01',
        frequency: 'monthly',
      })
      .run();
    const paid = saveTransaction(db, {
      type: 'expense',
      amount: 3_000_000,
      accountId: bank,
      date: at('2026-10-01'),
      tagIds: [tag],
      scheduleId: 'S1',
      scheduleDueDate: '2026-10-01',
    });
    db.insert(scheduleOccurrences)
      .values({ scheduleId: 'S1', dueDate: '2026-10-01', status: 'paid', transactionId: paid })
      .run();
    const transfer = saveTransaction(db, {
      type: 'transfer',
      amount: 500_000,
      accountId: bank,
      toAccountId: cash,
      fee: 1_000,
      date: at('2026-10-03'),
    });

    const before = getAccountBalances(db);
    const s1 = deleteTransaction(db, paid);
    const s2 = deleteTransaction(db, transfer);
    expect(db.select({ n: count() }).from(transactions).get()!.n).toBe(0);
    expect(db.select({ n: count() }).from(scheduleOccurrences).get()!.n).toBe(0);

    restoreSnapshot(db, s2);
    restoreSnapshot(db, s1);
    expect(getAccountBalances(db)).toEqual(before);
    expect(getTransaction(db, paid)!.tagIds).toEqual([tag]);
    expect(getTransaction(db, transfer)!.fee).toBe(1_000);
    expect(db.select().from(scheduleOccurrences).get()).toMatchObject({
      status: 'paid',
      transactionId: paid,
    });
  });
});

describe('danh sách & tìm kiếm', () => {
  function seed() {
    const ctx = setup();
    const { db, cash, bank, food } = ctx;
    const tag = ensureTag(db, 'Công ty');
    saveTransaction(db, {
      type: 'expense',
      amount: 35_000,
      accountId: cash,
      categoryId: food,
      title: 'Cà phê',
      date: at('2026-10-10', '07:00'),
      tagIds: [tag],
    });
    saveTransaction(db, {
      type: 'expense',
      amount: 50_000,
      accountId: cash,
      title: 'Gửi xe',
      date: at('2026-10-10', '08:00'),
    });
    saveTransaction(db, {
      type: 'income',
      amount: 15_000_000,
      accountId: bank,
      title: 'Lương tháng 9',
      date: at('2026-10-05'),
    });
    saveTransaction(db, {
      type: 'transfer',
      amount: 2_000_000,
      accountId: bank,
      toAccountId: cash,
      date: at('2026-10-06'),
    });
    saveTransaction(db, {
      type: 'expense',
      amount: 99_000,
      accountId: bank,
      categoryId: food,
      title: 'Phở',
      date: at('2026-09-30'),
    });
    return { ...ctx, tag };
  }

  it('mới nhất trước, kèm tên ví / danh mục / tag', () => {
    const { db } = seed();
    const list = listTransactions(db);
    expect(list.map((t) => t.title)).toEqual(['Gửi xe', 'Cà phê', '', 'Lương tháng 9', 'Phở']);
    expect(list[1]).toMatchObject({
      accountName: 'Tiền mặt',
      categoryName: 'Ăn uống',
      tagNames: ['Công ty'],
    });
    expect(list[2]).toMatchObject({ type: 'transfer', toAccountName: 'Tiền mặt' });
  });

  it('tìm không dấu, lọc theo ví / danh mục / tag / loại / khoảng ngày', () => {
    const { db, cash, food, tag } = seed();
    expect(listTransactions(db, { search: 'ca phe' }).map((t) => t.title)).toEqual(['Cà phê']);
    expect(listTransactions(db, { search: 'LUONG' }).map((t) => t.title)).toEqual([
      'Lương tháng 9',
    ]);
    // Lọc theo ví gồm cả chuyển khoản vào ví đó
    expect(listTransactions(db, { accountId: cash })).toHaveLength(3);
    expect(listTransactions(db, { categoryId: food })).toHaveLength(2);
    expect(listTransactions(db, { categoryId: 'none' }).map((t) => t.title)).toEqual([
      'Gửi xe',
      'Lương tháng 9',
    ]);
    expect(listTransactions(db, { tagId: tag })).toHaveLength(1);
    expect(listTransactions(db, { types: ['income'] })).toHaveLength(1);
    expect(
      listTransactions(db, { from: at('2026-10-01', '00:00'), to: at('2026-11-01', '00:00') }),
    ).toHaveLength(4);
    expect(listTransactions(db, { minAmount: 40_000, maxAmount: 100_000 })).toHaveLength(2);
  });

  it('tổng thu/chi trong kỳ: bỏ chuyển khoản, điều chỉnh số dư; tuỳ chọn tính chuyển khoản', () => {
    const { db, cash } = seed();
    adjustBalance(db, cash, 10_000_000, at('2026-10-11'));
    const period = { from: at('2026-10-01', '00:00'), to: at('2026-11-01', '00:00') };
    expect(getPeriodSummary(db, period)).toMatchObject({ income: 15_000_000, expense: 85_000 });
    expect(getPeriodSummary(db, { ...period, transfersAsIncomeExpense: true })).toMatchObject({
      income: 17_000_000,
      expense: 2_085_000,
    });
    expect(
      getPeriodSummary(db, { ...period, accountId: cash, transfersAsIncomeExpense: true }),
    ).toMatchObject({
      income: 2_000_000,
      expense: 85_000,
    });
  });
});

describe('ví', () => {
  it('điều chỉnh số dư về số thực tế', () => {
    const { db, cash } = setup();
    saveTransaction(db, {
      type: 'expense',
      amount: 30_000,
      accountId: cash,
      date: at('2026-10-01'),
    });
    expect(adjustBalance(db, cash, 500_000)).not.toBeNull();
    expect(balanceOf(db, cash)).toBe(500_000);
    expect(adjustBalance(db, cash, 500_000)).toBeNull();
    adjustBalance(db, cash, 100_000);
    expect(balanceOf(db, cash)).toBe(100_000);
  });

  it('không xoá ví còn giao dịch trừ khi đồng ý xoá cả giao dịch', () => {
    const { db, cash, bank } = setup();
    saveTransaction(db, {
      type: 'transfer',
      amount: 1_000,
      accountId: bank,
      toAccountId: cash,
      date: Date.now(),
    });
    expect(() => deleteAccount(db, cash)).toThrow(/1 giao dịch/);
    deleteAccount(db, cash, true);
    expect(db.select({ n: count() }).from(transactions).get()!.n).toBe(0);
  });
});

describe('tag', () => {
  it('không tạo trùng khi khác dấu / hoa thường / có #', () => {
    const { db } = setup();
    const a = ensureTag(db, 'Du lịch');
    expect(ensureTag(db, '#du lich')).toBe(a);
    expect(ensureTag(db, 'DU LỊCH ')).toBe(a);
    const b = ensureTag(db, 'Công ty');
    expect(() => saveTag(db, { id: b, name: 'du lịch' })).toThrow(/Đã có tag/);
    expect(listTags(db).map((t) => t.name)).toEqual(['Công ty', 'Du lịch']);
  });
});

describe('dữ liệu mặc định', () => {
  it('chạy lại nhiều lần không trùng', () => {
    const db = createTestDb();
    createDefaultData(db);
    createDefaultData(db);
    expect(getAccountBalances(db)).toHaveLength(1);
  });
});
