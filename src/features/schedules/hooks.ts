import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { getAccountBalances, totalBalance } from '@/features/accounts/queries';
import { computeForecast } from '@/features/forecast/forecast';
import { useSettings } from '@/features/settings';
import { addDays, todayVn } from '@/lib/date';

import { expandOccurrences } from './occurrences';
import { listOverrides, listSchedules } from './repository';

const TABLES = ['schedules', 'schedule_occurrences', 'transactions', 'accounts'] as const;

/** Lịch + các kỳ còn phải xử lý + dự trù dòng tiền N ngày tới, tự cập nhật */
export function useScheduleOverview(days: number) {
  const safetyThreshold = useSettings((s) => s.safetyThreshold);
  return useLiveData(TABLES, () => {
    const today = todayVn();
    const schedules = listSchedules(db);
    const overrides = listOverrides(db);
    const occurrences = expandOccurrences(schedules, overrides, {
      from: today,
      to: addDays(today, days),
      today,
    });
    const balances = getAccountBalances(db);
    const forecast = computeForecast({
      today,
      days,
      startBalance: totalBalance(balances),
      accountBalances: new Map(balances.map((b) => [b.id, b.balance])),
      includedAccounts: new Set(balances.filter((b) => b.includeInBalance).map((b) => b.id)),
      occurrences,
      safetyThreshold,
    });
    return { today, schedules, occurrences, forecast, balances };
  }, [days, safetyThreshold]);
}
