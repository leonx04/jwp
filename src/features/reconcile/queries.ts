import { and, gte, isNull } from 'drizzle-orm';

import { transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { ReconcileTx } from './hints';

/** Số ngày giao dịch gần đây dùng để đoán nguyên nhân chênh lệch */
export const RECONCILE_WINDOW_DAYS = 60;

export function listRecentForReconcile(db: AppDatabase, now = Date.now()): ReconcileTx[] {
  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      title: transactions.title,
      accountId: transactions.accountId,
      toAccountId: transactions.toAccountId,
      isAdjustment: transactions.isAdjustment,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.parentId),
        gte(transactions.date, now - RECONCILE_WINDOW_DAYS * 86_400_000),
      ),
    )
    .all();
}
