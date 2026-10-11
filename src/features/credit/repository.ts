// Ghi kế hoạch trả góp cho một khoản mua bằng ví trả sau.
import { and, eq } from 'drizzle-orm';

import { accounts, schedules } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { saveSchedule } from '@/features/schedules/repository';
import { parseDate, type DateString } from '@/lib/date';

import { firstInstallmentDue } from './statement';

export type InstallmentInput = {
  /** Giao dịch chi gốc (ghi toàn bộ giá + phí) */
  transactionId: string;
  accountId: string;
  title: string;
  purchaseDate: DateString;
  months: number;
  perMonth: number;
};

/** Tạo (hoặc thay) kế hoạch trả góp gắn với khoản mua. Trả về id lịch. */
export function saveInstallmentPlan(db: AppDatabase, input: InstallmentInput): string {
  if (!Number.isInteger(input.months) || input.months < 2 || input.months > 60) {
    throw new Error('Số kỳ trả góp không hợp lệ.');
  }
  const account = db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();
  if (!account) throw new Error('Không tìm thấy ví.');
  const first = firstInstallmentDue(input.purchaseDate, account.statementDay, account.dueDay);
  const day = account.dueDay ?? parseDate(first).day;
  return db.transaction(() => {
    removeInstallmentPlans(db, input.transactionId);
    return saveSchedule(db, {
      type: 'expense',
      amount: input.perMonth,
      accountId: input.accountId,
      title: input.title,
      startDate: first,
      frequency: 'monthly',
      interval: 1,
      monthDay: day >= 31 ? -1 : day,
      endType: 'count',
      endCount: input.months,
      kind: 'installment',
      linkTransactionId: input.transactionId,
      autoPost: false,
      active: true,
    });
  });
}

export function removeInstallmentPlans(db: AppDatabase, transactionId: string): void {
  db.delete(schedules)
    .where(and(eq(schedules.kind, 'installment'), eq(schedules.linkTransactionId, transactionId)))
    .run();
}
