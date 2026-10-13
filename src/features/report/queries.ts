// Đọc dữ liệu cho báo cáo tháng: tái dùng truy vấn Thống kê + ngân sách, thêm danh sách khoản chi lớn.
import { sql } from 'drizzle-orm';

import { categories, transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { listBudgets } from '@/features/budgets/queries';
import { getCategoryTotals, getDailyFlows } from '@/features/stats/queries';
import {
  comparablePeriod,
  elapsedDays,
  isInProgress,
  periodRange,
  previousPeriod,
  statsPeriod,
} from '@/features/stats/periods';
import type { DateString, Period } from '@/lib/date';

import type { ReportExpense, ReportInput } from './report';

const BIGGEST_LIMIT = 5;

type Options = { transfersAsIncomeExpense: boolean; startDayOfMonth: number };

/** Các khoản chi lẻ lớn nhất trong kỳ (không tính chuyển khoản, điều chỉnh số dư, sổ nợ, phí con) */
export function getBiggestExpenses(
  db: AppDatabase,
  { from, to }: { from: number; to: number },
  limit = BIGGEST_LIMIT,
): ReportExpense[] {
  return db
    .all<{
      id: string;
      title: string;
      categoryName: string | null;
      amount: number;
      date: number;
    }>(
      sql`
    select t.id, t.title, c.name as categoryName, t.amount, t.date
    from ${transactions} t
    left join ${categories} c on c.id = t.category_id
    where t.type = 'expense' and t.is_adjustment = 0 and t.debt_id is null and t.parent_id is null
      and t.date >= ${from} and t.date < ${to}
    order by t.amount desc, t.date desc
    limit ${limit}
  `,
    )
    .map((r) => ({ ...r, amount: Number(r.amount), date: Number(r.date) }));
}

/** Kỳ (tháng) của báo cáo: `offset` = 0 là tháng hiện tại, −1 là tháng trước… */
export function reportPeriod(offset: number, today: DateString, startDayOfMonth: number): Period {
  return statsPeriod('month', offset, today, startDayOfMonth);
}

/** Số liệu thô cho báo cáo; ghép với `buildMonthlyReport` (cần truyền hàm định dạng tiền) */
export function loadReportInput(
  db: AppDatabase,
  { period, today, ...options }: { period: Period; today: DateString } & Options,
): Omit<ReportInput, 'format'> {
  const { transfersAsIncomeExpense, startDayOfMonth } = options;
  const previous = previousPeriod('month', period, startDayOfMonth);
  const inProgress = isInProgress(period, today);
  // Tháng đang diễn ra: so với đúng đoạn đầu tháng trước dài bằng phần đã qua
  const comparable = inProgress ? comparablePeriod(previous, elapsedDays(period, today)) : previous;
  const flags = { transfersAsIncomeExpense };
  const current = periodRange(period);
  const before = periodRange(comparable);

  return {
    period,
    today,
    daily: getDailyFlows(db, { ...current, ...flags }),
    previousDaily: getDailyFlows(db, { ...before, ...flags }),
    categories: getCategoryTotals(db, { ...current, type: 'expense', ...flags }),
    previousCategories: getCategoryTotals(db, { ...before, type: 'expense', ...flags }),
    biggestExpenses: getBiggestExpenses(db, current),
    // Ngân sách tính theo đúng kỳ báo cáo (tháng đã qua → "hôm nay" là ngày cuối kỳ)
    budgets: listBudgets(db, {
      today: today < period.end ? today : period.end,
      startDayOfMonth,
    }).map((b) => ({ name: b.name, amount: b.amount, spent: b.spent })),
  };
}
