// Ảnh chụp tài chính dùng chung: số dư ví + mọi khoản dự kiến (lịch, bill ví trả sau, kỳ trả nợ có lãi)
// + dự trù dòng tiền N ngày tới. Một nguồn cho Tổng quan, Lịch, widget và báo cáo buổi sáng, để các nơi
// luôn ra cùng một con số. Không dùng React → chạy được cả trong tác vụ nền.
import type { AppDatabase } from '@/db/types';
import { totalBalance } from '@/features/accounts/queries';
import { isLoanInstallment } from '@/features/debts/loanOccurrences';
import type { Occurrence } from '@/features/schedules/occurrences';
import { loadPlanned } from '@/features/schedules/planned';
import { addDays, type DateString } from '@/lib/date';

import { computeForecast } from './forecast';

/** Bảng DB mà ảnh chụp đọc — dùng cho useLiveData để tự tính lại khi có thay đổi */
export const SNAPSHOT_TABLES = [
  'schedules',
  'schedule_occurrences',
  'transactions',
  'accounts',
  'debts',
  'debt_records',
  'debt_terms',
  'people',
] as const;

/**
 * Khoản tính vào dự trù. Kỳ người khác trả mình (cho vay theo kỳ) chỉ hiện trong Lịch, không cộng vào
 * dự trù: tiền chưa chắc về đúng hạn, và không được coi là "kỳ nhận tiền" khi chia mức chi mỗi ngày.
 */
export const countsInForecast = (o: Occurrence) =>
  !(o.type === 'income' && isLoanInstallment(o.scheduleId));

export function loadFinancialSnapshot(
  db: AppDatabase,
  {
    today,
    days,
    safetyThreshold = 0,
  }: { today: DateString; days: number; safetyThreshold?: number },
) {
  const { schedules, balances, credit, occurrences } = loadPlanned(db, {
    from: today,
    to: addDays(today, days),
    today,
  });
  const forecast = computeForecast({
    today,
    days,
    startBalance: totalBalance(balances),
    accountBalances: new Map(balances.map((b) => [b.id, b.balance])),
    includedAccounts: new Set(balances.filter((b) => b.includeInBalance).map((b) => b.id)),
    occurrences: occurrences.filter(countsInForecast),
    safetyThreshold,
  });
  return { today, days, schedules, balances, credit, occurrences, forecast };
}

export type FinancialSnapshot = ReturnType<typeof loadFinancialSnapshot>;
