// Cấu trúc cơ sở dữ liệu SQLite (Drizzle ORM). Đây là "nguồn sự thật" của dữ liệu:
// sửa file này → chạy `npm run db:generate` → drizzle-kit sinh migration SQL trong drizzle/.
//
// Quy ước:
// - Tiền: INTEGER, đơn vị đồng, luôn ≥ 0. Dấu (thu/chi) suy ra từ `type`.
// - Thời điểm giao dịch: INTEGER mili giây UTC. Hiển thị theo giờ Việt Nam.
// - Ngày theo lịch (kỳ định kỳ, hạn trả): TEXT 'YYYY-MM-DD' theo giờ Việt Nam — tránh lệch ngày do múi giờ.
// - id: TEXT (UUID). Dữ liệu import từ Ivy giữ nguyên id gốc → import lại không bị trùng.
// - *_key: chuỗi đã bỏ dấu + chữ thường, dùng cho tìm kiếm / gợi ý không phân biệt dấu.

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Date.now())
    .$onUpdateFn(() => Date.now()),
};

export const TRANSACTION_TYPES = ['expense', 'income', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// ─── Ví ─────────────────────────────────────────────────────────────────────

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(), // '#RRGGBB'
  icon: text('icon'),
  orderNum: real('order_num').notNull().default(0),
  /** false: không cộng vào tổng số dư (vd quỹ tiết kiệm tách riêng) */
  includeInBalance: integer('include_in_balance', { mode: 'boolean' }).notNull().default(true),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

// ─── Danh mục ───────────────────────────────────────────────────────────────

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  icon: text('icon'),
  orderNum: real('order_num').notNull().default(0),
  ...timestamps,
});

// ─── Tag ────────────────────────────────────────────────────────────────────

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** normalizeForSearch(name) — chặn trùng kiểu "Du lịch" / "du lich" */
    nameKey: text('name_key').notNull(),
    color: text('color'),
    ...timestamps,
  },
  (t) => [uniqueIndex('tags_name_key_unique').on(t.nameKey)],
);

// ─── Lịch thu chi (định kỳ / một lần) ───────────────────────────────────────

export const SCHEDULE_FREQUENCIES = ['once', 'daily', 'weekly', 'monthly', 'yearly'] as const;
/** Kỳ rơi vào cuối tuần: giữ nguyên / lùi về thứ Sáu / dời sang thứ Hai */
export const WEEKEND_RULES = ['none', 'before', 'after'] as const;
export const SCHEDULE_END_TYPES = ['never', 'until', 'count'] as const;

export const schedules = sqliteTable(
  'schedules',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
    amount: integer('amount').notNull(),
    /** true: số tiền ước tính (điện, nước) → nhập số thực tế khi xác nhận */
    isEstimate: integer('is_estimate', { mode: 'boolean' }).notNull().default(false),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    toAccountId: text('to_account_id').references(() => accounts.id),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    title: text('title').notNull().default(''),
    note: text('note'),
    startDate: text('start_date').notNull(),
    frequency: text('frequency', { enum: SCHEDULE_FREQUENCIES }).notNull(),
    interval: integer('interval').notNull().default(1),
    /** Lặp theo tuần: '1,3,5' (1 = thứ Hai … 7 = Chủ nhật) */
    weekdays: text('weekdays'),
    /** Lặp theo tháng: 1–31, hoặc -1 = ngày cuối tháng */
    monthDay: integer('month_day'),
    weekendRule: text('weekend_rule', { enum: WEEKEND_RULES }).notNull().default('none'),
    endType: text('end_type', { enum: SCHEDULE_END_TYPES }).notNull().default('never'),
    endDate: text('end_date'),
    endCount: integer('end_count'),
    /** true: đến hạn tự ghi giao dịch (vd lương vào thẳng ví); false: chờ xác nhận */
    autoPost: integer('auto_post', { mode: 'boolean' }).notNull().default(false),
    remindDaysBefore: integer('remind_days_before').notNull().default(1),
    remindTime: text('remind_time').notNull().default('09:00'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check('schedules_amount_non_negative', sql`${t.amount} >= 0`),
    check('schedules_interval_positive', sql`${t.interval} >= 1`),
  ],
);

// ─── Giao dịch ──────────────────────────────────────────────────────────────

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
    amount: integer('amount').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    /** Chỉ có khi type = 'transfer': ví nhận */
    toAccountId: text('to_account_id').references(() => accounts.id),
    /** Số tiền ví nhận được (= amount với cùng loại tiền; giữ để tương thích Ivy) */
    toAmount: integer('to_amount'),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    title: text('title').notNull().default(''),
    titleKey: text('title_key').notNull().default(''),
    note: text('note'),
    date: integer('date').notNull(),
    /** Giao dịch sinh ra khi thanh toán một kỳ của lịch */
    scheduleId: text('schedule_id').references(() => schedules.id, { onDelete: 'set null' }),
    scheduleDueDate: text('schedule_due_date'),
    /** Giao dịch con, vd phí chuyển khoản gắn với lần chuyển — xoá cha thì xoá con */
    parentId: text('parent_id').references((): AnySQLiteColumn => transactions.id, {
      onDelete: 'cascade',
    }),
    /** Giao dịch điều chỉnh số dư: tính vào số dư nhưng không tính vào thống kê thu/chi */
    isAdjustment: integer('is_adjustment', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('transactions_date_idx').on(t.date),
    index('transactions_account_idx').on(t.accountId),
    index('transactions_to_account_idx').on(t.toAccountId),
    index('transactions_category_idx').on(t.categoryId),
    index('transactions_title_key_idx').on(t.titleKey),
    index('transactions_type_amount_idx').on(t.type, t.amount),
    index('transactions_schedule_idx').on(t.scheduleId),
    check('transactions_amount_non_negative', sql`${t.amount} >= 0`),
    // Chuyển khoản bắt buộc có ví nhận; thu/chi thì không được có
    check(
      'transactions_transfer_target',
      sql`(${t.type} = 'transfer') = (${t.toAccountId} IS NOT NULL)`,
    ),
  ],
);

export const transactionTags = sqliteTable(
  'transaction_tags',
  {
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.transactionId, t.tagId] }),
    index('transaction_tags_tag_idx').on(t.tagId),
  ],
);

// ─── Kỳ của lịch đã xử lý / ghi đè ─────────────────────────────────────────
// Kỳ tương lai KHÔNG lưu sẵn, được tính từ quy tắc. Chỉ lưu kỳ đã thanh toán / bỏ qua / dời ngày.

export const OCCURRENCE_STATUSES = ['paid', 'skipped', 'rescheduled'] as const;

export const scheduleOccurrences = sqliteTable(
  'schedule_occurrences',
  {
    scheduleId: text('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    /** Ngày gốc của kỳ theo quy tắc */
    dueDate: text('due_date').notNull(),
    status: text('status', { enum: OCCURRENCE_STATUSES }).notNull(),
    /** Ngày mới khi dời kỳ */
    newDate: text('new_date'),
    /** Số tiền thực tế nếu khác quy tắc */
    amount: integer('amount'),
    transactionId: text('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [primaryKey({ columns: [t.scheduleId, t.dueDate] })],
);

// ─── Kiểu dữ liệu suy ra từ bảng ────────────────────────────────────────────

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type ScheduleOccurrence = typeof scheduleOccurrences.$inferSelect;
