import { saveAccount } from '@/features/accounts/repository';
import { listBudgetRows, saveBudget } from '@/features/budgets/repository';
import { getDebtItem } from '@/features/debts/queries';
import { payInstallment, saveDebt, saveDebtTerms } from '@/features/debts/repository';
import { createTestDb } from '@/test/testDb';

import { collectBackupData, createJwpBackup, serializeJwpBackup } from './export';
import { readJwpBackup } from './read';
import { restoreReplace } from './restore';

describe('sao lưu JWP', () => {
  it('xuất rồi khôi phục giữ nguyên chu kỳ riêng của ngân sách', () => {
    const source = createTestDb();
    saveBudget(source, { name: 'Lương ngày 5', amount: 1_000_000, startDay: 5 });
    saveBudget(source, { name: 'Chung', amount: 500_000 });

    const json = serializeJwpBackup(createJwpBackup(collectBackupData(source, {})));
    const backup = readJwpBackup(new TextEncoder().encode(json));

    const target = createTestDb();
    restoreReplace(target, backup);
    expect(listBudgetRows(target).map((b) => [b.name, b.startDay])).toEqual([
      ['Lương ngày 5', 5],
      ['Chung', null],
    ]);
  });

  it('giữ điều khoản lãi theo kỳ và các kỳ đã trả của khoản nợ', () => {
    const source = createTestDb();
    const wallet = saveAccount(source, {
      name: 'VCB',
      color: '#16A34A',
      icon: 'cash-outline',
      includeInBalance: true,
    });
    const debtId = saveDebt(source, {
      personName: 'FE Credit',
      direction: 'borrowed',
      amount: 50_000_000,
      date: Date.UTC(2026, 9, 5, 3),
      accountId: wallet,
    });
    saveDebtTerms(source, debtId, {
      annualRate: 12,
      months: 12,
      method: 'annuity',
      startDate: '2026-10-05',
    });
    payInstallment(source, {
      debtId,
      period: 1,
      principal: 3_942_439,
      interest: 500_000,
      date: Date.UTC(2026, 10, 5, 3),
      accountId: wallet,
    });

    const json = serializeJwpBackup(createJwpBackup(collectBackupData(source, {})));
    const target = createTestDb();
    restoreReplace(target, readJwpBackup(new TextEncoder().encode(json)));
    const item = getDebtItem(target, debtId, '2026-11-06')!;
    expect(item.terms).toMatchObject({ annualRate: 12, months: 12, method: 'annuity' });
    expect(item.plan!.paidCount).toBe(1);
    expect(item.records[0].interestTransactionId).not.toBeNull();
  });
});
