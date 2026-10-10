import { asc, count, eq, or, sql } from 'drizzle-orm';

import { accounts, schedules, transactions, type Account } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { createId } from '@/lib/id';

export type AccountInput = {
  id?: string;
  name: string;
  color: string;
  icon: string;
  includeInBalance: boolean;
};

export function listAccounts(db: AppDatabase, { includeArchived = false } = {}): Account[] {
  return db
    .select()
    .from(accounts)
    .where(includeArchived ? undefined : eq(accounts.archived, false))
    .orderBy(asc(accounts.orderNum), asc(accounts.name))
    .all();
}

export function saveAccount(db: AppDatabase, input: AccountInput): string {
  const name = input.name.trim();
  if (!name) throw new Error('Tên ví không được trống.');
  const values = {
    name,
    color: input.color,
    icon: input.icon,
    includeInBalance: input.includeInBalance,
  };
  if (input.id) {
    db.update(accounts).set(values).where(eq(accounts.id, input.id)).run();
    return input.id;
  }
  const id = createId();
  const max = db
    .select({ v: sql<number>`coalesce(max(${accounts.orderNum}), -1)` })
    .from(accounts)
    .get();
  db.insert(accounts)
    .values({ id, ...values, orderNum: (max?.v ?? -1) + 1 })
    .run();
  return id;
}

export function setAccountArchived(db: AppDatabase, id: string, archived: boolean): void {
  db.update(accounts).set({ archived }).where(eq(accounts.id, id)).run();
}

export function accountTransactionCount(db: AppDatabase, id: string): number {
  return (
    db
      .select({ n: count() })
      .from(transactions)
      .where(or(eq(transactions.accountId, id), eq(transactions.toAccountId, id)))
      .get()?.n ?? 0
  );
}

/**
 * Xoá ví. Ví còn giao dịch thì phải truyền deleteTransactions = true (xoá luôn giao dịch của ví,
 * kể cả chuyển khoản liên quan, và lịch thu chi của ví) — nếu không sẽ báo lỗi để giao diện gợi ý "lưu trữ" thay vì xoá.
 */
export function deleteAccount(db: AppDatabase, id: string, deleteTransactions = false): void {
  db.transaction((tx) => {
    const used =
      tx
        .select({ n: count() })
        .from(transactions)
        .where(or(eq(transactions.accountId, id), eq(transactions.toAccountId, id)))
        .get()?.n ?? 0;
    if (used > 0 && !deleteTransactions) {
      throw new Error(`Ví còn ${used} giao dịch.`);
    }
    tx.delete(transactions)
      .where(or(eq(transactions.accountId, id), eq(transactions.toAccountId, id)))
      .run();
    tx.delete(schedules)
      .where(or(eq(schedules.accountId, id), eq(schedules.toAccountId, id)))
      .run();
    tx.delete(accounts).where(eq(accounts.id, id)).run();
  });
}

export function reorderAccounts(db: AppDatabase, orderedIds: string[]): void {
  db.transaction((tx) => {
    orderedIds.forEach((id, index) =>
      tx.update(accounts).set({ orderNum: index }).where(eq(accounts.id, id)).run(),
    );
  });
}

export function getAccountBalance(db: AppDatabase, id: string): number {
  const row = db
    .select({
      balance: sql<number>`coalesce(sum(case
        when ${transactions.accountId} = ${id} and ${transactions.type} = 'income' then ${transactions.amount}
        when ${transactions.accountId} = ${id} then -${transactions.amount}
        else 0 end), 0)
        + coalesce(sum(case when ${transactions.toAccountId} = ${id}
            then coalesce(${transactions.toAmount}, ${transactions.amount}) else 0 end), 0)`,
    })
    .from(transactions)
    .where(or(eq(transactions.accountId, id), eq(transactions.toAccountId, id)))
    .get();
  return row?.balance ?? 0;
}

/**
 * Điều chỉnh số dư về đúng số thực tế: tạo một giao dịch "Điều chỉnh số dư"
 * (tính vào số dư, không tính vào thống kê thu/chi). Trả về id giao dịch, hoặc null nếu đã khớp.
 */
export function adjustBalance(
  db: AppDatabase,
  accountId: string,
  actualBalance: number,
  date: number = Date.now(),
): string | null {
  const current = getAccountBalance(db, accountId);
  const diff = Math.round(actualBalance) - current;
  if (diff === 0) return null;
  const id = createId();
  db.insert(transactions)
    .values({
      id,
      type: diff > 0 ? 'income' : 'expense',
      amount: Math.abs(diff),
      accountId,
      title: 'Điều chỉnh số dư',
      titleKey: 'dieu chinh so du',
      date,
      isAdjustment: true,
    })
    .run();
  return id;
}

/** Có ví nào chưa? (để biết có cần màn bắt đầu không) */
export function hasAnyAccount(db: AppDatabase): boolean {
  return !!db.select({ id: accounts.id }).from(accounts).limit(1).get();
}
