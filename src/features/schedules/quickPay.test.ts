import { getAccountBalances } from '@/features/accounts/queries';
import { saveAccount } from '@/features/accounts/repository';
import { listTransactions } from '@/features/transactions/queries';
import { createTestDb } from '@/test/testDb';

import { expandOccurrences } from './occurrences';
import { quickPay, undoQuickPay } from './quickPay';
import { listOverrides, listSchedules, saveSchedule } from './repository';

const TODAY = '2026-10-20';
const NOW = Date.parse('2026-10-20T15:30:00+07:00');

const setup = () => {
  const db = createTestDb();
  const bank = saveAccount(db, {
    name: 'TP',
    color: '#000',
    icon: 'bank:TPB',
    includeInBalance: true,
  });
  const credit = saveAccount(db, {
    name: 'SEasy',
    color: '#000',
    icon: 'bank:SHOPEEPAY',
    includeInBalance: false,
    credit: { limit: null, statementDay: 2, dueDay: 1, paymentAccountId: bank },
  });
  const first = (id: string) =>
    expandOccurrences(listSchedules(db), listOverrides(db), {
      from: '2026-10-01',
      to: '2026-12-01',
      today: TODAY,
      includeResolved: true,
    }).find((o) => o.scheduleId === id)!;
  const base = {
    amount: 1_131_003,
    startDate: '2026-11-01' as const,
    frequency: 'once' as const,
    interval: 1,
    endType: 'never' as const,
    autoPost: false,
    active: true,
  };
  return { db, bank, credit, first, base };
};

const balances = (db: ReturnType<typeof createTestDb>) =>
  Object.fromEntries(getAccountBalances(db).map((b) => [b.name, b.balance]));

describe('quickPay', () => {
  it('chuyển khoản theo lịch: ghi luôn, kỳ thành "đã trả", hoàn tác trả lại như cũ', () => {
    const { db, bank, credit, first, base } = setup();
    const id = saveSchedule(db, {
      ...base,
      type: 'transfer',
      accountId: bank,
      toAccountId: credit,
      title: 'Trả SEasy kỳ 3',
    });
    const r = quickPay(db, first(id), TODAY, NOW);
    expect(r.kind).toBe('done');
    expect(listTransactions(db, {})).toHaveLength(1);
    expect(balances(db)).toMatchObject({ TP: -1_131_003, SEasy: 1_131_003 });
    expect(first(id).status).toBe('paid');

    if (r.kind === 'done') undoQuickPay(db, r.ids);
    expect(listTransactions(db, {})).toHaveLength(0);
    expect(first(id).status).not.toBe('paid');
  });

  it('khoản ước tính thì cần mở form nhập số thật', () => {
    const { db, bank, first, base } = setup();
    const id = saveSchedule(db, {
      ...base,
      type: 'expense',
      accountId: bank,
      isEstimate: true,
      title: 'Điện',
    });
    expect(quickPay(db, first(id), TODAY).kind).toBe('needs-form');
    expect(listTransactions(db, {})).toHaveLength(0);
  });

  it('khoản chi từ ví trả sau: ghi chi + trả nợ từ ví thanh toán, dư nợ giữ nguyên', () => {
    const { db, credit, first, base } = setup();
    const id = saveSchedule(db, {
      ...base,
      amount: 500_000,
      type: 'expense',
      accountId: credit,
      title: 'Spaylater tháng 9',
    });
    const r = quickPay(db, first(id), TODAY);
    expect(r.kind === 'done' && r.ids).toHaveLength(2);
    expect(balances(db)).toMatchObject({ TP: -500_000, SEasy: 0 });
    if (r.kind === 'done') undoQuickPay(db, r.ids);
    expect(balances(db)).toMatchObject({ TP: 0, SEasy: 0 });
  });
});
