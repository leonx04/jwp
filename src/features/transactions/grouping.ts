// Nhóm danh sách giao dịch theo ngày (giờ VN) để hiển thị: tiêu đề ngày + tổng thu/chi của ngày.
import { toVnDate, type DateString } from '@/lib/date';

import type { TransactionListItem } from './queries';

export type DayHeader = {
  kind: 'header';
  key: string;
  date: DateString;
  income: number;
  expense: number;
};

/** Vị trí trong nhóm để bo góc khối kính: đầu / giữa / cuối / một mình */
export type RowPosition = 'single' | 'first' | 'middle' | 'last';

export type TransactionEntry = {
  kind: 'tx';
  key: string;
  item: TransactionListItem;
  position: RowPosition;
};

export type GroupedRow = DayHeader | TransactionEntry;

/** Danh sách phải đang sắp xếp mới → cũ */
export function groupByDay(items: readonly TransactionListItem[]): GroupedRow[] {
  const rows: GroupedRow[] = [];
  let header: DayHeader | null = null;
  let group: TransactionEntry[] = [];

  const closeGroup = () => {
    group.forEach((entry, index) => {
      entry.position =
        group.length === 1
          ? 'single'
          : index === 0
            ? 'first'
            : index === group.length - 1
              ? 'last'
              : 'middle';
    });
    group = [];
  };

  for (const item of items) {
    const date = toVnDate(item.date);
    if (!header || header.date !== date) {
      closeGroup();
      header = { kind: 'header', key: `h-${date}`, date, income: 0, expense: 0 };
      rows.push(header);
    }
    if (!item.isAdjustment && !item.debtId) {
      if (item.type === 'income') header.income += item.amount;
      if (item.type === 'expense') header.expense += item.amount;
    }
    const entry: TransactionEntry = { kind: 'tx', key: item.id, item, position: 'single' };
    group.push(entry);
    rows.push(entry);
  }
  closeGroup();
  return rows;
}

/**
 * Tổng thu / chi của một danh sách (bỏ điều chỉnh số dư, sổ nợ).
 * Chuyển khoản chỉ tính khi bật "tính chuyển khoản là thu/chi" — cùng quy tắc với getPeriodSummary:
 * chuyển ra khỏi ví = chi, chuyển vào ví = thu (xem mọi ví thì tính cả hai).
 */
export function summarize(
  items: readonly TransactionListItem[],
  {
    transfersAsIncomeExpense = false,
    accountId,
  }: { transfersAsIncomeExpense?: boolean; accountId?: string } = {},
) {
  let income = 0;
  let expense = 0;
  for (const item of items) {
    if (item.isAdjustment || item.debtId) continue;
    if (item.type === 'income') income += item.amount;
    if (item.type === 'expense') expense += item.amount;
    if (item.type === 'transfer' && transfersAsIncomeExpense) {
      if (!accountId || item.accountId === accountId) expense += item.amount;
      if (!accountId || item.toAccountId === accountId) income += item.amount;
    }
  }
  return { income, expense, net: income - expense };
}
