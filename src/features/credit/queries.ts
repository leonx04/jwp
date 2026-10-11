// Đọc dữ liệu ví trả sau từ DB → trạng thái sao kê, kế hoạch trả góp.
import { and, eq, sql } from 'drizzle-orm';

import { accounts, schedules, transactions, type Account } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { scheduleRule } from '@/features/schedules/occurrences';
import { addMonths, toVnDate, type DateString } from '@/lib/date';
import { generateOccurrences } from '@/lib/recurrence';

import { computeCreditStatus, type AccountMovement, type CreditStatus, type InstallmentPlan } from './statement';

export type InstallmentInfo = InstallmentPlan & {
  scheduleId: string;
  transactionId: string;
  title: string;
  months: number;
  /** Số kỳ đã tới hạn (≤ hôm nay) */
  dueCount: number;
  nextDueDate: DateString | null;
};

export type CreditSummary = {
  account: Account;
  status: CreditStatus;
  installments: InstallmentInfo[];
};

/** Biến động số dư của một ví: chi/chuyển đi (−), thu/nhận chuyển (+) */
export function getAccountMovements(db: AppDatabase, accountId: string): AccountMovement[] {
  return db.all<AccountMovement>(sql`
    SELECT ${transactions.date} AS date,
      (CASE WHEN ${transactions.accountId} = ${accountId}
        THEN (CASE ${transactions.type} WHEN 'income' THEN ${transactions.amount} ELSE -${transactions.amount} END)
        ELSE 0 END)
      + (CASE WHEN ${transactions.toAccountId} = ${accountId}
        THEN COALESCE(${transactions.toAmount}, ${transactions.amount}) ELSE 0 END) AS delta
    FROM ${transactions}
    WHERE ${transactions.accountId} = ${accountId} OR ${transactions.toAccountId} = ${accountId}
  `);
}

/** Kế hoạch trả góp của ví (bỏ qua kế hoạch mà khoản mua gốc đã bị xoá) */
export function getInstallments(db: AppDatabase, accountId: string, today: DateString): InstallmentInfo[] {
  const rows = db
    .select({ schedule: schedules, purchasedAt: transactions.date })
    .from(schedules)
    .innerJoin(transactions, eq(transactions.id, schedules.linkTransactionId))
    .where(
      and(eq(schedules.kind, 'installment'), eq(schedules.accountId, accountId), eq(schedules.active, true)),
    )
    .all();
  return rows.map(({ schedule, purchasedAt }) => {
    const months = schedule.endCount ?? 1;
    const dueDates = generateOccurrences(
      scheduleRule(schedule),
      schedule.startDate,
      addMonths(schedule.startDate, months + 1),
    );
    const dueCount = dueDates.filter((d) => d <= today).length;
    return {
      scheduleId: schedule.id,
      transactionId: schedule.linkTransactionId!,
      title: schedule.title,
      months,
      purchaseDate: toVnDate(purchasedAt),
      amount: schedule.amount,
      dueDates,
      dueCount,
      nextDueDate: dueDates.find((d) => d > today) ?? null,
    };
  });
}

export function getCreditSummary(db: AppDatabase, account: Account, today: DateString): CreditSummary {
  const installments = getInstallments(db, account.id, today);
  const status = computeCreditStatus({
    today,
    creditLimit: account.creditLimit,
    statementDay: account.statementDay,
    dueDay: account.dueDay,
    movements: getAccountMovements(db, account.id),
    installments,
  });
  return { account, status, installments };
}

/** Tất cả ví trả sau đang dùng */
export function getCreditSummaries(db: AppDatabase, today: DateString): CreditSummary[] {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.isCredit, true), eq(accounts.archived, false)))
    .orderBy(accounts.orderNum)
    .all()
    .map((account) => getCreditSummary(db, account, today));
}
