import { saveAccount } from '@/features/accounts/repository';
import { saveDebt } from '@/features/debts/repository';
import { saveSchedule } from '@/features/schedules/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { loadReminderItems } from './reminderSync';
import { buildReminders } from './reminders';

const NOW = vnDateToMs('2026-10-12', '08:00');

describe('loadReminderItems', () => {
  const setup = () => {
    const db = createTestDb();
    const bank = saveAccount(db, {
      name: 'TP Bank',
      color: '#000',
      icon: 'bank:TPB',
      includeInBalance: true,
    });
    return { db, bank };
  };

  it('lịch sắp tới → khoản phải trả có đường dẫn mở kỳ đó', () => {
    const { db, bank } = setup();
    saveSchedule(db, {
      type: 'expense',
      amount: 3_000_000,
      accountId: bank,
      title: 'Tiền nhà',
      startDate: '2026-10-15',
      frequency: 'once',
      interval: 1,
      endType: 'never',
      remindDaysBefore: 2,
      remindTime: '08:30',
      autoPost: false,
      active: true,
    });
    const items = loadReminderItems(db, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'payment',
      date: '2026-10-15',
      title: 'Tiền nhà',
      amount: 3_000_000,
      daysBefore: 2,
      time: '08:30',
      overdue: false,
    });
    expect(items[0].url).toContain('/schedule/occurrence?scheduleId=');
  });

  it('bill ví trả sau đã chốt kỳ → mở chi tiết ví', () => {
    const { db, bank } = setup();
    const spl = saveAccount(db, {
      name: 'Spaylater',
      color: '#E64',
      icon: 'bank:SHOPEEPAY',
      includeInBalance: false,
      credit: { limit: 10_000_000, statementDay: 14, dueDay: 31, paymentAccountId: bank },
    });
    // Mua 01/10, đã chốt kỳ 14/10 → hạn trả 31/10
    saveTransaction(db, {
      type: 'expense',
      amount: 500_000,
      accountId: spl,
      title: 'Mua hàng',
      date: vnDateToMs('2026-10-01', '12:00'),
    });
    const items = loadReminderItems(db, vnDateToMs('2026-10-20', '08:00'));
    const bill = items.find((i) => i.url === `/account/${spl}`);
    expect(bill).toMatchObject({ kind: 'payment', date: '2026-10-31', amount: 500_000 });
  });

  it('khoản nợ có hạn → nhắc đòi / trả; nợ không hạn thì bỏ qua', () => {
    const { db } = setup();
    saveDebt(db, {
      personName: 'a Quý',
      direction: 'lent',
      amount: 300_000,
      date: NOW,
      dueDate: '2026-10-14',
    });
    saveDebt(db, { personName: 'Hiền', direction: 'borrowed', amount: 100_000, date: NOW });
    const items = loadReminderItems(db, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'debt',
      title: 'a Quý hẹn trả',
      amount: 300_000,
      date: '2026-10-14',
    });

    const reminders = buildReminders({
      now: NOW,
      today: '2026-10-12',
      quietStart: '22:00',
      quietEnd: '07:00',
      flags: { payments: true, income: true, overdue: true, debts: true },
      items,
      money: (n) => `${n}`,
    });
    expect(reminders.map((r) => r.channel)).toEqual(['debts', 'debts']);
  });

  it('khoản đã trả không nhắc nữa', () => {
    const { db, bank } = setup();
    saveSchedule(db, {
      type: 'expense',
      amount: 10,
      accountId: bank,
      title: 'X',
      startDate: '2026-10-13',
      frequency: 'once',
      interval: 1,
      endType: 'never',
      autoPost: false,
      active: false,
    });
    expect(loadReminderItems(db, NOW)).toHaveLength(0);
  });
});
