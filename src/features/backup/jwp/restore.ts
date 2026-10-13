// Khôi phục bản sao lưu JWP vào DB, trong MỘT transaction (lỗi giữa chừng → không đổi gì).
// - Thay thế (replace): xoá sạch dữ liệu hiện tại rồi ghi lại y nguyên từ file.
//   Trước khi xoá, nơi gọi PHẢI lưu một bản sao lưu dữ liệu hiện tại (beforeReplace).
// - Gộp (merge): ghi theo id — bản ghi chưa có thì thêm; đã có thì bản nào sửa sau (updatedAt lớn hơn)
//   thắng; bằng nhau hoặc cũ hơn thì giữ bản trong máy.
import { and, eq, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  accounts,
  budgets,
  categories,
  debtRecords,
  debts,
  goals,
  people,
  scheduleOccurrences,
  schedules,
  tags,
  transactionTags,
  transactions,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { computeBalances } from '@/features/accounts/balance';

import {
  BACKUP_TABLES,
  BackupReadError,
  countRows,
  WRITE_ORDER,
  type BackupRows,
  type BackupTableKey,
  type JwpBackup,
} from './format';

type Tx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];
type AnyRow = Record<string, unknown>;
type Counts = Record<BackupTableKey, number>;

/** SQLite giới hạn số tham số mỗi câu lệnh → chèn theo lô nhỏ */
const CHUNK = 50;

/** Danh từ thường dùng trong câu thông báo */
const NOUNS: Record<BackupTableKey, string> = {
  accounts: 'ví',
  categories: 'danh mục',
  tags: 'tag',
  transactions: 'giao dịch',
  transactionTags: 'liên kết tag',
  schedules: 'lịch',
  scheduleOccurrences: 'kỳ của lịch',
  people: 'người',
  debts: 'khoản nợ',
  debtRecords: 'lần trả / vay thêm',
  budgets: 'ngân sách',
  goals: 'quỹ tiết kiệm',
};

// ─── Khoá & khoá ngoại ──────────────────────────────────────────────────────

/** Khoá chính của một dòng (bảng nối dùng khoá ghép) */
export function rowKey(table: BackupTableKey, row: AnyRow): string {
  if (table === 'transactionTags') return `${row.transactionId}|${row.tagId}`;
  if (table === 'scheduleOccurrences') return `${row.scheduleId}|${row.dueDate}`;
  return String(row.id);
}

/**
 * Khoá ngoại trong file. Khi bản ghi đích không tồn tại:
 * - error: không thể khôi phục (vd giao dịch thiếu ví)
 * - null: bỏ liên kết, giữ bản ghi (vd danh mục đã xoá → "Chưa phân loại")
 * - drop: bỏ dòng (chỉ dùng cho bảng nối / bản ghi phụ, không bảng nào trỏ tới chúng)
 */
type Ref = {
  table: BackupTableKey;
  column: string;
  target: BackupTableKey;
  onMissing: 'error' | 'null' | 'drop';
};

const REFS: Ref[] = [
  { table: 'schedules', column: 'accountId', target: 'accounts', onMissing: 'error' },
  { table: 'schedules', column: 'toAccountId', target: 'accounts', onMissing: 'null' },
  { table: 'schedules', column: 'categoryId', target: 'categories', onMissing: 'null' },
  { table: 'goals', column: 'accountId', target: 'accounts', onMissing: 'null' },
  { table: 'debts', column: 'personId', target: 'people', onMissing: 'error' },
  { table: 'debts', column: 'accountId', target: 'accounts', onMissing: 'null' },
  { table: 'debts', column: 'transactionId', target: 'transactions', onMissing: 'null' },
  { table: 'transactions', column: 'accountId', target: 'accounts', onMissing: 'error' },
  // Chuyển khoản bắt buộc có ví nhận (ràng buộc CHECK) → không thể bỏ trống
  { table: 'transactions', column: 'toAccountId', target: 'accounts', onMissing: 'error' },
  { table: 'transactions', column: 'categoryId', target: 'categories', onMissing: 'null' },
  { table: 'transactions', column: 'scheduleId', target: 'schedules', onMissing: 'null' },
  { table: 'transactions', column: 'parentId', target: 'transactions', onMissing: 'null' },
  { table: 'transactions', column: 'debtId', target: 'debts', onMissing: 'null' },
  { table: 'transactionTags', column: 'transactionId', target: 'transactions', onMissing: 'drop' },
  { table: 'transactionTags', column: 'tagId', target: 'tags', onMissing: 'drop' },
  { table: 'scheduleOccurrences', column: 'scheduleId', target: 'schedules', onMissing: 'drop' },
  {
    table: 'scheduleOccurrences',
    column: 'transactionId',
    target: 'transactions',
    onMissing: 'null',
  },
  { table: 'debtRecords', column: 'debtId', target: 'debts', onMissing: 'drop' },
  { table: 'debtRecords', column: 'accountId', target: 'accounts', onMissing: 'null' },
  { table: 'debtRecords', column: 'transactionId', target: 'transactions', onMissing: 'null' },
];

export type ReferenceCheck = { data: BackupRows; warnings: string[]; errors: string[] };

/**
 * Kiểm tra trùng khoá và khoá ngoại trước khi ghi → thông báo dễ hiểu thay vì lỗi
 * "FOREIGN KEY constraint failed" của SQLite. `existing`: id đã có trong máy (chế độ gộp).
 */
export function checkReferences(
  input: BackupRows,
  existing: Partial<Record<BackupTableKey, Set<string>>> = {},
): ReferenceCheck {
  const warnings: string[] = [];
  const errors: string[] = [];
  const data = { ...input } as Record<BackupTableKey, AnyRow[]>;

  // Trùng khoá trong file: bảng nối → bỏ bản trùng; bảng thường → lỗi
  for (const key of WRITE_ORDER) {
    const seen = new Set<string>();
    let duplicates = 0;
    const rows = data[key].filter((row) => {
      const k = rowKey(key, row);
      if (seen.has(k)) {
        duplicates++;
        return false;
      }
      seen.add(k);
      return true;
    });
    if (!duplicates) continue;
    if (key === 'transactionTags') data[key] = rows;
    else errors.push(`${duplicates} ${NOUNS[key]} bị trùng mã trong file`);
  }

  const ids = {} as Record<BackupTableKey, Set<string>>;
  for (const key of WRITE_ORDER) {
    ids[key] = new Set([...data[key].map((row) => String(row.id)), ...(existing[key] ?? [])]);
  }

  for (const ref of REFS) {
    const target = ids[ref.target];
    let missing = 0;
    const rows: AnyRow[] = [];
    for (const row of data[ref.table]) {
      const value = row[ref.column];
      if (value == null || target.has(String(value))) {
        rows.push(row);
        continue;
      }
      missing++;
      if (ref.onMissing === 'null') rows.push({ ...row, [ref.column]: null });
      else if (ref.onMissing === 'error') rows.push(row);
    }
    if (!missing) continue;
    data[ref.table] = rows;
    const what = `${missing} ${NOUNS[ref.table]} trỏ tới ${NOUNS[ref.target]} không tồn tại`;
    if (ref.onMissing === 'error') errors.push(what);
    else warnings.push(`${what} → ${ref.onMissing === 'null' ? 'bỏ liên kết' : 'bỏ qua'}`);
  }

  return { data: data as unknown as BackupRows, warnings, errors };
}

// ─── Ghi ────────────────────────────────────────────────────────────────────

function insertRows(tx: Tx, table: SQLiteTable, rows: readonly AnyRow[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    tx.insert(table)
      .values(rows.slice(i, i + CHUNK) as never[])
      .run();
  }
}

/** Giao dịch cha (vd lần chuyển tiền) phải được ghi trước giao dịch con (phí chuyển) */
function parentFirst(rows: readonly AnyRow[]): AnyRow[] {
  const pendingIds = new Set(rows.map((row) => String(row.id)));
  const result: AnyRow[] = [];
  let pending = [...rows];
  while (pending.length) {
    const next: AnyRow[] = [];
    for (const row of pending) {
      const parent = row.parentId as string | null | undefined;
      if (parent && pendingIds.has(parent)) next.push(row);
      else result.push(row);
    }
    if (next.length === pending.length) {
      result.push(...next); // vòng tham chiếu (không thể xảy ra với dữ liệu hợp lệ)
      break;
    }
    for (const row of result) pendingIds.delete(String(row.id));
    pending = next;
  }
  return result;
}

/** Khoản nợ ↔ giao dịch trỏ lẫn nhau: ghi khoản nợ chưa có transactionId, cập nhật sau */
function linkDebtTransactions(tx: Tx, rows: readonly AnyRow[]) {
  for (const debt of rows) {
    if (!debt.transactionId) continue;
    tx.update(debts)
      // Giữ nguyên updatedAt của file (không để Drizzle tự đặt thời điểm hiện tại)
      .set({ transactionId: debt.transactionId as string, updatedAt: debt.updatedAt as number })
      .where(eq(debts.id, debt.id as string))
      .run();
  }
}

function wipeAll(tx: Tx) {
  // Con trước cha; khoản nợ ↔ giao dịch: gỡ liên kết trước khi xoá
  tx.delete(transactionTags).run();
  tx.delete(scheduleOccurrences).run();
  tx.delete(debtRecords).run();
  tx.delete(budgets).run();
  tx.delete(goals).run();
  tx.update(debts).set({ transactionId: null }).run();
  tx.delete(transactions).run();
  tx.delete(debts).run();
  tx.delete(people).run();
  tx.delete(schedules).run();
  tx.delete(tags).run();
  tx.delete(categories).run();
  tx.delete(accounts).run();
}

export type TableResult = { inserted: number; updated: number; skipped: number };
export type RestoreResult = {
  mode: RestoreMode;
  tables: Record<BackupTableKey, TableResult>;
  warnings: string[];
};
export type RestoreMode = 'replace' | 'merge';

function assertNoErrors(errors: string[]) {
  if (errors.length) {
    throw new BackupReadError(`Không khôi phục được: ${errors.join('; ')}.`);
  }
}

export function restoreReplace(db: AppDatabase, backup: JwpBackup): RestoreResult {
  const { data, warnings, errors } = checkReferences(backup.data);
  assertNoErrors(errors);
  const rows = data as unknown as Record<BackupTableKey, AnyRow[]>;
  db.transaction((tx) => {
    wipeAll(tx);
    for (const key of WRITE_ORDER) {
      const table = BACKUP_TABLES[key];
      if (key === 'debts')
        insertRows(
          tx,
          table,
          rows.debts.map((d) => ({ ...d, transactionId: null })),
        );
      else if (key === 'transactions') insertRows(tx, table, parentFirst(rows.transactions));
      else insertRows(tx, table, rows[key]);
    }
    linkDebtTransactions(tx, rows.debts);
  });
  const tables = {} as Record<BackupTableKey, TableResult>;
  for (const key of WRITE_ORDER)
    tables[key] = { inserted: rows[key].length, updated: 0, skipped: 0 };
  return { mode: 'replace', tables, warnings };
}

// ─── Gộp ────────────────────────────────────────────────────────────────────

export type MergeTablePlan = { insert: AnyRow[]; update: AnyRow[]; skipped: number };
export type MergePlan = {
  tables: Record<BackupTableKey, MergeTablePlan>;
  warnings: string[];
  errors: string[];
};

function existingRows(db: AppDatabase, key: BackupTableKey): AnyRow[] {
  return db.select().from(BACKUP_TABLES[key]).all() as AnyRow[];
}

/** Phân loại từng dòng trong file: thêm mới / cập nhật (file mới hơn) / bỏ qua (máy mới hơn) */
export function planMerge(db: AppDatabase, backup: JwpBackup): MergePlan {
  const input = { ...backup.data } as unknown as Record<BackupTableKey, AnyRow[]>;
  const current = {} as Record<BackupTableKey, AnyRow[]>;
  for (const key of WRITE_ORDER) current[key] = existingRows(db, key);

  // Tag trùng tên (không dấu) với tag khác id trong máy → dùng tag trong máy (tên tag là duy nhất)
  const tagIdsInDb = new Set(current.tags.map((t) => String(t.id)));
  const tagByName = new Map(current.tags.map((t) => [String(t.nameKey), String(t.id)]));
  const tagRemap = new Map<string, string>();
  for (const tag of input.tags) {
    const sameName = tagByName.get(String(tag.nameKey));
    if (!tagIdsInDb.has(String(tag.id)) && sameName && sameName !== tag.id) {
      tagRemap.set(String(tag.id), sameName);
    }
  }
  if (tagRemap.size) {
    input.tags = input.tags.filter((t) => !tagRemap.has(String(t.id)));
    input.transactionTags = input.transactionTags.map((link) => ({
      ...link,
      tagId: tagRemap.get(String(link.tagId)) ?? link.tagId,
    }));
  }

  const existingIds: Partial<Record<BackupTableKey, Set<string>>> = {};
  for (const key of WRITE_ORDER) existingIds[key] = new Set(current[key].map((r) => String(r.id)));
  const { data, warnings, errors } = checkReferences(input as unknown as BackupRows, existingIds);
  if (tagRemap.size) warnings.push(`${tagRemap.size} tag trùng tên với tag đang có → gộp làm một`);

  const tables = {} as Record<BackupTableKey, MergeTablePlan>;
  for (const key of WRITE_ORDER) {
    const versions = new Map(
      current[key].map((row) => [rowKey(key, row), row.updatedAt as number | undefined]),
    );
    const plan: MergeTablePlan = {
      insert: [],
      update: [],
      skipped: tagRemapSkipped(key, tagRemap),
    };
    for (const row of (data as unknown as Record<BackupTableKey, AnyRow[]>)[key]) {
      const k = rowKey(key, row);
      if (!versions.has(k)) plan.insert.push(row);
      else if (
        typeof row.updatedAt === 'number' &&
        row.updatedAt > ((versions.get(k) as number | undefined) ?? Infinity)
      ) {
        plan.update.push(row);
      } else plan.skipped++;
    }
    tables[key] = plan;
  }
  return { tables, warnings, errors };
}

const tagRemapSkipped = (key: BackupTableKey, remap: Map<string, string>) =>
  key === 'tags' ? remap.size : 0;

function whereKey(key: BackupTableKey, row: AnyRow): SQL | undefined {
  if (key === 'transactionTags') {
    return and(
      eq(transactionTags.transactionId, row.transactionId as string),
      eq(transactionTags.tagId, row.tagId as string),
    );
  }
  if (key === 'scheduleOccurrences') {
    return and(
      eq(scheduleOccurrences.scheduleId, row.scheduleId as string),
      eq(scheduleOccurrences.dueDate, row.dueDate as string),
    );
  }
  const table = BACKUP_TABLES[key] as typeof accounts;
  return eq(table.id, row.id as string);
}

function updateRows(tx: Tx, key: BackupTableKey, rows: readonly AnyRow[]) {
  const table = BACKUP_TABLES[key];
  for (const row of rows) {
    tx.update(table)
      .set(row as never)
      .where(whereKey(key, row))
      .run();
  }
}

export function restoreMerge(db: AppDatabase, backup: JwpBackup): RestoreResult {
  const plan = planMerge(db, backup);
  assertNoErrors(plan.errors);
  const t = plan.tables;
  db.transaction((tx) => {
    for (const key of WRITE_ORDER) {
      const { insert, update } = t[key];
      if (key === 'debts') {
        const unlink = (d: AnyRow) => ({ ...d, transactionId: null });
        insertRows(tx, debts, insert.map(unlink));
        updateRows(tx, key, update.map(unlink));
      } else if (key === 'transactions') {
        insertRows(tx, transactions, parentFirst(insert));
        updateRows(tx, key, update);
      } else {
        insertRows(tx, BACKUP_TABLES[key], insert);
        updateRows(tx, key, update);
      }
    }
    linkDebtTransactions(tx, [...t.debts.insert, ...t.debts.update]);
  });
  const tables = {} as Record<BackupTableKey, TableResult>;
  for (const key of WRITE_ORDER) {
    tables[key] = {
      inserted: t[key].insert.length,
      updated: t[key].update.length,
      skipped: t[key].skipped,
    };
  }
  return { mode: 'merge', tables, warnings: plan.warnings };
}

// ─── Xem trước & điều phối ──────────────────────────────────────────────────

export type RestorePreview = {
  exportedAt: string;
  appVersion?: string;
  schemaVersion: number;
  /** Số dòng mỗi bảng trong file */
  fileCounts: Counts;
  /** Số dòng mỗi bảng đang có trong máy */
  currentCounts: Counts;
  /** Thu / chi / chuyển trong file */
  transactionTypes: { income: number; expense: number; transfer: number };
  /** Tổng số dư (các ví tính vào tổng, chưa lưu trữ) theo dữ liệu trong file */
  totalBalance: number;
  replace: { warnings: string[]; errors: string[] };
  merge: {
    tables: Record<BackupTableKey, { insert: number; update: number; skipped: number }>;
    warnings: string[];
    errors: string[];
  };
};

export function previewRestore(db: AppDatabase, backup: JwpBackup): RestorePreview {
  const { data } = backup;
  const currentCounts = {} as Counts;
  for (const key of WRITE_ORDER) currentCounts[key] = existingRows(db, key).length;

  const replaceCheck = checkReferences(data);
  const mergePlan = planMerge(db, backup);

  const balances = computeBalances(
    data.accounts.map((a) => a.id),
    data.transactions,
  );
  const totalBalance = data.accounts
    .filter((a) => a.includeInBalance && !a.archived)
    .reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);

  const types = { income: 0, expense: 0, transfer: 0 };
  for (const tx of data.transactions) types[tx.type]++;

  const mergeTables = {} as RestorePreview['merge']['tables'];
  for (const key of WRITE_ORDER) {
    const p = mergePlan.tables[key];
    mergeTables[key] = { insert: p.insert.length, update: p.update.length, skipped: p.skipped };
  }

  return {
    exportedAt: backup.exportedAt,
    appVersion: backup.appVersion,
    schemaVersion: backup.schemaVersion,
    fileCounts: countRows(data),
    currentCounts,
    transactionTypes: types,
    totalBalance,
    replace: { warnings: replaceCheck.warnings, errors: replaceCheck.errors },
    merge: { tables: mergeTables, warnings: mergePlan.warnings, errors: mergePlan.errors },
  };
}

/**
 * Khôi phục theo chế độ. Thay thế: gọi `beforeReplace` (lưu bản sao lưu dữ liệu hiện tại) TRƯỚC khi
 * xoá — nếu hàm đó lỗi thì dừng, không đụng vào dữ liệu.
 */
export function restoreBackup(
  db: AppDatabase,
  backup: JwpBackup,
  mode: RestoreMode,
  { beforeReplace }: { beforeReplace?: () => void } = {},
): RestoreResult {
  if (mode === 'merge') return restoreMerge(db, backup);
  const { errors } = checkReferences(backup.data);
  assertNoErrors(errors);
  beforeReplace?.();
  return restoreReplace(db, backup);
}
