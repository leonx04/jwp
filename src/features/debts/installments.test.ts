import { getAccountBalances } from '@/features/accounts/queries';
import { saveAccount } from '@/features/accounts/repository';
import { LOAN_INTEREST_CATEGORY_ID } from '@/features/categories/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';
import { transactions } from '@/db/schema';

import { installmentPlan, parseRateSteps } from './installments';
import { getDebtItem, listDebts } from './queries';
import {
  addDebtRecord,
  deleteDebt,
  deleteDebtRecord,
  payInstallment,
  saveDebt,
  saveDebtTerms,
} from './repository';

const terms = {
  principal: 50_000_000,
  annualRate: 12,
  months: 12,
  method: 'annuity' as const,
  startDate: '2026-10-05',
};

describe('lịch trả theo dư nợ thật', () => {
  it('chưa trả kỳ nào: kỳ 1 hạn 05/11, đến kỳ khi còn 7 ngày', () => {
    const plan = installmentPlan(terms, [], 50_000_000, '2026-10-30');
    expect(plan.paidCount).toBe(0);
    expect(plan.next).toMatchObject({
      period: 1,
      date: '2026-11-05',
      payment: 4_442_439,
      status: 'due',
    });
    expect(installmentPlan(terms, [], 50_000_000, '2026-10-20').next!.status).toBe('upcoming');
    expect(installmentPlan(terms, [], 50_000_000, '2026-11-06').next!.status).toBe('overdue');
  });

  it('trả đúng kỳ 1 và 2: lịch còn lại giữ nguyên số trả đều', () => {
    const plan = installmentPlan(
      terms,
      [
        { type: 'repay', amount: 3_942_439, period: 1 },
        { type: 'repay', amount: 3_981_863, period: 2 },
      ],
      50_000_000 - 3_942_439 - 3_981_863,
      '2026-12-10',
    );
    expect(plan.paidCount).toBe(2);
    expect(plan.rows.slice(0, 2).every((r) => r.status === 'paid')).toBe(true);
    expect(plan.next).toMatchObject({ period: 3, payment: 4_442_439, date: '2027-01-05' });
    expect(plan.rows).toHaveLength(12);
  });

  it('trả trước 10 triệu sau kỳ 1: các kỳ sau tính lại, giảm tiền mỗi tháng, giữ hạn cuối', () => {
    const plan = installmentPlan(
      terms,
      [
        { type: 'repay', amount: 3_942_439, period: 1 },
        { type: 'repay', amount: 10_000_000, period: null },
      ],
      50_000_000 - 3_942_439 - 10_000_000,
      '2026-11-20',
    );
    expect(plan.next!.period).toBe(2);
    expect(plan.next!.payment).toBeLessThan(4_442_439);
    expect(plan.rows.at(-1)).toMatchObject({ period: 12, balance: 0, date: '2027-10-05' });
  });

  it('trả hết: không còn kỳ nào', () => {
    const plan = installmentPlan(
      terms,
      [{ type: 'repay', amount: 50_000_000, period: null }],
      0,
      '2026-11-01',
    );
    expect(plan.next).toBeNull();
    expect(plan.interestLeft).toBe(0);
  });

  it('đọc lãi theo giai đoạn an toàn', () => {
    expect(parseRateSteps('[{"fromPeriod":7,"annualRate":10.5}]')).toEqual([
      { fromPeriod: 7, annualRate: 10.5 },
    ]);
    expect(parseRateSteps('hỏng')).toEqual([]);
    expect(parseRateSteps(null)).toEqual([]);
  });
});

describe('ghi trả kỳ', () => {
  const setup = () => {
    const db = createTestDb();
    const wallet = saveAccount(db, {
      name: 'VCB',
      color: '#16A34A',
      icon: 'cash-outline',
      includeInBalance: true,
    });
    const debtId = saveDebt(db, {
      personName: 'FE Credit',
      direction: 'borrowed',
      title: 'Vay xe',
      amount: 50_000_000,
      date: vnDateToMs('2026-10-05', '10:00'),
      accountId: wallet,
    });
    saveDebtTerms(db, debtId, {
      annualRate: 12,
      months: 12,
      method: 'annuity',
      startDate: '2026-10-05',
    });
    const balance = () => getAccountBalances(db).find((a) => a.id === wallet)!.balance;
    return { db, wallet, debtId, balance };
  };

  it('kỳ 1: gốc trừ dư nợ, lãi thành khoản chi "Lãi & phí vay", ví trừ đủ cả hai', () => {
    const { db, wallet, debtId, balance } = setup();
    expect(balance()).toBe(50_000_000);
    const item = getDebtItem(db, debtId, '2026-11-01')!;
    expect(item.plan!.next).toMatchObject({ period: 1, principal: 3_942_439, interest: 500_000 });
    expect(item.status).toBe('due-soon');

    payInstallment(db, {
      debtId,
      period: 1,
      principal: 3_942_439,
      interest: 500_000,
      date: vnDateToMs('2026-11-05', '09:00'),
      accountId: wallet,
    });
    expect(balance()).toBe(50_000_000 - 4_442_439);
    const after = getDebtItem(db, debtId, '2026-11-06')!;
    expect(after.remaining).toBe(50_000_000 - 3_942_439);
    expect(after.plan!.next!.period).toBe(2);
    expect(after.records[0]).toMatchObject({ period: 1 });

    const interestTx = db
      .select()
      .from(transactions)
      .all()
      .find((t) => t.categoryId === LOAN_INTEREST_CATEGORY_ID)!;
    expect(interestTx).toMatchObject({ type: 'expense', amount: 500_000, debtId: null });
  });

  it('xoá lần trả kỳ: hoàn ví cả gốc và lãi; xoá khoản nợ dọn sạch', () => {
    const { db, wallet, debtId, balance } = setup();
    const r = payInstallment(db, {
      debtId,
      period: 1,
      principal: 3_942_439,
      interest: 500_000,
      date: vnDateToMs('2026-11-05'),
      accountId: wallet,
    });
    deleteDebtRecord(db, r);
    expect(balance()).toBe(50_000_000);
    payInstallment(db, {
      debtId,
      period: 1,
      principal: 3_942_439,
      interest: 500_000,
      date: vnDateToMs('2026-11-05'),
      accountId: wallet,
    });
    deleteDebt(db, debtId);
    expect(db.select().from(transactions).all()).toHaveLength(0);
    expect(listDebts(db, '2026-11-06')).toHaveLength(0);
  });

  it('kỳ chỉ trả lãi vẫn đánh dấu đã trả', () => {
    const { db, wallet, debtId } = setup();
    saveDebtTerms(db, debtId, {
      annualRate: 12,
      months: 12,
      method: 'interest_only',
      startDate: '2026-10-05',
    });
    payInstallment(db, {
      debtId,
      period: 1,
      principal: 0,
      interest: 500_000,
      date: vnDateToMs('2026-11-05'),
      accountId: wallet,
    });
    const item = getDebtItem(db, debtId, '2026-11-06')!;
    expect(item.plan!.paidCount).toBe(1);
    expect(item.remaining).toBe(50_000_000);
  });

  it('trả tự do trên khoản có kỳ được coi là trả trước', () => {
    const { db, wallet, debtId } = setup();
    addDebtRecord(db, {
      debtId,
      type: 'repay',
      amount: 10_000_000,
      date: vnDateToMs('2026-10-20'),
      accountId: wallet,
    });
    const item = getDebtItem(db, debtId, '2026-10-21')!;
    expect(item.plan!.next!.period).toBe(1);
    expect(item.plan!.next!.payment).toBeLessThan(4_442_439);
  });

  it('bỏ điều khoản thì thành nợ thường', () => {
    const { db, debtId } = setup();
    saveDebtTerms(db, debtId, null);
    expect(getDebtItem(db, debtId, '2026-10-21')!.plan).toBeNull();
  });
});
