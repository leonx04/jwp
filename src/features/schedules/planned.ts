// Các khoản dự kiến trong một khoảng ngày: kỳ của lịch thu chi + kỳ bill ví trả sau.
// Dùng chung cho dự trù dòng tiền (hooks.ts) và lịch tháng (calendar.ts).
import { getAccountBalances, type AccountBalance } from '@/features/accounts/queries';
import { creditBillOccurrences, dropCoveredBills } from '@/features/credit/bills';
import { getCreditSummaries, type CreditSummary } from '@/features/credit/queries';
import type { AppDatabase } from '@/db/types';
import type { DateString } from '@/lib/date';

import { expandOccurrences, type Occurrence } from './occurrences';
import { listOverrides, listSchedules } from './repository';

/**
 * Ví trả sau chưa chọn ví trả bill → tạm tính trừ vào ví (tính vào tổng) đang nhiều tiền nhất.
 */
export function fallbackBillPayer(
  balances: readonly AccountBalance[],
  credit: readonly CreditSummary[],
): string | null {
  const creditIds = new Set(credit.map((c) => c.account.id));
  return (
    balances
      .filter((b) => b.includeInBalance && !creditIds.has(b.id))
      .sort((a, b) => b.balance - a.balance)[0]?.id ?? null
  );
}

export const byOccurrenceDate = (a: Occurrence, b: Occurrence) =>
  a.date.localeCompare(b.date) || a.scheduleId.localeCompare(b.scheduleId);

/**
 * Kỳ lịch + kỳ bill trong [from, to] (kỳ quá hạn chưa xử lý luôn kèm theo, kể cả trước `from`).
 * `includeResolved`: kèm kỳ đã trả / bỏ qua trong khoảng.
 */
export function loadPlanned(
  db: AppDatabase,
  {
    from,
    to,
    today,
    includeResolved = false,
  }: { from: DateString; to: DateString; today: DateString; includeResolved?: boolean },
) {
  const schedules = listSchedules(db);
  const overrides = listOverrides(db);
  const balances = getAccountBalances(db);
  const credit = getCreditSummaries(db, today);
  const real = expandOccurrences(schedules, overrides, { from, to, today, includeResolved });
  const bills = dropCoveredBills(
    real,
    creditBillOccurrences(credit, {
      today,
      to,
      fallbackPayer: fallbackBillPayer(balances, credit),
    }),
  );
  const occurrences = [...real, ...bills].sort(byOccurrenceDate);
  return { schedules, balances, credit, occurrences };
}
