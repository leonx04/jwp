// Sổ nợ — hàm thuần: số còn lại, trạng thái hạn, tổng "tôi nợ" / "họ nợ tôi".
// Quy ước (giống Ivy Wallet): còn lại = gốc + vay thêm + lãi − đã trả.
import type { DebtDirection, DebtRecordType } from '@/db/schema';
import { diffDays, type DateString } from '@/lib/date';

/** Còn bao nhiêu ngày thì tính là "sắp đến hạn" */
export const DUE_SOON_DAYS = 7;

export type RecordLike = { type: DebtRecordType; amount: number };

export type DebtAmounts = {
  /** Gốc + vay thêm + lãi */
  total: number;
  /** Tổng đã trả */
  repaid: number;
  /** Còn lại (≥ 0) */
  remaining: number;
  /** Trả dư so với tổng nợ (> 0 khi trả quá) */
  overpaid: number;
};

export function amountsOf(principal: number, records: readonly RecordLike[]): DebtAmounts {
  let total = principal;
  let repaid = 0;
  for (const r of records) {
    if (r.type === 'repay') repaid += r.amount;
    else total += r.amount;
  }
  const diff = total - repaid;
  return { total, repaid, remaining: Math.max(0, diff), overpaid: Math.max(0, -diff) };
}

export type DebtStatus = 'closed' | 'settled' | 'overdue' | 'due-soon' | 'open';

export function debtStatus(
  debt: { closedAt: number | null; dueDate: DateString | null },
  remaining: number,
  today: DateString,
): { status: DebtStatus; daysToDue: number | null } {
  const daysToDue = debt.dueDate ? diffDays(today, debt.dueDate) : null;
  if (debt.closedAt != null) return { status: 'closed', daysToDue };
  if (remaining <= 0) return { status: 'settled', daysToDue };
  if (daysToDue != null && daysToDue < 0) return { status: 'overdue', daysToDue };
  if (daysToDue != null && daysToDue <= DUE_SOON_DAYS) return { status: 'due-soon', daysToDue };
  return { status: 'open', daysToDue };
}

export type Summarizable = { direction: DebtDirection; remaining: number; status: DebtStatus };

/** owe: tổng tôi đang nợ người khác · owed: tổng người khác đang nợ tôi (chỉ khoản chưa đóng) */
export function summarize(items: readonly Summarizable[]) {
  let owe = 0;
  let owed = 0;
  let overdue = 0;
  for (const it of items) {
    if (it.status === 'closed' || it.status === 'settled') continue;
    if (it.direction === 'borrowed') owe += it.remaining;
    else owed += it.remaining;
    if (it.status === 'overdue') overdue++;
  }
  return { owe, owed, net: owed - owe, overdue };
}

/** Loại giao dịch ví tương ứng với một lần ghi nợ (null = không động vào ví, vd tiền lãi) */
export function walletFlow(
  direction: DebtDirection,
  kind: 'open' | DebtRecordType,
): 'income' | 'expense' | null {
  if (kind === 'interest') return null;
  const moneyOut = (direction === 'lent') === (kind === 'open' || kind === 'increase');
  return moneyOut ? 'expense' : 'income';
}
