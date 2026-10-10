// Ghi kế hoạch import vào DB trong MỘT transaction: lỗi giữa chừng thì không ghi gì cả.
// Dùng ON CONFLICT DO NOTHING theo id gốc của Ivy → import lại lần 2 không tạo bản trùng,
// và không ghi đè dữ liệu người dùng đã sửa trong JWP.
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  accounts,
  budgets,
  categories,
  debtRecords,
  debts,
  people,
  scheduleOccurrences,
  schedules,
  tags,
  transactionTags,
  transactions,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { getAccountBalances } from '@/features/accounts/queries';

import type { IvyImportPlan } from './mapper';

export type TableCount = { inserted: number; skipped: number };
export type ImportCounts = Record<
  | 'accounts'
  | 'categories'
  | 'tags'
  | 'people'
  | 'debts'
  | 'schedules'
  | 'transactions'
  | 'transactionTags'
  | 'occurrences'
  | 'debtRecords'
  | 'budgets',
  TableCount
>;

/** SQLite giới hạn số tham số mỗi câu lệnh → chèn theo từng lô nhỏ */
const CHUNK = 50;

type Tx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];

function insertMany<T extends SQLiteTable>(
  tx: Tx,
  table: T,
  rows: readonly T['$inferInsert'][],
): TableCount {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const result = tx
      .insert(table)
      .values(rows.slice(i, i + CHUNK) as T['$inferInsert'][])
      .onConflictDoNothing()
      .run();
    inserted += Number(result.changes ?? 0);
  }
  return { inserted, skipped: rows.length - inserted };
}

export function writeIvyImport(db: AppDatabase, plan: IvyImportPlan): ImportCounts {
  return db.transaction((tx) => {
    const counts = {} as ImportCounts;
    counts.accounts = insertMany(tx, accounts, plan.accounts);
    counts.categories = insertMany(tx, categories, plan.categories);
    counts.tags = insertMany(tx, tags, plan.tags);
    counts.people = insertMany(tx, people, plan.people);
    // Khoản nợ và giao dịch trỏ lẫn nhau → chèn khoản nợ trước (chưa có transactionId), cập nhật sau
    counts.debts = insertMany(
      tx,
      debts,
      plan.debts.map((d) => ({ ...d, transactionId: null })),
    );
    counts.schedules = insertMany(tx, schedules, plan.schedules);
    counts.transactions = insertMany(tx, transactions, plan.transactions);
    counts.transactionTags = insertMany(tx, transactionTags, plan.transactionTags);
    counts.occurrences = insertMany(tx, scheduleOccurrences, plan.occurrences);
    counts.debtRecords = insertMany(tx, debtRecords, plan.debtRecords);
    counts.budgets = insertMany(tx, budgets, plan.budgets);
    for (const debt of plan.debts) {
      if (!debt.transactionId) continue;
      tx.update(debts)
        .set({ transactionId: debt.transactionId })
        .where(and(eq(debts.id, debt.id), isNull(debts.transactionId)))
        .run();
    }
    return counts;
  });
}

export type VerifyResult = {
  ok: boolean;
  balances: { name: string; expected: number; actual: number }[];
  missing: Record<string, number>;
};

async function countExisting(
  db: AppDatabase,
  table: typeof accounts | typeof categories | typeof transactions | typeof schedules,
  ids: string[],
): Promise<number> {
  let found = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await db
      .select({ id: table.id })
      .from(table)
      .where(inArray(table.id, ids.slice(i, i + 500)));
    found += rows.length;
  }
  return found;
}

/** Kiểm tra lại sau khi ghi: đủ số bản ghi và số dư từng ví khớp với bản xem trước */
export async function verifyIvyImport(db: AppDatabase, plan: IvyImportPlan): Promise<VerifyResult> {
  const actual = new Map((await getAccountBalances(db)).map((a) => [a.id, a.balance]));
  const balances = plan.balances.map((b) => ({
    name: b.name,
    expected: b.balance,
    actual: actual.get(b.accountId) ?? 0,
  }));
  const missing: Record<string, number> = {
    accounts:
      plan.accounts.length -
      (await countExisting(
        db,
        accounts,
        plan.accounts.map((a) => a.id),
      )),
    categories:
      plan.categories.length -
      (await countExisting(
        db,
        categories,
        plan.categories.map((c) => c.id),
      )),
    transactions:
      plan.transactions.length -
      (await countExisting(
        db,
        transactions,
        plan.transactions.map((t) => t.id),
      )),
    schedules:
      plan.schedules.length -
      (await countExisting(
        db,
        schedules,
        plan.schedules.map((s) => s.id),
      )),
  };
  const ok =
    balances.every((b) => b.expected === b.actual) && Object.values(missing).every((n) => n === 0);
  return { ok, balances, missing };
}
