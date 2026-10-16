import { saveAccount } from '@/features/accounts/repository';
import { attachTag, ensureTag } from '@/features/tags/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { getTagTotals } from './queries';

describe('getTagTotals', () => {
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
    return { db, add, accountId };
  };
  const range = { from: vnDateToMs('2026-10-01'), to: vnDateToMs('2026-11-01') };

  it('cộng chi theo tag, sắp xếp giảm dần, chỉ trong khoảng và đúng loại', () => {
    const { db, add } = setup();
    const coffee = ensureTag(db, 'Cà phê');
    const fuel = ensureTag(db, 'Xăng');
    attachTag(db, coffee, [
      add('expense', 30_000, '2026-10-02'),
      add('expense', 45_000, '2026-10-05'),
    ]);
    attachTag(db, fuel, [add('expense', 200_000, '2026-10-03')]);
    // ngoài khoảng và khác loại: bỏ qua
    attachTag(db, coffee, [
      add('expense', 99_000, '2026-09-30'),
      add('income', 500_000, '2026-10-04'),
    ]);

    const totals = getTagTotals(db, { ...range, type: 'expense' });
    expect(totals.map((t) => [t.name, t.amount, t.count])).toEqual([
      ['Xăng', 200_000, 1],
      ['Cà phê', 75_000, 2],
    ]);
  });

  it('giao dịch nhiều tag được tính vào từng tag', () => {
    const { db, add } = setup();
    const a = ensureTag(db, 'A');
    const b = ensureTag(db, 'B');
    const id = add('expense', 100_000, '2026-10-02');
    attachTag(db, a, [id]);
    attachTag(db, b, [id]);
    const totals = getTagTotals(db, { ...range, type: 'expense' });
    expect(totals.map((t) => t.amount)).toEqual([100_000, 100_000]);
  });
});
