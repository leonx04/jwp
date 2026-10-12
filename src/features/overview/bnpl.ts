// Cảnh báo dùng trả sau quá tay: tổng bill ví trả sau sắp đến hạn so với thu nhập trung bình tháng.
import { isCreditBill } from '@/features/credit/bills';
import type { Occurrence } from '@/features/schedules/occurrences';
import { addDays, type DateString } from '@/lib/date';

/** Bill trả sau trong 30 ngày tới vượt 30% thu nhập trung bình tháng → cảnh báo */
export const BNPL_WARN_RATIO = 0.3;

export type BnplLoad = {
  /** Tổng bill ví trả sau đến hạn trong khoảng (gồm kỳ quá hạn, kỳ sau ước tính) */
  billsTotal: number;
  billCount: number;
  avgMonthlyIncome: number | null;
  /** billsTotal / thu nhập trung bình tháng */
  ratio: number | null;
  warn: boolean;
};

export function bnplLoad({
  occurrences,
  today,
  avgMonthlyIncome,
  days = 30,
  warnRatio = BNPL_WARN_RATIO,
}: {
  occurrences: readonly Occurrence[];
  today: DateString;
  avgMonthlyIncome: number | null;
  days?: number;
  warnRatio?: number;
}): BnplLoad {
  const to = addDays(today, days);
  const bills = occurrences.filter(
    (o) =>
      isCreditBill(o.scheduleId) &&
      o.date <= to &&
      (o.status === 'upcoming' || o.status === 'due' || o.status === 'overdue'),
  );
  const billsTotal = bills.reduce((sum, o) => sum + o.amount, 0);
  const ratio = avgMonthlyIncome && avgMonthlyIncome > 0 ? billsTotal / avgMonthlyIncome : null;
  return {
    billsTotal,
    billCount: bills.length,
    avgMonthlyIncome,
    ratio,
    warn: ratio != null && ratio > warnRatio,
  };
}
