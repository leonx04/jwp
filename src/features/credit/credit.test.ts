import { getAccountBalances, totalBalance } from '@/features/accounts/queries';
import { saveAccount } from '@/features/accounts/repository';
import { computeForecast } from '@/features/forecast/forecast';
import { expandOccurrences } from '@/features/schedules/occurrences';
import { listOverrides, listSchedules } from '@/features/schedules/repository';
import { deleteTransactions, saveTransaction } from '@/features/transactions/repository';
import { addDays, vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { creditBillOccurrences, isCreditBill } from './bills';
import { getCreditSummaries } from './queries';
import { saveInstallmentPlan } from './repository';
import { firstInstallmentDue, installmentAmounts } from './statement';

const at = (date: string) => vnDateToMs(date, '12:00');

function setup() {
  const db = createTestDb();
  const bank = saveAccount(db, { name: 'MB bank', color: '#000', icon: 'bank:MB', includeInBalance: true });
  const spay = saveAccount(db, {
    name: 'SPayLater',
    color: '#EE4D2D',
    icon: 'bank:SHOPEEPAY',
    includeInBalance: false,
    credit: { limit: 5_000_000, statementDay: 31, dueDay: 10, paymentAccountId: bank },
  });
  saveTransaction(db, { type: 'income', amount: 3_000_000, accountId: bank, title: 'Lương', date: at('2026-09-01') });
  return { db, bank, spay };
}

describe('kỳ góp đầu tiên', () => {
  it.each([
    ['2026-09-15', 31, 10, '2026-10-10'],
    ['2026-09-30', 31, 10, '2026-10-10'],
    ['2026-10-01', 31, 10, '2026-11-10'],
    ['2026-09-26', 25, 10, '2026-11-10'],
    ['2026-09-15', null, null, '2026-10-15'],
  ])('mua %s (chốt %s, hạn %s) → %s', (date, statementDay, dueDay, expected) => {
    expect(firstInstallmentDue(date, statementDay, dueDay)).toBe(expected);
  });
});

describe('ví trả sau trong DB', () => {
  it('mua lẻ + trả góp → dư nợ, bill kỳ này, bill ước tính kỳ sau', () => {
    const { db, spay } = setup();
    saveTransaction(db, { type: 'expense', amount: 300_000, accountId: spay, title: 'Áo', date: at('2026-09-05') });
    const { total, perMonth } = installmentAmounts(3_000_000, 6, 59_000);
    const phone = saveTransaction(db, {
      type: 'expense',
      amount: total,
      accountId: spay,
      title: 'Tai nghe',
      date: at('2026-09-15'),
    });
    saveInstallmentPlan(db, {
      transactionId: phone,
      accountId: spay,
      title: 'Tai nghe',
      purchaseDate: '2026-09-15',
      months: 6,
      perMonth,
    });
    saveTransaction(db, { type: 'expense', amount: 250_000, accountId: spay, title: 'Sữa', date: at('2026-10-03') });

    const [summary] = getCreditSummaries(db, '2026-10-05');
    expect(summary.status.owed).toBe(300_000 + total + 250_000);
    expect(summary.status.current).toMatchObject({ dueDate: '2026-10-10', dueAmount: 300_000 + perMonth });
    expect(summary.status.next).toMatchObject({ dueDate: '2026-11-10', estimatedAmount: 250_000 + perMonth });
    expect(summary.installments[0]).toMatchObject({ months: 6, dueCount: 0, nextDueDate: '2026-10-10' });

    // Kế hoạch trả góp không lẫn vào lịch thu chi thường
    expect(listSchedules(db)).toHaveLength(0);
    expect(listSchedules(db, { includeInstallments: true })).toHaveLength(1);
  });

  it('trả bill = chuyển tiền từ ngân hàng → hết nợ kỳ này', () => {
    const { db, bank, spay } = setup();
    saveTransaction(db, { type: 'expense', amount: 500_000, accountId: spay, title: 'Áo', date: at('2026-09-20') });
    saveTransaction(db, {
      type: 'transfer',
      amount: 500_000,
      accountId: bank,
      toAccountId: spay,
      title: 'Trả SPayLater',
      date: at('2026-10-08'),
    });
    const [summary] = getCreditSummaries(db, '2026-10-08');
    expect(summary.status.owed).toBe(0);
    expect(summary.status.current?.dueAmount).toBe(0);
  });

  it('xoá khoản mua trả góp → kế hoạch bị bỏ qua', () => {
    const { db, spay } = setup();
    const tx = saveTransaction(db, { type: 'expense', amount: 1_200_000, accountId: spay, title: 'Giày', date: at('2026-09-10') });
    saveInstallmentPlan(db, { transactionId: tx, accountId: spay, title: 'Giày', purchaseDate: '2026-09-10', months: 3, perMonth: 400_000 });
    expect(getCreditSummaries(db, '2026-10-01')[0].installments).toHaveLength(1);
    deleteTransactions(db, [tx]);
    expect(getCreditSummaries(db, '2026-10-01')[0].installments).toHaveLength(0);
  });

  it('bill vào dự báo: trừ vào ví ngân hàng đúng ngày hạn', () => {
    const { db, bank, spay } = setup();
    saveTransaction(db, { type: 'expense', amount: 1_496_000, accountId: spay, title: 'Đồ', date: at('2026-09-20') });
    const today = '2026-10-05';
    const bills = creditBillOccurrences(getCreditSummaries(db, today), {
      today,
      to: addDays(today, 30),
      fallbackPayer: null,
    });
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({ date: '2026-10-10', amount: 1_496_000, type: 'transfer' });
    expect(isCreditBill(bills[0].scheduleId)).toBe(true);

    const balances = getAccountBalances(db);
    const forecast = computeForecast({
      today,
      days: 30,
      startBalance: totalBalance(balances),
      accountBalances: new Map(balances.map((b) => [b.id, b.balance])),
      includedAccounts: new Set(balances.filter((b) => b.includeInBalance).map((b) => b.id)),
      occurrences: [...expandOccurrences(listSchedules(db), listOverrides(db), { from: today, to: addDays(today, 30), today }), ...bills],
    });
    // Tổng số dư chỉ gồm ngân hàng (3tr); bill 1.496.000 trừ vào ngày 10/10
    expect(forecast.startBalance).toBe(3_000_000);
    expect(forecast.points.find((p) => p.date === '2026-10-10')?.balance).toBe(1_504_000);
    expect(forecast.walletWarnings).toHaveLength(0);
    expect(bills[0].schedule.accountId).toBe(bank);
  });
});
