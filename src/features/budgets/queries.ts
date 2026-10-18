import { sql, type SQL } from 'drizzle-orm';

import { transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { WeekendRule } from '@/lib/recurrence';
import { addDays, periodContaining, vnDateToMs, type DateString } from '@/lib/date';

import { cyclePeriodContaining } from './cycle';
import { budgetProgress, parseIdList, type BudgetProgress } from './compute';
import { listBudgetRows } from './repository';
import { listTransactions, type TransactionListItem } from '@/features/transactions/queries';

export type BudgetItem = BudgetProgress & {
  id: string;
  name: string;
  categoryIds: string[];
  accountIds: string[];
  /** Ngày bắt đầu chu kỳ riêng; null = theo chu kỳ chung */
  startDay: number | null;
  weekendRule: WeekendRule;
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

type BudgetRow = ReturnType<typeof listBudgetRows>[number];

/** Kỳ chứa `date` của một ngân sách (riêng theo ngày bắt đầu, hoặc theo ngày bắt đầu tháng chung) */
function periodOf(b: BudgetRow, date: DateString, startDayOfMonth: number) {
  return b.startDay === null
    ? periodContaining(date, startDayOfMonth)
    : cyclePeriodContaining(date, b.startDay, b.weekendRule);
}

function buildItem(
  db: AppDatabase,
  b: BudgetRow,
  period: { start: DateString; end: DateString },
  today: DateString,
): BudgetItem {
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
    weekendRule: b.weekendRule,
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
}

export function listBudgets(
  db: AppDatabase,
  { today, startDayOfMonth }: { today: DateString; startDayOfMonth: number },
): BudgetItem[] {
  // Mỗi ngân sách có thể có chu kỳ riêng; không đặt thì theo ngày bắt đầu tháng chung
  return listBudgetRows(db).map((b) =>
    buildItem(db, b, periodOf(b, today, startDayOfMonth), today),
  );
}

export type BudgetDetail = {
  item: BudgetItem;
  /** Giao dịch được tính vào ngân sách trong kỳ, mới nhất trước — cộng lại đúng bằng `item.spent` */
  transactions: TransactionListItem[];
  /** Kỳ đang xem là kỳ hiện tại (kỳ trước thì "còn được tiêu mỗi ngày" không có nghĩa) */
  isCurrent: boolean;
  /** Một ngày thuộc kỳ liền trước / liền sau (null nếu kỳ sau chưa bắt đầu) */
  prevAnchor: DateString;
  nextAnchor: DateString | null;
};

/** Chi tiết một ngân sách ở kỳ chứa `anchor` (mặc định hôm nay): tiến độ + các giao dịch đã tính vào */
export function getBudgetDetail(
  db: AppDatabase,
  {
    id,
    today,
    startDayOfMonth,
    anchor = today,
  }: { id: string; today: DateString; startDayOfMonth: number; anchor?: DateString },
): BudgetDetail | null {
  const row = listBudgetRows(db).find((b) => b.id === id);
  if (!row) return null;
  const period = periodOf(row, anchor > today ? today : anchor, startDayOfMonth);
  const isCurrent = today >= period.start && today <= period.end;
  const item = buildItem(db, row, period, isCurrent ? today : period.end);
  const categories = new Set(item.categoryIds);
  const accounts = new Set(item.accountIds);
  // Cùng điều kiện với spentFor: chi thường, không điều chỉnh số dư, không sổ nợ
  const transactions = listTransactions(db, {
    from: vnDateToMs(period.start),
    to: vnDateToMs(addDays(period.end, 1)),
    types: ['expense'],
  }).filter(
    (t) =>
      !t.isAdjustment &&
      t.debtId === null &&
      (categories.size === 0 || (t.categoryId !== null && categories.has(t.categoryId))) &&
      (accounts.size === 0 || accounts.has(t.accountId)),
  );
  const next = addDays(period.end, 1);
  return {
    item,
    transactions,
    isCurrent,
    prevAnchor: addDays(period.start, -1),
    nextAnchor: next > today ? null : next,
  };
}
