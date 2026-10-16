import { sql, type SQL } from 'drizzle-orm';

import { transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { addDays, periodContaining, vnDateToMs, type DateString } from '@/lib/date';

import { budgetProgress, parseIdList, type BudgetProgress } from './compute';
import { listBudgetRows } from './repository';

export type BudgetItem = BudgetProgress & {
  id: string;
  name: string;
  categoryIds: string[];
  accountIds: string[];
  /** Ngày bắt đầu chu kỳ riêng; null = theo chu kỳ chung */
  startDay: number | null;
  periodStart: DateString;
  periodEnd: DateString;
};

const inList = (column: SQL, ids: string[]): SQL =>
  sql`${column} in (${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )})`;

/** Tổng chi của một ngân sách trong [from, to): loại điều chỉnh số dư, sổ nợ; chuyển khoản không tính */
export function spentFor(
  db: AppDatabase,
  {
    from,
    to,
    categoryIds,
    accountIds,
  }: { from: number; to: number; categoryIds: string[]; accountIds: string[] },
): number {
  const row = db.get<{ total: number | null }>(sql`
    select coalesce(sum(t.amount), 0) as total
    from ${transactions} t
    where t.type = 'expense' and t.is_adjustment = 0 and t.debt_id is null
      and t.date >= ${from} and t.date < ${to}
      ${categoryIds.length ? sql`and ${inList(sql`t.category_id`, categoryIds)}` : sql``}
      ${accountIds.length ? sql`and ${inList(sql`t.account_id`, accountIds)}` : sql``}
  `);
  return Number(row?.total ?? 0);
}

export function listBudgets(
  db: AppDatabase,
  { today, startDayOfMonth }: { today: DateString; startDayOfMonth: number },
): BudgetItem[] {
  return listBudgetRows(db).map((b) => {
    // Mỗi ngân sách có thể có chu kỳ riêng; không đặt thì theo ngày bắt đầu tháng chung
    const period = periodContaining(today, b.startDay ?? startDayOfMonth);
    const from = vnDateToMs(period.start);
    const to = vnDateToMs(addDays(period.end, 1));
    const categoryIds = parseIdList(b.categoryIds);
    const accountIds = parseIdList(b.accountIds);
    const spent = spentFor(db, { from, to, categoryIds, accountIds });
    return {
      id: b.id,
      name: b.name,
      categoryIds,
      accountIds,
      startDay: b.startDay,
      periodStart: period.start,
      periodEnd: period.end,
      ...budgetProgress({
        amount: b.amount,
        spent,
        today,
        periodStart: period.start,
        periodEnd: period.end,
      }),
    };
  });
}
