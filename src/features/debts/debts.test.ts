import { getAccountBalances } from '@/features/accounts/queries';
import { saveAccount } from '@/features/accounts/repository';
import { createTestDb } from '@/test/testDb';
import { vnDateToMs } from '@/lib/date';

import { amountsOf, debtStatus, summarize, walletFlow } from './compute';
import { groupByPerson, listDebtProposals, listDebts } from './queries';
import { saveTransaction } from '@/features/transactions/repository';
import {
  adoptProposal,
  addDebtRecord,
  deleteDebt,
  deleteDebtRecord,
  saveDebt,
  setDebtClosed,
} from './repository';

const TODAY = '2026-10-12';
const at = (d: string) => vnDateToMs(d, '12:00');

describe('compute', () => {
  it('còn lại = gốc + vay thêm + lãi − đã trả', () => {
    const a = amountsOf(1_000_000, [
      { type: 'repay', amount: 300_000 },
      { type: 'increase', amount: 200_000 },
      { type: 'interest', amount: 50_000 },
    ]);
    expect(a).toEqual({ total: 1_250_000, repaid: 300_000, remaining: 950_000, overpaid: 0 });
  });

  it('trả dư → còn lại 0 và báo số dư', () => {
    const a = amountsOf(100_000, [{ type: 'repay', amount: 130_000 }]);
    expect(a.remaining).toBe(0);
    expect(a.overpaid).toBe(30_000);
  });

  it('trạng thái theo hạn', () => {
    const open = { closedAt: null };
    expect(debtStatus({ ...open, dueDate: null }, 5, TODAY).status).toBe('open');
    expect(debtStatus({ ...open, dueDate: '2026-10-11' }, 5, TODAY).status).toBe('overdue');
    expect(debtStatus({ ...open, dueDate: '2026-10-19' }, 5, TODAY).status).toBe('due-soon');
    expect(debtStatus({ ...open, dueDate: '2026-10-20' }, 5, TODAY).status).toBe('open');
    expect(debtStatus({ ...open, dueDate: '2026-10-01' }, 0, TODAY).status).toBe('settled');
    expect(debtStatus({ closedAt: 1, dueDate: '2026-10-01' }, 5, TODAY).status).toBe('closed');
  });

  it('tổng tôi nợ / họ nợ tôi bỏ qua khoản đã xong', () => {
    const s = summarize([
      { direction: 'lent', remaining: 300, status: 'open' },
      { direction: 'borrowed', remaining: 100, status: 'overdue' },
      { direction: 'lent', remaining: 0, status: 'settled' },
      { direction: 'borrowed', remaining: 999, status: 'closed' },
    ]);
    expect(s).toEqual({ owe: 100, owed: 300, net: 200, overdue: 1 });
  });

  it('chiều tiền của ví', () => {
    expect(walletFlow('lent', 'open')).toBe('expense');
    expect(walletFlow('lent', 'repay')).toBe('income');
    expect(walletFlow('lent', 'increase')).toBe('expense');
    expect(walletFlow('borrowed', 'open')).toBe('income');
    expect(walletFlow('borrowed', 'repay')).toBe('expense');
    expect(walletFlow('borrowed', 'increase')).toBe('income');
    expect(walletFlow('borrowed', 'interest')).toBeNull();
  });
});

describe('repository', () => {
  const setup = () => {
    const db = createTestDb();
    const wallet = saveAccount(db, {
      name: 'Tiền mặt',
      color: '#16A34A',
      icon: 'cash-outline',
      includeInBalance: true,
    });
    const balance = () => getAccountBalances(db).find((a) => a.id === wallet)!.balance;
    return { db, wallet, balance };
  };

  it('cho vay có chọn ví: trừ tiền ví, trả lại thì cộng lại', () => {
    const { db, wallet, balance } = setup();
    const id = saveDebt(db, {
      personName: 'a Quý',
      direction: 'lent',
      amount: 500_000,
      date: at('2026-10-01'),
      dueDate: '2026-10-30',
      accountId: wallet,
    });
    expect(balance()).toBe(-500_000);

    addDebtRecord(db, {
      debtId: id,
      type: 'repay',
      amount: 200_000,
      date: at('2026-10-05'),
      accountId: wallet,
    });
    expect(balance()).toBe(-300_000);

    const [item] = listDebts(db, TODAY);
    expect(item.remaining).toBe(300_000);
    expect(item.status).toBe('open');
    expect(item.person.name).toBe('a Quý');
  });

  it('vay: tiền vào ví; lãi cộng vào nợ nhưng không đụng ví', () => {
    const { db, wallet, balance } = setup();
    const id = saveDebt(db, {
      personName: 'Phương',
      direction: 'borrowed',
      amount: 2_000_000,
      date: at('2026-07-26'),
      accountId: wallet,
    });
    expect(balance()).toBe(2_000_000);
    addDebtRecord(db, { debtId: id, type: 'interest', amount: 100_000, date: at('2026-09-26') });
    expect(balance()).toBe(2_000_000);
    expect(listDebts(db, TODAY)[0].remaining).toBe(2_100_000);
  });

  it('không chọn ví thì không sinh giao dịch', () => {
    const { db, balance } = setup();
    saveDebt(db, {
      personName: 'Nguyên',
      direction: 'lent',
      amount: 1_000_000,
      date: at('2026-07-17'),
    });
    expect(balance()).toBe(0);
  });

  it('cùng tên (khác hoa thường / dấu) gom về một người', () => {
    const { db } = setup();
    saveDebt(db, { personName: 'a Quý', direction: 'lent', amount: 100, date: at('2026-10-01') });
    saveDebt(db, { personName: 'A QUY', direction: 'lent', amount: 200, date: at('2026-10-02') });
    const groups = groupByPerson(listDebts(db, TODAY));
    expect(groups).toHaveLength(1);
    expect(groups[0].owed).toBe(300);
  });

  it('sửa khoản nợ: đổi số tiền & ví cập nhật giao dịch gốc, bỏ ví thì xoá giao dịch', () => {
    const { db, wallet, balance } = setup();
    const id = saveDebt(db, {
      personName: 'Toàn',
      direction: 'lent',
      amount: 800_000,
      date: at('2026-07-16'),
      accountId: wallet,
    });
    saveDebt(db, {
      id,
      personName: 'Toàn',
      direction: 'lent',
      amount: 600_000,
      date: at('2026-07-16'),
      accountId: wallet,
    });
    expect(balance()).toBe(-600_000);
    saveDebt(db, {
      id,
      personName: 'Toàn',
      direction: 'lent',
      amount: 600_000,
      date: at('2026-07-16'),
    });
    expect(balance()).toBe(0);
  });

  it('xoá một lần trả hoàn lại ví; xoá khoản nợ xoá sạch và dọn người', () => {
    const { db, wallet, balance } = setup();
    const id = saveDebt(db, {
      personName: 'Hiền',
      direction: 'borrowed',
      amount: 178_000,
      date: at('2026-07-17'),
      accountId: wallet,
    });
    const rec = addDebtRecord(db, {
      debtId: id,
      type: 'repay',
      amount: 78_000,
      date: at('2026-07-20'),
      accountId: wallet,
    });
    expect(balance()).toBe(100_000);
    deleteDebtRecord(db, rec);
    expect(balance()).toBe(178_000);

    deleteDebt(db, id);
    expect(balance()).toBe(0);
    expect(listDebts(db, TODAY)).toHaveLength(0);
    expect(groupByPerson(listDebts(db, TODAY))).toHaveLength(0);
  });

  it('đóng / mở lại', () => {
    const { db } = setup();
    const id = saveDebt(db, {
      personName: 'X',
      direction: 'lent',
      amount: 5,
      date: at('2026-10-01'),
    });
    setDebtClosed(db, id, true);
    expect(listDebts(db, TODAY)[0].status).toBe('closed');
    setDebtClosed(db, id, false);
    expect(listDebts(db, TODAY)[0].status).toBe('open');
  });

  it('từ chối số tiền không hợp lệ và tên rỗng', () => {
    const { db } = setup();
    expect(() =>
      saveDebt(db, { personName: 'X', direction: 'lent', amount: 0, date: 1 }),
    ).toThrow();
    expect(() =>
      saveDebt(db, { personName: '  ', direction: 'lent', amount: 5, date: 1 }),
    ).toThrow();
  });
});

describe('adoptProposal', () => {
  it('liên kết giao dịch cũ vào khoản nợ mà không đổi số dư ví', () => {
    const db = createTestDb();
    const wallet = saveAccount(db, {
      name: 'MB',
      color: '#6B4DFF',
      icon: 'bank:MB',
      includeInBalance: true,
    });
    const t = (type: 'income' | 'expense', amount: number, title: string, d: string) =>
      saveTransaction(db, { type, amount, accountId: wallet, title, date: at(d) });
    t('income', 200_000, 'Mượn a Quý', '2026-07-16');
    t('expense', 150_000, 'Nợ a Quý', '2026-07-17');
    const before = getAccountBalances(db).find((a) => a.id === wallet)!.balance;

    const proposals = listDebtProposals(db);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].remaining).toBe(50_000);
    adoptProposal(db, proposals[0]);

    expect(getAccountBalances(db).find((a) => a.id === wallet)!.balance).toBe(before);
    const [item] = listDebts(db, TODAY);
    expect(item.remaining).toBe(50_000);
    expect(item.records).toHaveLength(1);
    expect(listDebtProposals(db)).toHaveLength(0);
  });
});
