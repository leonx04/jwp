import { asc, eq, sql } from 'drizzle-orm';

import { budgets, type Budget } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { createId } from '@/lib/id';
import { MAX_AMOUNT } from '@/lib/money';
import type { WeekendRule } from '@/lib/recurrence';

import { serializeIdList } from './compute';

export class BudgetValidationError extends Error {}

export type BudgetInput = {
  id?: string;
  name: string;
  /** Hạn mức mỗi kỳ (đồng) */
  amount: number;
  /** Trống = mọi khoản chi */
  categoryIds?: readonly string[];
  /** Trống = mọi ví */
  accountIds?: readonly string[];
  /** Ngày bắt đầu chu kỳ riêng (1–31). Trống / null = theo ngày bắt đầu tháng chung */
  startDay?: number | null;
  /** Ngày bắt đầu rơi vào cuối tuần: giữ nguyên / lùi về thứ Sáu / dời sang thứ Hai */
  weekendRule?: WeekendRule;
};

export function listBudgetRows(db: AppDatabase): Budget[] {
  return db.select().from(budgets).orderBy(asc(budgets.orderNum), asc(budgets.name)).all();
}

export function saveBudget(db: AppDatabase, input: BudgetInput): string {
  const name = input.name.trim();
  if (!name) throw new BudgetValidationError('Chưa đặt tên ngân sách.');
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new BudgetValidationError('Hạn mức phải lớn hơn 0.');
  }
  if (input.amount > MAX_AMOUNT) throw new BudgetValidationError('Hạn mức quá lớn.');
  const startDay = input.startDay ?? null;
  if (startDay !== null && (!Number.isInteger(startDay) || startDay < 1 || startDay > 31)) {
    throw new BudgetValidationError('Ngày bắt đầu chu kỳ phải từ 1 đến 31.');
  }
  const values = {
    name,
    startDay,
    weekendRule: startDay === null ? ('none' as const) : (input.weekendRule ?? 'none'),
    amount: input.amount,
    categoryIds: serializeIdList(input.categoryIds ?? []),
    accountIds: serializeIdList(input.accountIds ?? []),
  };
  if (input.id) {
    db.update(budgets)
      .set({ ...values, updatedAt: Date.now() })
      .where(eq(budgets.id, input.id))
      .run();
    return input.id;
  }
  const id = createId();
  const next = db
    .select({ n: sql<number>`coalesce(max(${budgets.orderNum}), -1) + 1` })
    .from(budgets)
    .get();
  db.insert(budgets)
    .values({ id, ...values, orderNum: next?.n ?? 0 })
    .run();
  return id;
}

export function deleteBudget(db: AppDatabase, id: string): void {
  db.delete(budgets).where(eq(budgets.id, id)).run();
}
