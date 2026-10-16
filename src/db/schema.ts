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
  /** Ví trả sau / thẻ tín dụng (SPayLater, MoMo trả sau, thẻ tín dụng): số dư âm = dư nợ */
  isCredit: integer('is_credit', { mode: 'boolean' }).notNull().default(false),
  /** Hạn mức (đồng) */
  creditLimit: integer('credit_limit'),
  /** Ngày chốt sao kê trong tháng (1–31) */
  statementDay: integer('statement_day'),
  /** Ngày đến hạn thanh toán trong tháng (1–31) */
  dueDay: integer('due_day'),
  /** Ví thường dùng để trả bill */
  paymentAccountId: text('payment_account_id'),
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
export const SCHEDULE_KINDS = ['normal', 'installment', 'credit_bill'] as const;

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
    /** normal · installment: trả góp (sinh từ một lần mua) · credit_bill: bill ví trả sau */
    kind: text('kind', { enum: SCHEDULE_KINDS }).notNull().default('normal'),
    /** Giao dịch gốc (vd lần mua trả góp) */
    linkTransactionId: text('link_transaction_id'),
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
    /** Giao dịch tiền ra/vào ví do cho vay / đi vay / trả nợ: tính vào số dư, không tính vào thống kê */
    debtId: text('debt_id').references((): AnySQLiteColumn => debts.id, { onDelete: 'set null' }),
    /** Mã giao dịch bên ngoài (vd mã GD trên biên lai ngân hàng) — chống nhập trùng */
    externalRef: text('external_ref'),
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
    index('transactions_external_ref_idx').on(t.externalRef),
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

// ─── Sổ nợ ──────────────────────────────────────────────────────────────────

export const people = sqliteTable('people', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull().default(''),
  phone: text('phone'),
  note: text('note'),
  ...timestamps,
});

/** lent: tôi cho vay (họ nợ tôi) · borrowed: tôi đi vay (tôi nợ họ) */
export const DEBT_DIRECTIONS = ['lent', 'borrowed'] as const;
export type DebtDirection = (typeof DEBT_DIRECTIONS)[number];

export const debts = sqliteTable(
  'debts',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    direction: text('direction', { enum: DEBT_DIRECTIONS }).notNull(),
    /** Số tiền gốc ban đầu */
    amount: integer('amount').notNull(),
    title: text('title').notNull().default(''),
    date: integer('date').notNull(),
    dueDate: text('due_date'),
    note: text('note'),
    /** Ví liên kết: tiền cho vay đi ra / tiền vay về vào ví này. Trống = không động vào ví */
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    /** Giao dịch ví tạo ra lúc ghi khoản nợ */
    transactionId: text('transaction_id').references((): AnySQLiteColumn => transactions.id, {
      onDelete: 'set null',
    }),
    closedAt: integer('closed_at'),
    ...timestamps,
  },
  (t) => [
    index('debts_person_idx').on(t.personId),
    check('debts_amount_non_negative', sql`${t.amount} >= 0`),
  ],
);

/** repay: trả bớt · increase: vay thêm / cho vay thêm · interest: tiền lãi (cộng vào nợ) */
export const DEBT_RECORD_TYPES = ['repay', 'increase', 'interest'] as const;
export type DebtRecordType = (typeof DEBT_RECORD_TYPES)[number];

export const debtRecords = sqliteTable(
  'debt_records',
  {
    id: text('id').primaryKey(),
    debtId: text('debt_id')
      .notNull()
      .references(() => debts.id, { onDelete: 'cascade' }),
    type: text('type', { enum: DEBT_RECORD_TYPES }).notNull(),
    amount: integer('amount').notNull(),
    date: integer('date').notNull(),
    note: text('note'),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    transactionId: text('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    index('debt_records_debt_idx').on(t.debtId),
    check('debt_records_amount_non_negative', sql`${t.amount} >= 0`),
  ],
);

// ─── Ngân sách ──────────────────────────────────────────────────────────────

export const budgets = sqliteTable(
  'budgets',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Hạn mức mỗi kỳ (tháng) */
    amount: integer('amount').notNull(),
    /** Danh sách id danh mục, cách nhau bởi dấu phẩy. Trống = mọi khoản chi */
    categoryIds: text('category_ids'),
    /** Danh sách id ví. Trống = mọi ví */
    accountIds: text('account_ids'),
    /** Ngày bắt đầu chu kỳ riêng của ngân sách (1–31). Trống = theo ngày bắt đầu tháng chung */
    startDay: integer('start_day'),
    /** Ngày bắt đầu rơi vào cuối tuần: giữ nguyên / lùi về thứ Sáu ('before') / dời sang thứ Hai ('after') */
    weekendRule: text('weekend_rule', { enum: WEEKEND_RULES }).notNull().default('none'),
    orderNum: real('order_num').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check('budgets_amount_non_negative', sql`${t.amount} >= 0`),
    check('budgets_start_day_range', sql`${t.startDay} is null or ${t.startDay} between 1 and 31`),
  ],
);

// ─── Quỹ / mục tiêu tiết kiệm ───────────────────────────────────────────────

export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Số tiền cần đạt */
    targetAmount: integer('target_amount').notNull(),
    /** Ví làm quỹ: tiến độ = số dư ví. Trống = tiến độ nhập tay (savedAmount) */
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    /** Số đã góp khi không gắn ví */
    savedAmount: integer('saved_amount').notNull().default(0),
    /** Hạn đạt mục tiêu 'YYYY-MM-DD' */
    deadline: text('deadline'),
    icon: text('icon'),
    color: text('color').notNull().default('#7C3AED'),
    note: text('note'),
    orderNum: real('order_num').notNull().default(0),
    ...timestamps,
  },
  (t) => [check('goals_target_positive', sql`${t.targetAmount} > 0`)],
);

// ─── Quy tắc phân loại cho giao dịch tự đọc ───────────────────────────────────

/** "Nội dung chứa <pattern> → danh mục X"; có thể bật tự ghi (không cần xác nhận). */
export const captureRules = sqliteTable(
  'capture_rules',
  {
    id: text('id').primaryKey(),
    /** Cụm từ cần có trong nội dung / người gửi tiền (không phân biệt hoa thường, dấu) */
    pattern: text('pattern').notNull(),
    /** Chỉ áp dụng cho loại này; trống = cả thu và chi */
    type: text('type', { enum: ['income', 'expense'] }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    /** Khớp là ghi luôn, không chờ xác nhận */
    autoAccept: integer('auto_accept', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [check('capture_rules_pattern_not_empty', sql`length(trim(${t.pattern})) > 0`)],
);

// ─── Giao dịch tự đọc từ thông báo / SMS ngân hàng ─────────────────────────────

export const CAPTURE_STATUSES = ['pending', 'accepted', 'dismissed', 'unparsed'] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

/** Mỗi dòng là một thông báo / SMS đã bắt được. Chỉ lưu cục bộ, không đưa vào file sao lưu. */
export const captures = sqliteTable(
  'captures',
  {
    id: text('id').primaryKey(),
    /** Dấu vân tay chống trùng (người gửi + nội dung + phút) */
    fingerprint: text('fingerprint').notNull(),
    source: text('source', { enum: ['notification', 'sms'] }).notNull(),
    sender: text('sender').notNull(),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    /** Thời điểm thông báo (ms) */
    postedAt: integer('posted_at').notNull(),
    type: text('type', { enum: ['income', 'expense'] }),
    amount: integer('amount'),
    balanceAfter: integer('balance_after'),
    content: text('content').notNull().default(''),
    counterparty: text('counterparty'),
    bankCode: text('bank_code'),
    /** Ví đoán theo ngân hàng */
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    status: text('status', { enum: CAPTURE_STATUSES }).notNull().default('pending'),
    transactionId: text('transaction_id').references((): AnySQLiteColumn => transactions.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    uniqueIndex('captures_fingerprint_unique').on(t.fingerprint),
    index('captures_status_idx').on(t.status),
  ],
);

// ─── Kiểu dữ liệu suy ra từ bảng ────────────────────────────────────────────

export type CaptureRule = typeof captureRules.$inferSelect;
export type NewCaptureRule = typeof captureRules.$inferInsert;
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
export type NewScheduleOccurrence = typeof scheduleOccurrences.$inferInsert;
export type TransactionTag = typeof transactionTags.$inferSelect;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
export type DebtRecord = typeof debtRecords.$inferSelect;
export type NewDebtRecord = typeof debtRecords.$inferInsert;
export type Capture = typeof captures.$inferSelect;
export type NewCapture = typeof captures.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
