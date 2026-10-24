// Truy vấn tổng hợp cho màn Thống kê — SQL GROUP BY trên SQLite (dùng chỉ mục theo ngày).
// Quy tắc giống getPeriodSummary: bỏ giao dịch điều chỉnh số dư và giao dịch sổ nợ;
// chuyển khoản chỉ tính khi bật "tính chuyển khoản là thu/chi" (gom vào nhóm "Chuyển khoản").
import { sql, type SQL } from 'drizzle-orm';

import { categories, transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { VN_OFFSET_MS, type Period } from '@/lib/date';
import { NEUTRAL_MARK } from '@/theme/swatches';

import {
  TRANSFER_KEY,
  UNCATEGORIZED_KEY,
  bucketByPeriods,
  type CategoryTotal,
  type DailyFlow,
  type FlowType,
  type PeriodFlow,
} from './analysis';
import { periodRange } from './periods';

export type StatsOptions = {
  /** Tính chuyển khoản như thu/chi (cài đặt giống Ivy) */
  transfersAsIncomeExpense?: boolean;
};

const UNCATEGORIZED_NAME = 'Chưa phân loại';
const UNCATEGORIZED_COLOR = NEUTRAL_MARK;
const TRANSFER_NAME = 'Chuyển khoản';
const TRANSFER_COLOR = '#64748B';

/** Điều kiện chung: trong khoảng thời gian, bỏ điều chỉnh số dư & sổ nợ, chuyển khoản tuỳ cài đặt */
function baseWhere(from: number, to: number, transfers: boolean): SQL {
  return sql`t.date >= ${from} and t.date < ${to}
    and t.is_adjustment = 0 and t.debt_id is null
    and (t.type != 'transfer' or ${transfers ? 1 : 0} = 1)`;
}

/** Lọc theo khoá nhóm danh mục ('none' = chưa phân loại, '__transfer' = chuyển khoản) */
function categoryWhere(key: string | undefined): SQL {
  if (!key) return sql`1 = 1`;
  if (key === TRANSFER_KEY) return sql`t.type = 'transfer'`;
  if (key === UNCATEGORIZED_KEY) return sql`t.type != 'transfer' and t.category_id is null`;
  return sql`t.type != 'transfer' and t.category_id = ${key}`;
}

type CategoryRow = {
  groupKey: string;
  categoryId: string | null;
  name: string | null;
  color: string | null;
  icon: string | null;
  amount: number;
  count: number;
};

/** Tổng chi (hoặc thu) theo danh mục trong [from, to), sắp xếp số tiền giảm dần */
export function getCategoryTotals(
  db: AppDatabase,
  {
    from,
    to,
    type,
    transfersAsIncomeExpense = false,
  }: { from: number; to: number; type: FlowType } & StatsOptions,
): CategoryTotal[] {
  // Chuyển khoản tính vào cả thu (số tiền ví nhận) lẫn chi (số tiền ví gửi) khi xem mọi ví
  const amount =
    type === 'income'
      ? sql`case when t.type = 'transfer' then coalesce(t.to_amount, t.amount) else t.amount end`
      : sql`t.amount`;
  const rows = db.all<CategoryRow>(sql`
    select
      case when t.type = 'transfer' then ${TRANSFER_KEY}
        else coalesce(t.category_id, ${UNCATEGORIZED_KEY}) end as groupKey,
      case when t.type = 'transfer' then null else t.category_id end as categoryId,
      c.name as name, c.color as color, c.icon as icon,
      coalesce(sum(${amount}), 0) as amount,
      count(*) as count
    from ${transactions} t
    left join ${categories} c on c.id = t.category_id and t.type != 'transfer'
    where ${baseWhere(from, to, transfersAsIncomeExpense)}
      and (t.type = ${type} or t.type = 'transfer')
    group by groupKey
    order by amount desc
  `);
  return rows.map((r) => ({
    key: r.groupKey,
    categoryId: r.categoryId,
    name:
      r.groupKey === TRANSFER_KEY
        ? TRANSFER_NAME
        : r.groupKey === UNCATEGORIZED_KEY
          ? UNCATEGORIZED_NAME
          : (r.name ?? UNCATEGORIZED_NAME),
    color:
      r.groupKey === TRANSFER_KEY
        ? TRANSFER_COLOR
        : r.groupKey === UNCATEGORIZED_KEY
          ? UNCATEGORIZED_COLOR
          : (r.color ?? UNCATEGORIZED_COLOR),
    icon: r.groupKey === TRANSFER_KEY ? 'swap-horizontal-outline' : r.icon,
    amount: Number(r.amount),
    count: Number(r.count),
  }));
}

export type TagTotal = {
  tagId: string;
  name: string;
  color: string | null;
  amount: number;
  count: number;
};

/**
 * Tổng chi (hoặc thu) theo TAG trong [from, to), số tiền giảm dần. Chỉ khoản chi / thu thật (bỏ chuyển khoản,
 * điều chỉnh số dư, sổ nợ). Giao dịch gắn nhiều tag được tính vào từng tag nên các tag có thể cộng lại hơn tổng.
 */
export function getTagTotals(
  db: AppDatabase,
  { from, to, type }: { from: number; to: number; type: FlowType },
): TagTotal[] {
  const rows = db.all<{
    tagId: string;
    name: string;
    color: string | null;
    amount: number;
    count: number;
  }>(sql`
    select g.id as tagId, g.name as name, g.color as color,
      coalesce(sum(t.amount), 0) as amount, count(*) as count
    from ${transactions} t
    join transaction_tags tt on tt.transaction_id = t.id
    join tags g on g.id = tt.tag_id
    where ${baseWhere(from, to, false)} and t.type = ${type}
    group by g.id
    order by amount desc
  `);
  return rows.map((r) => ({
    tagId: r.tagId,
    name: r.name,
    color: r.color,
    amount: Number(r.amount),
    count: Number(r.count),
  }));
}

/**
 * Tổng thu / chi theo từng ngày (giờ VN) trong [from, to). Chỉ trả về ngày có giao dịch.
 * `categoryKey`: chỉ tính một nhóm danh mục (màn chi tiết danh mục).
 */
export function getDailyFlows(
  db: AppDatabase,
  {
    from,
    to,
    categoryKey,
    transfersAsIncomeExpense = false,
  }: { from: number; to: number; categoryKey?: string } & StatsOptions,
): DailyFlow[] {
  const rows = db.all<{ date: string; income: number; expense: number; count: number }>(sql`
    select
      date((t.date + ${VN_OFFSET_MS}) / 1000, 'unixepoch') as date,
      coalesce(sum(case
        when t.type = 'income' then t.amount
        when t.type = 'transfer' then coalesce(t.to_amount, t.amount)
        else 0 end), 0) as income,
      coalesce(sum(case
        when t.type = 'expense' then t.amount
        when t.type = 'transfer' then t.amount
        else 0 end), 0) as expense,
      count(*) as count
    from ${transactions} t
    where ${baseWhere(from, to, transfersAsIncomeExpense)}
      and ${categoryWhere(categoryKey)}
    group by 1
    order by 1
  `);
  return rows.map((r) => ({
    date: r.date,
    income: Number(r.income),
    expense: Number(r.expense),
    count: Number(r.count),
  }));
}

/** Tổng thu / chi theo từng kỳ (tháng) — một truy vấn theo ngày rồi gom (hỗ trợ ngày bắt đầu tháng tuỳ chỉnh) */
export function getPeriodFlows(
  db: AppDatabase,
  periods: readonly Period[],
  options: StatsOptions & { categoryKey?: string } = {},
): PeriodFlow[] {
  if (!periods.length) return [];
  const span: Period = { start: periods[0].start, end: periods[periods.length - 1].end };
  return bucketByPeriods(getDailyFlows(db, { ...periodRange(span), ...options }), periods);
}

export type CategoryInfo = { key: string; name: string; color: string; icon: string | null };

/** Tên / màu / icon của một nhóm danh mục (kể cả 'none' và '__transfer') */
export function getCategoryInfo(db: AppDatabase, key: string): CategoryInfo | null {
  if (key === TRANSFER_KEY)
    return { key, name: TRANSFER_NAME, color: TRANSFER_COLOR, icon: 'swap-horizontal-outline' };
  if (key === UNCATEGORIZED_KEY)
    return { key, name: UNCATEGORIZED_NAME, color: UNCATEGORIZED_COLOR, icon: null };
  const row = db.get<{ name: string; color: string; icon: string | null }>(
    sql`select name, color, icon from ${categories} where id = ${key}`,
  );
  return row ? { key, ...row } : null;
}

// ─── Gói dữ liệu cho màn Thống kê (một lần đọc, nhiều truy vấn nhỏ) ───────────

export type StatsRequest = StatsOptions & {
  type: FlowType;
  /** Kỳ đang xem */
  current: Period;
  /** Kỳ trước, cắt bằng phần đã qua của kỳ này (so sánh cùng kỳ) */
  comparable: Period;
  /** Các kỳ tham chiếu để tìm danh mục tăng bất thường (null = không tính) */
  baseline: Period | null;
  /** Khoảng lấy số liệu theo ngày (xu hướng nhiều tháng + kỳ trước) */
  dailyRange: Period;
};

export type StatsData = {
  categories: CategoryTotal[];
  previousCategories: CategoryTotal[];
  baselineCategories: CategoryTotal[];
  daily: DailyFlow[];
};

export function loadStats(db: AppDatabase, request: StatsRequest): StatsData {
  const { type, transfersAsIncomeExpense } = request;
  const totals = (period: Period) =>
    getCategoryTotals(db, { ...periodRange(period), type, transfersAsIncomeExpense });
  return {
    categories: totals(request.current),
    previousCategories:
      request.comparable.end >= request.comparable.start ? totals(request.comparable) : [],
    baselineCategories: request.baseline ? totals(request.baseline) : [],
    daily: getDailyFlows(db, { ...periodRange(request.dailyRange), transfersAsIncomeExpense }),
  };
}
