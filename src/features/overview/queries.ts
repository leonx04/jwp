// Số liệu riêng cho màn Tổng quan.
import { sql } from 'drizzle-orm';

import { transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { getPeriodSummary } from '@/features/transactions/queries';
import {
  addDays,
  periodContaining,
  shiftPeriod,
  toVnDate,
  vnDateToMs,
  type DateString,
} from '@/lib/date';

/**
 * Thu nhập trung bình mỗi tháng của `months` kỳ ĐÃ HẾT gần nhất (theo ngày bắt đầu tháng của người
 * dùng). Không tính chuyển khoản, điều chỉnh số dư, sổ nợ. Kỳ trước khi bắt đầu ghi chép (không có
 * khoản thu nào) bị bỏ qua để người mới dùng không bị kéo trung bình xuống. null = chưa đủ dữ liệu.
 */
export function getAverageMonthlyIncome(
  db: AppDatabase,
  today: DateString,
  startDay = 1,
  months = 3,
): number | null {
  const first = db.get<{ first: number | null }>(
    sql`select min(${transactions.date}) as first from ${transactions}`,
  )?.first;
  if (first == null) return null;
  const firstDay = toVnDate(first);

  let period = periodContaining(today, startDay);
  let total = 0;
  let counted = 0;
  for (let i = 0; i < months; i++) {
    period = shiftPeriod(period, -1, startDay);
    if (period.end < firstDay) break;
    const { income } = getPeriodSummary(db, {
      from: vnDateToMs(period.start),
      to: vnDateToMs(addDays(period.end, 1)),
    });
    // Kỳ ghi chép dở dang (bắt đầu dùng app giữa kỳ) chỉ tính khi đã có khoản thu
    if (period.start < firstDay && income <= 0) continue;
    total += income;
    counted++;
  }
  return counted ? Math.round(total / counted) : null;
}
