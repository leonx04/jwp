// Gợi ý khi nhập giao dịch: tiêu đề, danh mục, ví, tag, số tiền — dựa trên lịch sử trên máy.
import { sql } from 'drizzle-orm';

import { tags, transactionTags, transactions, type TransactionType } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { normalizeForSearch } from '@/lib/text';

import { matchKind, rankCandidates, type CandidateStats } from './rank';

export type TitleSuggestion = CandidateStats & {
  title: string;
  titleKey: string;
  type: TransactionType;
  categoryId: string | null;
  accountId: string;
  lastAmount: number;
  avgAmount: number;
  tagIds: string[];
};

/** Chỉ xét lịch sử 18 tháng gần nhất cho nhanh và sát thói quen hiện tại */
const HISTORY_MS = 548 * 86_400_000;
const VN_OFFSET_S = 7 * 3600;

type Row = {
  title: string;
  titleKey: string;
  type: TransactionType;
  categoryId: string | null;
  accountId: string;
  lastAmount: number;
  lastDate: number;
  count: number;
  avgAmount: number;
  similarCount: number;
  exactCount: number;
  sameTimeCount: number;
  lastId: string;
};

export type SuggestionQuery = {
  type: Exclude<TransactionType, 'transfer'>;
  /** Chữ đang gõ ở ô tiêu đề */
  query?: string;
  /** Số tiền đang nhập (0 = chưa nhập) */
  amount?: number;
  now?: number;
  limit?: number;
};

export function suggestTitles(db: AppDatabase, q: SuggestionQuery): TitleSuggestion[] {
  const now = q.now ?? Date.now();
  const query = q.query ? normalizeForSearch(q.query) : '';
  const amount = q.amount && q.amount > 0 ? q.amount : 0;
  const lo = Math.floor(amount * 0.85);
  const hi = Math.ceil(amount * 1.15);
  const hourNow = Math.floor(((now / 1000 + VN_OFFSET_S) % 86400) / 3600);
  const like = query ? `%${query.replace(/[%_]/g, '')}%` : '%';

  const rows = db.all<Row>(sql`
    with h as (
      select t.*,
        (((t.date / 1000 + ${VN_OFFSET_S}) % 86400) / 3600) as hour,
        row_number() over (partition by t.title_key order by t.date desc) as rn
      from ${transactions} t
      where t.type = ${q.type} and t.title_key != '' and t.is_adjustment = 0
        and t.parent_id is null and t.debt_id is null
        and t.date >= ${now - HISTORY_MS} and t.title_key like ${like}
    )
    select
      max(case when rn = 1 then title end) as title,
      title_key as titleKey,
      max(case when rn = 1 then type end) as type,
      max(case when rn = 1 then category_id end) as categoryId,
      max(case when rn = 1 then account_id end) as accountId,
      max(case when rn = 1 then amount end) as lastAmount,
      max(case when rn = 1 then id end) as lastId,
      max(date) as lastDate,
      count(*) as count,
      cast(round(avg(amount)) as integer) as avgAmount,
      sum(case when ${amount} > 0 and amount between ${lo} and ${hi} then 1 else 0 end) as similarCount,
      sum(case when ${amount} > 0 and amount = ${amount} then 1 else 0 end) as exactCount,
      sum(case when abs(hour - ${hourNow}) <= 2 or abs(hour - ${hourNow}) >= 22 then 1 else 0 end) as sameTimeCount
    from h
    group by title_key
  `);

  let candidates = rows.map((r) => ({ ...r, match: matchKind(r.titleKey, query) }));
  // Đang nhập số tiền mà chưa gõ chữ: chỉ gợi ý các khoản có số tiền tương tự
  if (amount && !query) candidates = candidates.filter((c) => c.similarCount > 0);
  const ranked = rankCandidates(candidates, now).slice(0, q.limit ?? 6);

  // Tag của lần dùng gần nhất
  const lastIds = ranked.map((r) => r.lastId);
  const tagRows = lastIds.length
    ? db.all<{ transactionId: string; tagId: string }>(sql`
        select transaction_id as transactionId, tag_id as tagId from ${transactionTags}
        where transaction_id in (${sql.join(
          lastIds.map((id) => sql`${id}`),
          sql`, `,
        )})`)
    : [];
  return ranked.map(({ lastId, ...r }) => ({
    ...r,
    tagIds: tagRows.filter((t) => t.transactionId === lastId).map((t) => t.tagId),
  }));
}

export type PriceHistory = {
  count: number;
  lastAmount: number;
  lastDate: number;
  avgAmount: number;
  minAmount: number;
  maxAmount: number;
};

/** Lịch sử giá của một tiêu đề: lần trước, trung bình, thấp nhất, cao nhất */
export function priceHistory(
  db: AppDatabase,
  title: string,
  type: TransactionType,
  now: number = Date.now(),
): PriceHistory | null {
  const titleKey = normalizeForSearch(title);
  if (!titleKey) return null;
  const row = db.get<PriceHistory & { count: number }>(sql`
    select count(*) as count,
      (select amount from ${transactions} where title_key = ${titleKey} and type = ${type}
        and parent_id is null order by date desc limit 1) as lastAmount,
      max(date) as lastDate,
      cast(round(avg(amount)) as integer) as avgAmount,
      min(amount) as minAmount, max(amount) as maxAmount
    from ${transactions}
    where title_key = ${titleKey} and type = ${type} and parent_id is null
      and is_adjustment = 0 and date >= ${now - HISTORY_MS}
  `);
  return row && row.count > 0 ? row : null;
}

export type TagSuggestion = { id: string; name: string; color: string | null; uses: number };

/** Tag hay đi cùng danh mục / tiêu đề đang chọn, sau đó là tag dùng gần đây */
export function suggestTags(
  db: AppDatabase,
  {
    categoryId,
    title,
    exclude = [],
  }: { categoryId?: string | null; title?: string; exclude?: string[] },
  limit = 8,
): TagSuggestion[] {
  const titleKey = title ? normalizeForSearch(title) : '';
  const rows = db.all<TagSuggestion & { related: number; lastDate: number }>(sql`
    select g.id, g.name, g.color, count(t.id) as uses,
      sum(case when (${categoryId ?? null} is not null and t.category_id = ${categoryId ?? null})
        or (${titleKey} != '' and t.title_key = ${titleKey}) then 1 else 0 end) as related,
      coalesce(max(t.date), g.created_at) as lastDate
    from ${tags} g
    left join ${transactionTags} tt on tt.tag_id = g.id
    left join ${transactions} t on t.id = tt.transaction_id
    group by g.id
    order by related desc, lastDate desc, uses desc
  `);
  return rows
    .filter((r) => !exclude.includes(r.id))
    .slice(0, limit)
    .map(({ id, name, color, uses }) => ({ id, name, color, uses }));
}

export type TransferPair = { accountId: string; toAccountId: string; count: number };

/** Các cặp ví hay chuyển tiền (vd MB bank → Momo) */
export function frequentTransferPairs(db: AppDatabase, limit = 4): TransferPair[] {
  return db.all<TransferPair>(sql`
    select account_id as accountId, to_account_id as toAccountId, count(*) as count
    from ${transactions}
    where type = 'transfer' and to_account_id is not null
    group by account_id, to_account_id
    order by count desc, max(date) desc
    limit ${limit}
  `);
}
