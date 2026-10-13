// Thêm / sửa / xoá giao dịch. Mọi thao tác ghi chạy trong một transaction SQLite.
import { eq, inArray } from 'drizzle-orm';

import {
  scheduleOccurrences,
  schedules,
  transactionTags,
  transactions,
  type ScheduleOccurrence,
  type Transaction,
  type TransactionTag,
  type TransactionType,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { ensureFeeCategory } from '@/features/categories/repository';
import { createId } from '@/lib/id';
import { MAX_AMOUNT } from '@/lib/money';
import { normalizeForSearch } from '@/lib/text';

export type TransactionInput = {
  id?: string;
  type: TransactionType;
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  /** Số tiền ví nhận (chỉ chuyển khoản); trống = bằng `amount`. Khác nhau khi trả bill ví trả sau có chênh lệch. */
  toAmount?: number | null;
  categoryId?: string | null;
  title?: string;
  note?: string | null;
  date: number;
  tagIds?: string[];
  /** Phí chuyển khoản (chỉ với type = 'transfer'): ghi thành khoản chi con */
  fee?: number;
  scheduleId?: string | null;
  scheduleDueDate?: string | null;
  debtId?: string | null;
  isAdjustment?: boolean;
  /** Mã giao dịch bên ngoài (biên lai) — dùng chống nhập trùng */
  externalRef?: string | null;
};

export class TransactionValidationError extends Error {}

function validate(input: TransactionInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new TransactionValidationError('Số tiền phải lớn hơn 0.');
  }
  if (input.amount > MAX_AMOUNT) throw new TransactionValidationError('Số tiền quá lớn.');
  if (!input.accountId) throw new TransactionValidationError('Chưa chọn ví.');
  if (input.type === 'transfer') {
    if (!input.toAccountId) throw new TransactionValidationError('Chưa chọn ví nhận.');
    if (input.toAccountId === input.accountId) {
      throw new TransactionValidationError('Ví chuyển và ví nhận phải khác nhau.');
    }
  }
  if (input.fee != null && (input.fee < 0 || !Number.isInteger(input.fee))) {
    throw new TransactionValidationError('Phí không hợp lệ.');
  }
}

/** Id giao dịch đã nhập từ cùng một mã biên lai (null nếu chưa có) */
export function findByExternalRef(db: AppDatabase, ref: string): string | null {
  return (
    db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.externalRef, ref))
      .get()?.id ?? null
  );
}

/** Thêm mới (không có id) hoặc cập nhật. Trả về id giao dịch. */
export function saveTransaction(db: AppDatabase, input: TransactionInput): string {
  validate(input);
  const isTransfer = input.type === 'transfer';
  const title = (input.title ?? '').trim();
  const values = {
    type: input.type,
    amount: input.amount,
    accountId: input.accountId,
    toAccountId: isTransfer ? input.toAccountId! : null,
    toAmount: isTransfer ? (input.toAmount ?? input.amount) : null,
    categoryId: isTransfer ? null : (input.categoryId ?? null),
    title,
    titleKey: normalizeForSearch(title),
    note: input.note?.trim() || null,
    date: input.date,
    scheduleId: input.scheduleId ?? null,
    scheduleDueDate: input.scheduleDueDate ?? null,
    debtId: input.debtId ?? null,
    isAdjustment: input.isAdjustment ?? false,
    ...(input.externalRef !== undefined ? { externalRef: input.externalRef } : {}),
  };

  return db.transaction((tx) => {
    const id = input.id ?? createId();
    if (input.id) tx.update(transactions).set(values).where(eq(transactions.id, id)).run();
    else
      tx.insert(transactions)
        .values({ id, ...values })
        .run();

    // Giao dịch trả cho một kỳ của lịch → đánh dấu kỳ đó "đã thanh toán"
    if (input.scheduleId && input.scheduleDueDate) {
      const ruleAmount = tx
        .select({ amount: schedules.amount })
        .from(schedules)
        .where(eq(schedules.id, input.scheduleId))
        .get()?.amount;
      if (ruleAmount != null) {
        const row = {
          scheduleId: input.scheduleId,
          dueDate: input.scheduleDueDate,
          status: 'paid' as const,
          newDate: null,
          amount: input.amount !== ruleAmount ? input.amount : null,
          transactionId: id,
        };
        tx.insert(scheduleOccurrences)
          .values(row)
          .onConflictDoUpdate({
            target: [scheduleOccurrences.scheduleId, scheduleOccurrences.dueDate],
            set: { ...row, updatedAt: Date.now() },
          })
          .run();
      }
    }

    // Tag: thay toàn bộ danh sách
    tx.delete(transactionTags).where(eq(transactionTags.transactionId, id)).run();
    const tagIds = [...new Set(input.tagIds ?? [])];
    if (tagIds.length) {
      tx.insert(transactionTags)
        .values(tagIds.map((tagId) => ({ transactionId: id, tagId })))
        .onConflictDoNothing()
        .run();
    }

    // Phí chuyển khoản: giao dịch con, tạo lại mỗi lần lưu
    tx.delete(transactions).where(eq(transactions.parentId, id)).run();
    if (isTransfer && input.fee && input.fee > 0) {
      tx.insert(transactions)
        .values({
          id: createId(),
          type: 'expense',
          amount: input.fee,
          accountId: input.accountId,
          categoryId: ensureFeeCategory(tx),
          title: 'Phí chuyển khoản',
          titleKey: 'phi chuyen khoan',
          date: input.date,
          parentId: id,
        })
        .run();
    }
    return id;
  });
}

export type TransactionDetail = Transaction & { tagIds: string[]; fee: number };

export function getTransaction(db: AppDatabase, id: string): TransactionDetail | null {
  const row = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!row) return null;
  const tagIds = db
    .select({ tagId: transactionTags.tagId })
    .from(transactionTags)
    .where(eq(transactionTags.transactionId, id))
    .all()
    .map((r) => r.tagId);
  const fee =
    db
      .select({ amount: transactions.amount })
      .from(transactions)
      .where(eq(transactions.parentId, id))
      .get()?.amount ?? 0;
  return { ...row, tagIds, fee };
}

/** Bản chụp trước khi xoá — dùng để hoàn tác */
export type DeletedSnapshot = {
  transactions: Transaction[];
  tags: TransactionTag[];
  occurrences: ScheduleOccurrence[];
};

export function deleteTransactions(db: AppDatabase, ids: string[]): DeletedSnapshot {
  return db.transaction((tx) => {
    const children = tx
      .select()
      .from(transactions)
      .where(inArray(transactions.parentId, ids))
      .all();
    const parents = tx.select().from(transactions).where(inArray(transactions.id, ids)).all();
    const all = [...parents, ...children];
    const allIds = all.map((t) => t.id);
    const snapshot: DeletedSnapshot = {
      transactions: all,
      tags: allIds.length
        ? tx
            .select()
            .from(transactionTags)
            .where(inArray(transactionTags.transactionId, allIds))
            .all()
        : [],
      // Kỳ của lịch đã "thanh toán" bằng giao dịch này → quay lại trạng thái chưa trả
      occurrences: allIds.length
        ? tx
            .select()
            .from(scheduleOccurrences)
            .where(inArray(scheduleOccurrences.transactionId, allIds))
            .all()
        : [],
    };
    if (snapshot.occurrences.length) {
      tx.delete(scheduleOccurrences)
        .where(inArray(scheduleOccurrences.transactionId, allIds))
        .run();
    }
    if (allIds.length) tx.delete(transactions).where(inArray(transactions.id, allIds)).run();
    return snapshot;
  });
}

export const deleteTransaction = (db: AppDatabase, id: string) => deleteTransactions(db, [id]);

export function restoreSnapshot(db: AppDatabase, snapshot: DeletedSnapshot): void {
  db.transaction((tx) => {
    // Cha trước, con sau (khoá ngoại parent_id)
    const sorted = [...snapshot.transactions].sort(
      (a, b) => Number(!!a.parentId) - Number(!!b.parentId),
    );
    for (const t of sorted) tx.insert(transactions).values(t).onConflictDoNothing().run();
    if (snapshot.tags.length) {
      tx.insert(transactionTags).values(snapshot.tags).onConflictDoNothing().run();
    }
    for (const o of snapshot.occurrences) {
      tx.insert(scheduleOccurrences).values(o).onConflictDoNothing().run();
    }
  });
}
