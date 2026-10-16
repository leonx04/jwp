import type { AppDatabase } from '@/db/types';
import { getPeriodSummary } from '@/features/transactions/queries';
import {
  addDays,
  shiftPeriod,
  periodContaining,
  toVnDate,
  vnDateToMs,
  type DateString,
} from '@/lib/date';
import { sql } from 'drizzle-orm';

import { transactions } from '@/db/schema';

export type TypicalMonth = { income: number; expense: number; months: number };

/**
 * Một tháng "điển hình": thu và chi trung bình của các kỳ đã trọn vẹn gần nhất (tối đa `months` kỳ).
 * Dùng làm điểm xuất phát cho mô phỏng. Chuyển khoản, điều chỉnh số dư, sổ nợ không tính (như màn Thống kê).
 */
export function getTypicalMonth(
  db: AppDatabase,
  today: DateString,
  startDay = 1,
  months = 3,
): TypicalMonth | null {
  const first = db.get<{ first: number | null }>(
    sql`select min(${transactions.date}) as first from ${transactions}`,
  )?.first;
  if (first == null) return null;
  const firstDay = toVnDate(first);

  let period = periodContaining(today, startDay);
  let income = 0;
  let expense = 0;
  let counted = 0;
  for (let i = 0; i < months; i++) {
    period = shiftPeriod(period, -1, startDay);
    if (period.end < firstDay) break;
    const summary = getPeriodSummary(db, {
      from: vnDateToMs(period.start),
      to: vnDateToMs(addDays(period.end, 1)),
    });
    // Kỳ ghi chép dở dang (bắt đầu dùng app giữa kỳ) bỏ qua nếu chưa có khoản nào
    if (period.start < firstDay && summary.income <= 0 && summary.expense <= 0) continue;
    income += summary.income;
    expense += summary.expense;
    counted++;
  }
  if (!counted) return null;
  return {
    income: Math.round(income / counted),
    expense: Math.round(expense / counted),
    months: counted,
  };
}
