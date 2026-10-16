import { saveAccount } from '@/features/accounts/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { getTypicalMonth } from './queries';

describe('getTypicalMonth', () => {
  const setup = () => {
    const db = createTestDb();
    const accountId = saveAccount(db, {
      name: 'MB',
      color: '#000',
      icon: 'bank:MB',
      includeInBalance: true,
    });
    const add = (type: 'income' | 'expense', amount: number, date: string) =>
      saveTransaction(db, { type, amount, accountId, date: vnDateToMs(date, '12:00') });
    return { db, add };
  };

  it('chưa có giao dịch → null', () => {
    const { db } = setup();
    expect(getTypicalMonth(db, '2026-10-16')).toBeNull();
  });

  it('trung bình thu / chi của các tháng trọn vẹn gần nhất, bỏ tháng hiện tại', () => {
    const { db, add } = setup();
    add('income', 15_000_000, '2026-07-05');
    add('expense', 9_000_000, '2026-07-10');
    add('income', 15_000_000, '2026-08-05');
    add('expense', 11_000_000, '2026-08-10');
    add('income', 18_000_000, '2026-09-05');
    add('expense', 10_000_000, '2026-09-10');
    // tháng hiện tại đang dở: không tính
    add('expense', 5_000_000, '2026-10-02');

    const result = getTypicalMonth(db, '2026-10-16', 1, 3);
    expect(result).toEqual({ income: 16_000_000, expense: 10_000_000, months: 3 });
  });

  it('chỉ có một tháng dữ liệu thì dùng tháng đó', () => {
    const { db, add } = setup();
    add('income', 12_000_000, '2026-09-05');
    add('expense', 4_000_000, '2026-09-20');
    expect(getTypicalMonth(db, '2026-10-16')).toEqual({
      income: 12_000_000,
      expense: 4_000_000,
      months: 1,
    });
  });
});
