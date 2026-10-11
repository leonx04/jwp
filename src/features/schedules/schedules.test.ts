import { count, eq } from 'drizzle-orm';

import { scheduleOccurrences, transactions } from '@/db/schema';
import { getAccountBalance, saveAccount } from '@/features/accounts/repository';
import { deleteTransaction, saveTransaction } from '@/features/transactions/repository';
import { createTestDb } from '@/test/testDb';

import { expandOccurrences } from './occurrences';
import {
  clearOccurrence,
  listOverrides,
  listSchedules,
  processAutoPost,
  rescheduleOccurrence,
  saveSchedule,
  skipOccurrence,
} from './repository';

const TODAY = '2026-10-11';

function setup() {
  const db = createTestDb();
  const mb = saveAccount(db, {
    name: 'MB',
    color: '#000000',
    icon: 'card-outline',
    includeInBalance: true,
  });
  const tcb = saveAccount(db, {
    name: 'TCB',
    color: '#000000',
    icon: 'card-outline',
    includeInBalance: true,
  });
  const rent = saveSchedule(db, {
    type: 'expense',
    amount: 3_000_000,
    accountId: mb,
    title: 'Tiền nhà',
    startDate: '2026-10-19',
    frequency: 'monthly',
  });
  return { db, mb, tcb, rent };
}

const pending = (db: ReturnType<typeof setup>['db']) =>
  expandOccurrences(listSchedules(db), listOverrides(db), {
    from: TODAY,
    to: '2026-12-31',
    today: TODAY,
  });

describe('lịch thu chi', () => {
  it('đánh dấu đã trả qua giao dịch (số tiền khác quy tắc được ghi lại), xoá giao dịch → kỳ quay lại', () => {
    const { db, mb, rent } = setup();
    const txId = saveTransaction(db, {
      type: 'expense',
      amount: 2_900_000,
      accountId: mb,
      date: Date.now(),
      scheduleId: rent,
      scheduleDueDate: '2026-10-19',
    });
    expect(listOverrides(db)[0]).toMatchObject({
      status: 'paid',
      amount: 2_900_000,
      transactionId: txId,
    });
    expect(pending(db).map((o) => o.date)).toEqual(['2026-11-19', '2026-12-19']);

    deleteTransaction(db, txId);
    expect(pending(db).map((o) => o.date)).toEqual(['2026-10-19', '2026-11-19', '2026-12-19']);
  });

  it('bỏ qua, dời ngày, hoàn tác', () => {
    const { db, rent } = setup();
    skipOccurrence(db, rent, '2026-10-19');
    rescheduleOccurrence(db, rent, '2026-11-19', '2026-11-25');
    expect(pending(db).map((o) => o.date)).toEqual(['2026-11-25', '2026-12-19']);
    clearOccurrence(db, rent, '2026-10-19');
    expect(pending(db).map((o) => o.date)).toEqual(['2026-10-19', '2026-11-25', '2026-12-19']);
  });

  it('tự ghi nhận kỳ đến hạn (lương vào thẳng ví), chạy lại không ghi trùng', () => {
    const { db, mb } = setup();
    saveSchedule(db, {
      type: 'income',
      amount: 15_000_000,
      accountId: mb,
      title: 'Lương',
      startDate: '2026-09-10',
      frequency: 'monthly',
      autoPost: true,
    });
    expect(processAutoPost(db, TODAY)).toBe(2); // 10/09 và 10/10
    expect(processAutoPost(db, TODAY)).toBe(0);
    expect(getAccountBalance(db, mb)).toBe(30_000_000);
    expect(
      db
        .select({ n: count() })
        .from(scheduleOccurrences)
        .where(eq(scheduleOccurrences.status, 'paid'))
        .get()!.n,
    ).toBe(2);
    expect(
      db
        .select()
        .from(transactions)
        .all()
        .every((t) => t.title === 'Lương'),
    ).toBe(true);
  });

  it('kiểm tra dữ liệu', () => {
    const { db, mb } = setup();
    expect(() =>
      saveSchedule(db, {
        type: 'transfer',
        amount: 1,
        accountId: mb,
        startDate: TODAY,
        frequency: 'once',
      }),
    ).toThrow(/ví nhận/);
  });
});
