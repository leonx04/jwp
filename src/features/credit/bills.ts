// Bill ví trả sau → các "kỳ thanh toán" ảo để hiện trong Lịch và tính vào dự báo dòng tiền
// (trả bill = chuyển tiền từ ví thanh toán sang ví trả sau). Hàm thuần, test được.
import type { Occurrence, ScheduleLike } from '@/features/schedules/occurrences';
import { diffDays, type DateString } from '@/lib/date';

import type { CreditStatus } from './statement';

/** scheduleId của kỳ bill ảo: 'credit:<accountId>' — không có bản ghi lịch thật trong DB */
export const CREDIT_BILL_PREFIX = 'credit:';

export const isCreditBill = (scheduleId: string) => scheduleId.startsWith(CREDIT_BILL_PREFIX);
export const creditAccountOfBill = (scheduleId: string) =>
  scheduleId.slice(CREDIT_BILL_PREFIX.length);

export type CreditBillSource = {
  account: { id: string; name: string; paymentAccountId: string | null };
  status: CreditStatus;
};

function billSchedule(
  source: CreditBillSource,
  payer: string,
  amount: number,
  startDate: DateString,
  isEstimate: boolean,
): ScheduleLike {
  return {
    id: `${CREDIT_BILL_PREFIX}${source.account.id}`,
    type: 'transfer',
    amount,
    accountId: payer,
    toAccountId: source.account.id,
    categoryId: null,
    title: `Trả bill ${source.account.name}`,
    startDate,
    frequency: 'once',
    interval: 1,
    weekdays: null,
    monthDay: null,
    weekendRule: 'none',
    endType: 'never',
    endDate: null,
    endCount: null,
    active: true,
    isEstimate,
    autoPost: false,
    remindDaysBefore: 3,
    remindTime: '09:00',
  };
}

/** Lịch thật chuyển tiền vào ví trả sau gần hạn bill → coi là cùng một khoản */
const SAME_BILL_DAYS = 5;

/**
 * Bỏ kỳ bill ảo nếu đã có lịch thật chuyển vào đúng ví trả sau đó (gần cùng ngày), để Lịch không hiện
 * hai dòng cho một khoản phải trả.
 */
export function dropCoveredBills(
  real: readonly Occurrence[],
  bills: readonly Occurrence[],
): Occurrence[] {
  return bills.filter(
    (bill) =>
      !real.some(
        (o) =>
          o.type === 'transfer' &&
          o.status !== 'paid' &&
          o.status !== 'skipped' &&
          o.schedule.toAccountId === bill.schedule.toAccountId &&
          Math.abs(diffDays(o.date, bill.date)) <= SAME_BILL_DAYS,
      ),
  );
}

/**
 * Kỳ bill phải trả: kỳ hiện tại (nếu còn nợ) + kỳ sau (ước tính) trong khoảng [today, to].
 * `fallbackPayer`: ví trả bill khi ví trả sau chưa chọn ví thanh toán.
 */
export function creditBillOccurrences(
  sources: readonly CreditBillSource[],
  { today, to, fallbackPayer }: { today: DateString; to: DateString; fallbackPayer: string | null },
): Occurrence[] {
  const result: Occurrence[] = [];
  for (const source of sources) {
    const payer = source.account.paymentAccountId ?? fallbackPayer;
    if (!payer) continue;
    const { current, next } = source.status;
    const push = (dueDate: DateString, amount: number, isEstimate: boolean) => {
      if (amount <= 0 || dueDate > to) return;
      result.push({
        scheduleId: `${CREDIT_BILL_PREFIX}${source.account.id}`,
        dueDate,
        date: dueDate,
        amount,
        type: 'transfer',
        status: dueDate < today ? 'overdue' : dueDate === today ? 'due' : 'upcoming',
        transactionId: null,
        schedule: billSchedule(source, payer, amount, dueDate, isEstimate),
      });
    };
    if (current) push(current.dueDate, current.dueAmount, false);
    if (next) push(next.dueDate, next.estimatedAmount, true);
  }
  return result;
}
