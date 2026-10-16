// Đọc danh sách giao dịch (có lọc, tìm kiếm không dấu) và tổng thu/chi theo kỳ.
import { sql, type SQL } from 'drizzle-orm';

import { accounts, categories, tags, transactionTags, transactions } from '@/db/schema';
import type { TransactionType } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { matchesSearch, parseSearchQuery } from '@/lib/text';

export type TransactionFilter = {
  /** Thời điểm bắt đầu (ms, gồm) */
  from?: number;
  /** Thời điểm kết thúc (ms, không gồm) */
  to?: number;
  accountId?: string;
  /** 'none' = chưa phân loại */
  categoryId?: string;
  tagId?: string;
  types?: TransactionType[];
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
};

export type TransactionListItem = {
  id: string;
  type: TransactionType;
  amount: number;
  date: number;
  title: string;
  note: string | null;
  accountId: string;
  accountName: string;
  accountColor: string;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  tagNames: string[];
  isAdjustment: boolean;
  debtId: string | null;
  scheduleId: string | null;
  parentId: string | null;
};

const SEP = '\u001f';

function buildWhere(filter: TransactionFilter): SQL {
  const parts: SQL[] = [sql`1 = 1`];
  if (filter.from != null) parts.push(sql`t.date >= ${filter.from}`);
  if (filter.to != null) parts.push(sql`t.date < ${filter.to}`);
  if (filter.accountId) {
    parts.push(sql`(t.account_id = ${filter.accountId} or t.to_account_id = ${filter.accountId})`);
  }
  if (filter.categoryId === 'none') parts.push(sql`t.category_id is null and t.type != 'transfer'`);
  else if (filter.categoryId) parts.push(sql`t.category_id = ${filter.categoryId}`);
  if (filter.tagId) {
    parts.push(
      sql`exists (select 1 from ${transactionTags} tt where tt.transaction_id = t.id and tt.tag_id = ${filter.tagId})`,
    );
  }
  if (filter.types?.length) {
    parts.push(
      sql`t.type in (${sql.join(
        filter.types.map((type) => sql`${type}`),
        sql`, `,
      )})`,
    );
  }
  if (filter.minAmount != null) parts.push(sql`t.amount >= ${filter.minAmount}`);
  if (filter.maxAmount != null) parts.push(sql`t.amount <= ${filter.maxAmount}`);
  return sql.join(parts, sql` and `);
}

type Row = Omit<TransactionListItem, 'tagNames' | 'isAdjustment'> & {
  tagNames: string | null;
  isAdjustment: number;
};

export function listTransactions(
  db: AppDatabase,
  filter: TransactionFilter = {},
): TransactionListItem[] {
  const rows = db.all<Row>(sql`
    select t.id, t.type, t.amount, t.date, t.title, t.note,
      t.account_id as accountId, a.name as accountName, a.color as accountColor,
      t.to_account_id as toAccountId, ta.name as toAccountName,
      t.category_id as categoryId, c.name as categoryName, c.color as categoryColor, c.icon as categoryIcon,
      (select group_concat(g.name, ${SEP}) from ${transactionTags} tt join ${tags} g on g.id = tt.tag_id
        where tt.transaction_id = t.id) as tagNames,
      t.is_adjustment as isAdjustment, t.debt_id as debtId, t.schedule_id as scheduleId,
      t.parent_id as parentId
    from ${transactions} t
    join ${accounts} a on a.id = t.account_id
    left join ${accounts} ta on ta.id = t.to_account_id
    left join ${categories} c on c.id = t.category_id
    where ${buildWhere(filter)}
    order by t.date desc, t.created_at desc
    limit ${filter.search?.trim() ? 100000 : (filter.limit ?? 100000)}
  `);
  const items = rows.map((r) => ({
    ...r,
    tagNames: r.tagNames ? r.tagNames.split(SEP) : [],
    isAdjustment: !!r.isAdjustment,
  }));
  // Tìm kiếm tiếng Việt chính xác (có dấu → đúng dấu; không dấu → mọi dấu; khớp đầu từ) — xem lib/text/search
  if (!filter.search?.trim()) return items;
  const query = parseSearchQuery(filter.search);
  return items
    .filter((r) =>
      matchesSearch(query, r.title, r.note, r.categoryName, r.accountName, ...r.tagNames),
    )
    .slice(0, filter.limit ?? 100000);
}

export type PeriodSummary = { income: number; expense: number; count: number };

/**
 * Tổng thu / chi trong khoảng thời gian. Không tính giao dịch điều chỉnh số dư và giao dịch sổ nợ.
 * Chuyển khoản chỉ được tính khi bật "tính chuyển khoản là thu/chi" (giống Ivy).
 */
export function getPeriodSummary(
  db: AppDatabase,
  {
    from,
    to,
    accountId,
    transfersAsIncomeExpense = false,
  }: {
    from: number;
    to: number;
    accountId?: string;
    transfersAsIncomeExpense?: boolean;
  },
): PeriodSummary {
  const acc = accountId ?? null;
  const row = db.get<{ income: number; expense: number; count: number }>(sql`
    select
      coalesce(sum(case
        when t.type = 'income' and (${acc} is null or t.account_id = ${acc}) then t.amount
        when t.type = 'transfer' and ${transfersAsIncomeExpense ? 1 : 0} = 1
          and (${acc} is null or t.to_account_id = ${acc}) then coalesce(t.to_amount, t.amount)
        else 0 end), 0) as income,
      coalesce(sum(case
        when t.type = 'expense' and (${acc} is null or t.account_id = ${acc}) then t.amount
        when t.type = 'transfer' and ${transfersAsIncomeExpense ? 1 : 0} = 1
          and (${acc} is null or t.account_id = ${acc}) then t.amount
        else 0 end), 0) as expense,
      count(*) as count
    from ${transactions} t
    where t.date >= ${from} and t.date < ${to}
      and t.is_adjustment = 0 and t.debt_id is null
      and (${acc} is null or t.account_id = ${acc} or t.to_account_id = ${acc})
  `);
  return row ?? { income: 0, expense: 0, count: 0 };
}
