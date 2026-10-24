// Định dạng file sao lưu JWP (JSON, UTF-8):
//   { app: 'JWP', schemaVersion, exportedAt, appVersion?, data: { accounts, categories, tags,
//     transactions, transactionTags, schedules, scheduleOccurrences, people, debts, debtTerms,
//     debtRecords, budgets, goals, captureRules, settings } }
// Mỗi bảng là mảng các dòng y nguyên trong DB (tên trường camelCase như Drizzle, boolean thật,
// tiền là số nguyên đồng, thời điểm là mili giây UTC) → khôi phục không mất dữ liệu.
//
// Bộ kiểm tra (zod) được SINH TỰ ĐỘNG từ định nghĩa bảng trong src/db/schema.ts: thêm cột mới vào DB
// thì file sao lưu tự có cột đó, không phải sửa tay ở đây.
import { getTableColumns, type Table } from 'drizzle-orm';
import { z } from 'zod';

import {
  accounts,
  budgets,
  captureRules,
  categories,
  debtRecords,
  debtTerms,
  debts,
  goals,
  people,
  scheduleOccurrences,
  schedules,
  tags,
  transactionTags,
  transactions,
} from '@/db/schema';
import { DEFAULT_SETTINGS, type SettingsState } from '@/features/settings/store';

export const BACKUP_APP = 'JWP';
/** Tăng khi đổi cấu trúc file theo kiểu bản cũ không đọc được */
export const BACKUP_SCHEMA_VERSION = 1;

/** Các bảng theo thứ tự GHI an toàn khoá ngoại (bảng cha trước bảng con) */
export const BACKUP_TABLES = {
  accounts,
  categories,
  tags,
  people,
  schedules,
  debts,
  debtTerms,
  transactions,
  transactionTags,
  scheduleOccurrences,
  debtRecords,
  budgets,
  goals,
  captureRules,
} as const;

export type BackupTableKey = keyof typeof BACKUP_TABLES;
export const WRITE_ORDER = Object.keys(BACKUP_TABLES) as BackupTableKey[];

/** Thứ tự các khoá trong file (dễ đọc: ví → danh mục → giao dịch → lịch → sổ nợ → ngân sách) */
export const DATA_KEYS: BackupTableKey[] = [
  'accounts',
  'categories',
  'tags',
  'transactions',
  'transactionTags',
  'schedules',
  'scheduleOccurrences',
  'people',
  'debts',
  'debtTerms',
  'debtRecords',
  'budgets',
  'goals',
  'captureRules',
];

export const TABLE_LABELS: Record<BackupTableKey, string> = {
  accounts: 'Ví',
  categories: 'Danh mục',
  tags: 'Tag',
  transactions: 'Giao dịch',
  transactionTags: 'Gắn tag',
  schedules: 'Lịch thu chi',
  scheduleOccurrences: 'Kỳ của lịch',
  people: 'Người',
  debts: 'Khoản nợ',
  debtTerms: 'Lãi suất & kỳ hạn của khoản nợ',
  debtRecords: 'Lần trả / vay thêm',
  budgets: 'Ngân sách',
  goals: 'Quỹ tiết kiệm',
  captureRules: 'Quy tắc phân loại tự đọc',
};

type RowOf<K extends BackupTableKey> = (typeof BACKUP_TABLES)[K]['$inferSelect'];
export type BackupRows = { [K in BackupTableKey]: RowOf<K>[] };
export type BackupData = BackupRows & { settings: Partial<SettingsState> };

export type JwpBackup = {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  /** Thời điểm xuất, ISO 8601 (UTC) */
  exportedAt: string;
  appVersion?: string;
  data: BackupData;
};

// ─── Cài đặt ────────────────────────────────────────────────────────────────

/** Cài đặt gắn với từng máy (vd quyền thư mục Android) — không xuất, không ghi đè khi khôi phục */
const DEVICE_LOCAL_SETTINGS = ['backupFolderUri'] as const;

const isDeviceLocal = (key: string) => (DEVICE_LOCAL_SETTINGS as readonly string[]).includes(key);

/** Cài đặt đưa vào file sao lưu (bỏ các trường riêng của máy) */
export function exportableSettings(settings: Partial<SettingsState>): Partial<SettingsState> {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => key in DEFAULT_SETTINGS && !isDeviceLocal(key)),
  ) as Partial<SettingsState>;
}

/**
 * Cài đặt đọc từ file → bản vá an toàn cho store: chỉ giữ khoá app biết, đúng kiểu với giá trị mặc định
 * (file sửa tay / bản app khác không làm hỏng cài đặt).
 */
export function settingsPatchFromBackup(raw: unknown): Partial<SettingsState> {
  if (!raw || typeof raw !== 'object') return {};
  const patch: Record<string, unknown> = {};
  const defaults = DEFAULT_SETTINGS as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in defaults) || isDeviceLocal(key)) continue;
    const fallback = defaults[key];
    if (fallback !== null && typeof fallback === 'object') {
      if (!value || typeof value !== 'object') continue;
      const nested: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const d = (fallback as Record<string, unknown>)[k];
        if (k in (fallback as object) && typeof v === typeof d) nested[k] = v;
      }
      patch[key] = { ...(fallback as object), ...nested };
    } else if (fallback === null ? typeof value === 'string' : typeof value === typeof fallback) {
      patch[key] = value;
    }
  }
  return patch as Partial<SettingsState>;
}

// ─── Kiểm tra cấu trúc ──────────────────────────────────────────────────────

/** zod cho một dòng của bảng, sinh từ cột Drizzle: kiểu, enum, NOT NULL, giá trị mặc định */
function rowSchema(table: Table) {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    let field: z.ZodType;
    if (column.dataType === 'boolean') field = z.boolean();
    else if (column.dataType === 'number') {
      field = column.columnType === 'SQLiteInteger' ? z.number().int() : z.number();
    } else if (column.enumValues && column.enumValues.length > 0) {
      field = z.enum(column.enumValues as [string, ...string[]]);
    } else field = z.string();
    if (!column.notNull) field = field.nullable();
    // Thiếu trường (file từ bản app cũ hơn): cột có mặc định → để DB tự điền; cột cho phép null → null
    if (!column.notNull || column.hasDefault) field = field.optional();
    shape[key] = field;
  }
  return z.object(shape);
}

const dataShape: Record<string, z.ZodType> = {
  settings: z.record(z.string(), z.unknown()).default({}),
};
for (const key of WRITE_ORDER) {
  dataShape[key] = z.array(rowSchema(BACKUP_TABLES[key])).default([]);
}

const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.union([z.string(), z.number()]).transform((value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
  }),
  appVersion: z.string().optional(),
  data: z.object(dataShape),
});

export class BackupReadError extends Error {}

const TYPE_NAMES: Record<string, string> = {
  string: 'chuỗi',
  number: 'số',
  int: 'số nguyên',
  boolean: 'đúng/sai',
  array: 'danh sách',
  object: 'đối tượng',
};

function valueAt(root: unknown, path: readonly PropertyKey[]): unknown {
  let node: unknown = root;
  for (const key of path) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Record<PropertyKey, unknown>)[key];
  }
  return node;
}

/** Lỗi zod → câu tiếng Việt chỉ rõ bảng, dòng và trường bị sai */
function describeIssue(issue: z.core.$ZodIssue, root: unknown): string {
  const path = issue.path;
  let where = path.join('.') || '(gốc)';
  if (path[0] === 'data' && typeof path[1] === 'string' && path[1] in BACKUP_TABLES) {
    const label = TABLE_LABELS[path[1] as BackupTableKey];
    where =
      typeof path[2] === 'number'
        ? `${label} thứ ${path[2] + 1}${path[3] != null ? `, trường "${String(path[3])}"` : ''}`
        : label;
  }
  let what: string;
  if (issue.code === 'invalid_type') {
    what =
      valueAt(root, path) === undefined
        ? 'thiếu dữ liệu'
        : `sai kiểu (cần ${TYPE_NAMES[issue.expected] ?? issue.expected})`;
  } else if (issue.code === 'invalid_value') what = 'giá trị không hợp lệ';
  else if (issue.code === 'too_small') what = 'giá trị quá nhỏ';
  else what = issue.message;
  return `${where}: ${what}`;
}

/** Đối tượng JSON → bản sao lưu đã kiểm tra. Ném BackupReadError với thông báo tiếng Việt. */
export function parseJwpBackup(json: unknown): JwpBackup {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new BackupReadError('File không phải bản sao lưu JWP.');
  }
  const head = json as { app?: unknown; schemaVersion?: unknown };
  if (head.app !== BACKUP_APP) {
    throw new BackupReadError('File không phải bản sao lưu JWP (thiếu dấu hiệu "app": "JWP").');
  }
  if (typeof head.schemaVersion === 'number' && head.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupReadError(
      `File được tạo bởi phiên bản JWP mới hơn (định dạng v${head.schemaVersion}, app này đọc được tới v${BACKUP_SCHEMA_VERSION}). Hãy cập nhật app rồi thử lại.`,
    );
  }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const more = issues.length > 1 ? ` (và ${issues.length - 1} lỗi khác)` : '';
    throw new BackupReadError(`File sao lưu bị lỗi — ${describeIssue(issues[0], json)}${more}.`);
  }
  const { data, ...meta } = parsed.data;
  return {
    ...meta,
    app: BACKUP_APP,
    data: data as unknown as BackupData,
  };
}

/** Số dòng mỗi bảng (để xem trước) */
export function countRows(data: BackupRows): Record<BackupTableKey, number> {
  return Object.fromEntries(WRITE_ORDER.map((key) => [key, data[key].length])) as Record<
    BackupTableKey,
    number
  >;
}
