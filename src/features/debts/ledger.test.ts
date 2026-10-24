import { getAccountBalances } from '@/features/accounts/queries';
import { saveAccount } from '@/features/accounts/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import {
  allocateRepayment,
  buildLedger,
  groupByMonth,
  newestFirst,
  quickAmounts,
  repayTiming,
  type LedgerRecord,
} from './compute';
import { listDebts } from './queries';
import { addDebtRecord, repayMany, saveDebt, updateDebtRecord } from './repository';

const TODAY = '2026-10-24';
const at = (d: string, time = '12:00') => vnDateToMs(d, time);
const rec = (
  id: string,
  type: LedgerRecord['type'],
  amount: number,
  date: number,
  createdAt = date,
): LedgerRecord => ({ id, type, amount, date, createdAt, note: null });

describe('sổ phụ', () => {
  const debt = { id: 'd', amount: 110_000, date: at('2026-10-01'), createdAt: 0, note: null };

  it('nợ 110k, trả 20k, vay thêm 50k: dư nợ sau từng lần, mới nhất trước', () => {
    const ledger = buildLedger(debt, [
      rec('b', 'increase', 50_000, at('2026-10-09')),
      rec('a', 'repay', 20_000, at('2026-10-02')),
    ]);
    expect(ledger.map((e) => [e.kind, e.amount, e.balanceAfter])).toEqual([
      ['increase', 50_000, 140_000],
      ['repay', 20_000, 90_000],
      ['open', 110_000, 110_000],
    ]);
  });

  it('cùng ngày thì lần ghi sau lên trước, và dư nợ theo đúng thứ tự ghi', () => {
    const day = at('2026-10-05');
    const ledger = buildLedger(debt, [
      rec('x', 'repay', 10_000, day, 1),
      rec('y', 'repay', 30_000, day, 2),
    ]);
    expect(ledger.map((e) => [e.key, e.balanceAfter])).toEqual([
      ['y', 70_000],
      ['x', 100_000],
      ['open:d', 110_000],
    ]);
  });

  it('trả dư thì dư nợ âm', () => {
    const [last] = buildLedger(debt, [rec('a', 'repay', 120_000, at('2026-10-02'))]);
    expect(last.balanceAfter).toBe(-10_000);
  });

  it('newestFirst ưu tiên ngày giao dịch hơn thời điểm ghi', () => {
    const paidYesterday = rec('a', 'repay', 1, at('2026-10-23'), at('2026-10-24', '20:00'));
    const paidToday = rec('b', 'repay', 1, at('2026-10-24'), at('2026-10-24', '09:00'));
    expect([paidYesterday, paidToday].sort(newestFirst).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('gom theo tháng, giữ thứ tự', () => {
    const groups = groupByMonth([
      { date: at('2026-11-02') },
      { date: at('2026-10-30') },
      { date: at('2026-10-01') },
    ]);
    expect(groups.map((g) => [g.month, g.items.length])).toEqual([
      ['2026-11', 1],
      ['2026-10', 2],
    ]);
  });

  it('trả sớm / đúng hạn / trễ', () => {
    expect(repayTiming(at('2026-10-27'), '2026-10-30')).toEqual({ kind: 'early', days: 3 });
    expect(repayTiming(at('2026-10-30', '23:00'), '2026-10-30')).toEqual({
      kind: 'on-time',
      days: 0,
    });
    expect(repayTiming(at('2026-11-01'), '2026-10-30')).toEqual({ kind: 'late', days: 2 });
    expect(repayTiming(at('2026-11-01'), null)).toBeNull();
  });
});

describe('nhập nhanh', () => {
  it('trả nợ 110k: các mức tròn, một nửa, trả hết', () => {
    expect(quickAmounts(110_000, 'repay')).toEqual([
      { amount: 20_000, kind: 'step' },
      { amount: 50_000, kind: 'step' },
      { amount: 55_000, kind: 'half' },
      { amount: 100_000, kind: 'step' },
      { amount: 110_000, kind: 'all' },
    ]);
  });

  it('không gợi ý gì khi đã trả hết', () => {
    expect(quickAmounts(0, 'repay')).toEqual([]);
  });

  it('vay thêm: bốn mức quanh cỡ khoản nợ', () => {
    expect(quickAmounts(110_000, 'increase').map((q) => q.amount)).toEqual([
      20_000, 50_000, 100_000, 200_000,
    ]);
    expect(quickAmounts(0, 'increase').map((q) => q.amount)).toEqual([
      10_000, 20_000, 50_000, 100_000,
    ]);
  });
});

describe('trả theo người', () => {
  const items = [
    { id: 'old', remaining: 50_000, dueDate: null, date: 1 },
    { id: 'due', remaining: 30_000, dueDate: '2026-10-28', date: 5 },
    { id: 'done', remaining: 0, dueDate: '2026-10-01', date: 0 },
  ];

  it('khoản có hạn gần nhất trước, rồi khoản cũ nhất', () => {
    expect(allocateRepayment(items, 40_000)).toEqual([
      { id: 'due', amount: 30_000 },
      { id: 'old', amount: 10_000 },
    ]);
  });

  it('trả dư dồn vào khoản cuối', () => {
    expect(allocateRepayment(items, 100_000)).toEqual([
      { id: 'due', amount: 30_000 },
      { id: 'old', amount: 70_000 },
    ]);
  });
});

describe('ghi sổ', () => {
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

  it('sửa lần trả: đổi số tiền cập nhật cả ví, bỏ ví thì xoá giao dịch ví', () => {
    const { db, wallet, balance } = setup();
    const id = saveDebt(db, {
      personName: 'An',
      direction: 'borrowed',
      amount: 110_000,
      date: at('2026-10-01'),
    });
    const r = addDebtRecord(db, {
      debtId: id,
      type: 'repay',
      amount: 200_000,
      date: at('2026-10-02'),
      accountId: wallet,
    });
    expect(balance()).toBe(-200_000);

    updateDebtRecord(db, r, { amount: 20_000, date: at('2026-10-03'), accountId: wallet });
    expect(balance()).toBe(-20_000);
    let [item] = listDebts(db, TODAY);
    expect(item.remaining).toBe(90_000);
    expect(item.records[0].date).toBe(at('2026-10-03'));

    updateDebtRecord(db, r, { amount: 20_000, date: at('2026-10-03'), accountId: null });
    expect(balance()).toBe(0);
    [item] = listDebts(db, TODAY);
    expect(item.records[0].transactionId).toBeNull();
  });

  it('trả theo người ghi một bản trả cho mỗi khoản', () => {
    const { db, wallet, balance } = setup();
    const a = saveDebt(db, { personName: 'An', direction: 'borrowed', amount: 50_000, date: 1 });
    const b = saveDebt(db, { personName: 'An', direction: 'borrowed', amount: 30_000, date: 2 });
    const ids = repayMany(
      db,
      [
        { debtId: b, amount: 30_000 },
        { debtId: a, amount: 10_000 },
      ],
      { date: at('2026-10-20'), accountId: wallet },
    );
    expect(ids).toHaveLength(2);
    expect(balance()).toBe(-40_000);
    const left = Object.fromEntries(listDebts(db, TODAY).map((d) => [d.debt.id, d.remaining]));
    expect(left).toEqual({ [a]: 40_000, [b]: 0 });
  });
});
