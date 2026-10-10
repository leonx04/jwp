import { vnDateToMs } from '@/lib/date';

import { groupByDay, summarize } from './grouping';
import type { TransactionListItem } from './queries';

const tx = (
  id: string,
  date: string,
  time: string,
  type: TransactionListItem['type'],
  amount: number,
  extra: Partial<TransactionListItem> = {},
): TransactionListItem => ({
  id,
  type,
  amount,
  date: vnDateToMs(date, time),
  title: id,
  note: null,
  accountId: 'a',
  accountName: 'A',
  accountColor: '#000000',
  toAccountId: type === 'transfer' ? 'b' : null,
  toAccountName: type === 'transfer' ? 'B' : null,
  categoryId: null,
  categoryName: null,
  categoryColor: null,
  categoryIcon: null,
  tagNames: [],
  isAdjustment: false,
  debtId: null,
  scheduleId: null,
  parentId: null,
  ...extra,
});

describe('nhóm theo ngày', () => {
  const items = [
    tx('t1', '2026-10-11', '20:00', 'expense', 50_000),
    tx('t2', '2026-10-11', '08:00', 'income', 200_000),
    tx('t3', '2026-10-11', '00:30', 'transfer', 1_000_000),
    tx('t4', '2026-10-10', '23:30', 'expense', 30_000),
    tx('t5', '2026-10-09', '12:00', 'expense', 10_000, { isAdjustment: true }),
  ];

  it('tiêu đề ngày + vị trí trong nhóm + tổng ngày (không tính chuyển khoản, điều chỉnh)', () => {
    const rows = groupByDay(items);
    expect(rows.map((r) => (r.kind === 'header' ? r.date : `${r.key}:${r.position}`))).toEqual([
      '2026-10-11',
      't1:first',
      't2:middle',
      't3:last',
      '2026-10-10',
      't4:single',
      '2026-10-09',
      't5:single',
    ]);
    expect(rows[0]).toMatchObject({ income: 200_000, expense: 50_000 });
    expect(rows[6]).toMatchObject({ income: 0, expense: 0 });
  });

  it('23:30 giờ VN vẫn thuộc đúng ngày', () => {
    expect(groupByDay([items[3]])[0]).toMatchObject({ date: '2026-10-10' });
  });

  it('tổng hợp', () => {
    expect(summarize(items)).toEqual({ income: 200_000, expense: 80_000, net: 120_000 });
  });

  it('tính chuyển khoản là thu/chi (khớp getPeriodSummary)', () => {
    expect(summarize(items, { transfersAsIncomeExpense: true })).toEqual({
      income: 1_200_000,
      expense: 1_080_000,
      net: 120_000,
    });
    expect(summarize(items, { transfersAsIncomeExpense: true, accountId: 'b' })).toMatchObject({
      income: 1_200_000,
    });
  });
});
