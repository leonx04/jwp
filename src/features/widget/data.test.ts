import { saveAccount } from '@/features/accounts/repository';
import { saveBudget } from '@/features/budgets/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { loadWidgetData } from './data';

describe('loadWidgetData', () => {
  it('có ví + giao dịch + ngân sách → số liệu hôm nay và ngân sách', () => {
    const db = createTestDb();
    const acc = saveAccount(db, { name: 'Tiền mặt', color: '#000', icon: 'wallet', includeInBalance: true });
    const now = vnDateToMs('2026-10-16', '10:00');
    saveTransaction(db, { type: 'income', amount: 10_000_000, accountId: acc, title: 'Lương', date: now - 86_400_000 });
    saveTransaction(db, { type: 'expense', amount: 50_000, accountId: acc, title: 'Cafe', date: now });
    saveBudget(db, { name: 'Cafe', amount: 100_000 });
    const data = loadWidgetData(db, now);
    expect(data.today).not.toBeNull();
    expect(data.today!.spentText).toBeTruthy();
    expect(data.today!.progress).toBeGreaterThanOrEqual(0);
    expect(data.budgets).toHaveLength(1);
    expect(data.budgets[0]).toMatchObject({ name: 'Cafe', state: 'ok' });
    expect(data.budgets[0].ratio).toBeCloseTo(0.5, 5);
  });

  it('DB trống vẫn không lỗi', () => {
    const data = loadWidgetData(createTestDb(), vnDateToMs('2026-10-16', '10:00'));
    expect(data.budgets).toEqual([]);
  });
});
