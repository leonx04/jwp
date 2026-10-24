import { getAccountBalances } from '@/features/accounts/queries';
import { saveAccount } from '@/features/accounts/repository';
import { isLoanInstallment, loanOfOccurrence } from '@/features/debts/loanOccurrences';
import { payInstallment, saveDebt, saveDebtTerms } from '@/features/debts/repository';
import { loadCalendarMonth } from '@/features/schedules/calendar';
import { saveSchedule } from '@/features/schedules/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { loadFinancialSnapshot } from './snapshot';

const setup = () => {
  const db = createTestDb();
  const wallet = saveAccount(db, {
    name: 'VCB',
    color: '#16A34A',
    icon: 'cash-outline',
    includeInBalance: true,
  });
  const loan = (direction: 'borrowed' | 'lent', personName: string, amount: number) => {
    const id = saveDebt(db, {
      personName,
      direction,
      amount,
      date: vnDateToMs('2026-10-05', '10:00'),
      accountId: wallet,
    });
    saveDebtTerms(db, id, {
      annualRate: 12,
      months: 12,
      method: 'annuity',
      startDate: '2026-10-05',
    });
    return id;
  };
  return { db, wallet, loan };
};

describe('ảnh chụp tài chính: kỳ trả nợ có lãi', () => {
  it('kỳ vay sắp tới nằm trong dự trù và trừ vào mức chi an toàn', () => {
    const { db, loan } = setup();
    const debtId = loan('borrowed', 'FE Credit', 50_000_000);
    const snap = loadFinancialSnapshot(db, { today: '2026-10-24', days: 30 });

    const loans = snap.occurrences.filter((o) => isLoanInstallment(o.scheduleId));
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({
      date: '2026-11-05',
      amount: 4_442_439,
      type: 'expense',
      status: 'upcoming',
    });
    expect(loanOfOccurrence(loans[0].scheduleId)).toEqual({ debtId, period: 1 });
    expect(loans[0].schedule.title).toContain('FE Credit');

    const event = snap.forecast.events.find((e) => isLoanInstallment(e.occurrence.scheduleId))!;
    expect(event.delta).toBe(-4_442_439);
    expect(snap.forecast.endBalance).toBe(50_000_000 - 4_442_439);
  });

  it('kỳ đã trả không còn trong dự trù; Lịch vẫn hiện là đã trả', () => {
    const { db, wallet, loan } = setup();
    const debtId = loan('borrowed', 'FE Credit', 50_000_000);
    payInstallment(db, {
      debtId,
      period: 1,
      principal: 3_942_439,
      interest: 500_000,
      date: vnDateToMs('2026-11-04', '09:00'),
      accountId: wallet,
    });

    const snap = loadFinancialSnapshot(db, { today: '2026-11-04', days: 35 });
    const pending = snap.occurrences.filter((o) => isLoanInstallment(o.scheduleId));
    expect(pending.map((o) => loanOfOccurrence(o.scheduleId)!.period)).toEqual([2]);
    expect(pending[0].date).toBe('2026-12-05');

    const month = loadCalendarMonth(db, '2026-11-01', { today: '2026-11-04' });
    const nov5 = month.days.find((d) => d.date === '2026-11-05')!;
    expect(nov5.planned.map((o) => o.status)).toEqual(['paid']);
  });

  it('kỳ quá hạn dồn vào hôm nay', () => {
    const { db, loan } = setup();
    loan('borrowed', 'FE Credit', 50_000_000);
    const snap = loadFinancialSnapshot(db, { today: '2026-11-08', days: 30 });
    const first = snap.forecast.events.find((e) => isLoanInstallment(e.occurrence.scheduleId))!;
    expect(first.occurrence.status).toBe('overdue');
    expect(first.date).toBe('2026-11-08');
  });

  it('cho vay theo kỳ: hiện trong danh sách nhưng không cộng vào dự trù / kỳ nhận tiền', () => {
    const { db, wallet, loan } = setup();
    loan('lent', 'Bạn A', 10_000_000);
    saveSchedule(db, {
      type: 'income',
      amount: 15_000_000,
      accountId: wallet,
      title: 'Lương',
      startDate: '2026-11-10',
      frequency: 'monthly',
    });
    const snap = loadFinancialSnapshot(db, { today: '2026-10-24', days: 30 });
    const start = getAccountBalances(db)[0].balance;

    expect(snap.occurrences.some((o) => isLoanInstallment(o.scheduleId))).toBe(true);
    expect(snap.forecast.events.some((e) => isLoanInstallment(e.occurrence.scheduleId))).toBe(
      false,
    );
    expect(snap.forecast.nextIncome).toMatchObject({ date: '2026-11-10' });
    expect(snap.forecast.endBalance).toBe(start + 15_000_000);
  });
});
