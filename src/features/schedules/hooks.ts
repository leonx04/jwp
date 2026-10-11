import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { getAccountBalances, totalBalance } from '@/features/accounts/queries';
import { creditBillOccurrences } from '@/features/credit/bills';
import { getCreditSummaries } from '@/features/credit/queries';
import { computeForecast } from '@/features/forecast/forecast';
import { useSettings } from '@/features/settings';
import { addDays, todayVn } from '@/lib/date';

import { expandOccurrences } from './occurrences';
import { listOverrides, listSchedules } from './repository';

const TABLES = ['schedules', 'schedule_occurrences', 'transactions', 'accounts'] as const;

/** Lịch + các kỳ còn phải xử lý (gồm bill ví trả sau) + dự trù dòng tiền N ngày tới, tự cập nhật */
export function useScheduleOverview(days: number) {
  const safetyThreshold = useSettings((s) => s.safetyThreshold);
  return useLiveData(TABLES, () => {
    const today = todayVn();
    const to = addDays(today, days);
    const schedules = listSchedules(db);
    const overrides = listOverrides(db);
    const balances = getAccountBalances(db);
    const credit = getCreditSummaries(db, today);

    // Ví trả sau chưa chọn ví trả bill → tạm tính trừ vào ví (tính vào tổng) nhiều tiền nhất
    const creditIds = new Set(credit.map((c) => c.account.id));
    const fallbackPayer =
      balances
        .filter((b) => b.includeInBalance && !creditIds.has(b.id))
        .sort((a, b) => b.balance - a.balance)[0]?.id ?? null;

    const occurrences = [
      ...expandOccurrences(schedules, overrides, { from: today, to, today }),
      ...creditBillOccurrences(credit, { today, to, fallbackPayer }),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.scheduleId.localeCompare(b.scheduleId));

    const forecast = computeForecast({
      today,
      days,
      startBalance: totalBalance(balances),
      accountBalances: new Map(balances.map((b) => [b.id, b.balance])),
      includedAccounts: new Set(balances.filter((b) => b.includeInBalance).map((b) => b.id)),
      occurrences,
      safetyThreshold,
    });
    return { today, schedules, occurrences, forecast, balances, credit };
  }, [days, safetyThreshold]);
}
