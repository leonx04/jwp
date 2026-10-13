import { asc, eq, sql } from 'drizzle-orm';

import { goals, type Goal } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { DateString } from '@/lib/date';
import { createId } from '@/lib/id';
import { MAX_AMOUNT } from '@/lib/money';

export class GoalValidationError extends Error {}

export type GoalInput = {
  id?: string;
  name: string;
  targetAmount: number;
  /** Ví làm quỹ (tiến độ = số dư ví). null = nhập tay */
  accountId?: string | null;
  /** Số đã góp khi không gắn ví */
  savedAmount?: number;
  deadline?: DateString | null;
  color: string;
  note?: string | null;
};

export function listGoalRows(db: AppDatabase): Goal[] {
  return db.select().from(goals).orderBy(asc(goals.orderNum), asc(goals.name)).all();
}

export function saveGoal(db: AppDatabase, input: GoalInput): string {
  const name = input.name.trim();
  if (!name) throw new GoalValidationError('Chưa đặt tên mục tiêu.');
  if (!Number.isInteger(input.targetAmount) || input.targetAmount <= 0) {
    throw new GoalValidationError('Số tiền mục tiêu phải lớn hơn 0.');
  }
  if (input.targetAmount > MAX_AMOUNT) throw new GoalValidationError('Số tiền quá lớn.');
  const saved = input.savedAmount ?? 0;
  if (!Number.isInteger(saved) || saved < 0)
    throw new GoalValidationError('Số đã góp không hợp lệ.');
  const values = {
    name,
    targetAmount: input.targetAmount,
    accountId: input.accountId ?? null,
    savedAmount: input.accountId ? 0 : saved,
    deadline: input.deadline ?? null,
    color: input.color,
    note: input.note?.trim() || null,
  };
  if (input.id) {
    db.update(goals)
      .set({ ...values, updatedAt: Date.now() })
      .where(eq(goals.id, input.id))
      .run();
    return input.id;
  }
  const id = createId();
  const next = db
    .select({ n: sql<number>`coalesce(max(${goals.orderNum}), -1) + 1` })
    .from(goals)
    .get();
  db.insert(goals)
    .values({ id, ...values, orderNum: next?.n ?? 0 })
    .run();
  return id;
}

export function deleteGoal(db: AppDatabase, id: string): void {
  db.delete(goals).where(eq(goals.id, id)).run();
}
