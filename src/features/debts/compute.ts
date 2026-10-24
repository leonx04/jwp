// Sổ nợ — hàm thuần: số còn lại, trạng thái hạn, tổng "tôi nợ" / "họ nợ tôi".
// Quy ước (giống Ivy Wallet): còn lại = gốc + vay thêm + lãi − đã trả.
import type { DebtDirection, DebtRecordType } from '@/db/schema';
import { diffDays, toVnDate, type DateString } from '@/lib/date';

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

// ── Lịch sử (sổ phụ) ────────────────────────────────────────────────────────────

type Dated = { id: string; date: number; createdAt: number };

/** Mới nhất trước: theo ngày giao dịch; cùng thời điểm thì lần ghi sau lên trước */
export function newestFirst(a: Dated, b: Dated): number {
  return b.date - a.date || b.createdAt - a.createdAt || b.id.localeCompare(a.id);
}

export type LedgerRecord = Dated & { type: DebtRecordType; amount: number; note: string | null };

export type LedgerEntry<R extends LedgerRecord = LedgerRecord> = {
  key: string;
  kind: 'open' | DebtRecordType;
  amount: number;
  date: number;
  note: string | null;
  /** Còn nợ sau lần này (âm = đã trả dư) */
  balanceAfter: number;
  /** null với dòng khoản gốc */
  record: R | null;
};

/**
 * Sổ phụ của một khoản: dòng khoản gốc + từng lần trả / vay thêm / lãi, kèm dư nợ sau mỗi lần.
 * Trả về mới nhất trước; dư nợ tính theo thứ tự thời gian thật.
 */
export function buildLedger<R extends LedgerRecord>(
  debt: Dated & { amount: number; note: string | null },
  records: readonly R[],
): LedgerEntry<R>[] {
  const chronological = [...records].sort((a, b) => newestFirst(b, a));
  let balance = debt.amount;
  const out: LedgerEntry<R>[] = [
    {
      key: `open:${debt.id}`,
      kind: 'open',
      amount: debt.amount,
      date: debt.date,
      note: debt.note,
      balanceAfter: balance,
      record: null,
    },
  ];
  for (const r of chronological) {
    balance += r.type === 'repay' ? -r.amount : r.amount;
    out.push({
      key: r.id,
      kind: r.type,
      amount: r.amount,
      date: r.date,
      note: r.note,
      balanceAfter: balance,
      record: r,
    });
  }
  return out.reverse();
}

export type MonthGroup<T> = { month: string; items: T[] };

/** Gom các dòng (đã xếp mới nhất trước) theo tháng 'YYYY-MM', giữ nguyên thứ tự */
export function groupByMonth<T extends { date: number }>(entries: readonly T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const e of entries) {
    const month = toVnDate(e.date).slice(0, 7);
    const last = groups.at(-1);
    if (last && last.month === month) last.items.push(e);
    else groups.push({ month, items: [e] });
  }
  return groups;
}

export type RepayTiming = { kind: 'early' | 'on-time' | 'late'; days: number };

/** Lần trả so với hạn của khoản: trả sớm / đúng hạn / trễ bao nhiêu ngày */
export function repayTiming(date: number, dueDate: DateString | null): RepayTiming | null {
  if (!dueDate) return null;
  const days = diffDays(toVnDate(date), dueDate);
  if (days > 0) return { kind: 'early', days };
  if (days < 0) return { kind: 'late', days: -days };
  return { kind: 'on-time', days: 0 };
}

// ── Nhập nhanh ──────────────────────────────────────────────────────────────────

const STEPS = [
  10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000,
  20_000_000, 50_000_000,
];

export type QuickAmount = { amount: number; kind: 'step' | 'half' | 'all' };

/**
 * Chip gợi ý số tiền. Trả nợ: ba mức tròn nhỏ hơn số còn lại, một nửa, và trả hết.
 * Vay thêm: bốn mức tròn quanh cỡ khoản nợ.
 */
export function quickAmounts(remaining: number, type: DebtRecordType): QuickAmount[] {
  if (type === 'repay') {
    if (remaining <= 0) return [];
    const out: QuickAmount[] = STEPS.filter((s) => s < remaining)
      .slice(-3)
      .map((amount) => ({ amount, kind: 'step' }));
    const half = Math.round(remaining / 2 / 1000) * 1000;
    if (half >= 1000 && half < remaining && !out.some((q) => q.amount === half)) {
      out.push({ amount: half, kind: 'half' });
    }
    out.sort((a, b) => a.amount - b.amount);
    out.push({ amount: remaining, kind: 'all' });
    return out;
  }
  const scale = Math.max(remaining, 50_000);
  const start = Math.max(0, STEPS.findIndex((s) => s * 2 >= scale) - 2);
  return STEPS.slice(start, start + 4).map((amount) => ({ amount, kind: 'step' }));
}

// ── Trả theo người ──────────────────────────────────────────────────────────────

export type Allocatable = {
  id: string;
  remaining: number;
  dueDate: DateString | null;
  date: number;
};

/**
 * Chia một lần trả cho nhiều khoản của cùng một người: khoản có hạn gần nhất trước,
 * không hạn thì khoản cũ nhất trước. Trả dư dồn vào khoản cuối cùng được trả.
 */
export function allocateRepayment(
  items: readonly Allocatable[],
  amount: number,
): { id: string; amount: number }[] {
  const order = items
    .filter((i) => i.remaining > 0)
    .sort(
      (a, b) =>
        (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99') || a.date - b.date,
    );
  if (!order.length || amount <= 0) return [];
  const out: { id: string; amount: number }[] = [];
  let left = amount;
  for (const item of order) {
    if (left <= 0) break;
    const take = Math.min(item.remaining, left);
    out.push({ id: item.id, amount: take });
    left -= take;
  }
  if (left > 0) out[out.length - 1].amount += left;
  return out;
}
