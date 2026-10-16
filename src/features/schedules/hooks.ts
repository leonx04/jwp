import { useMemo } from 'react';

import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { totalBalance } from '@/features/accounts/queries';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import { computeForecast } from '@/features/forecast/forecast';
import { useSettings } from '@/features/settings';
import { listTransactions } from '@/features/transactions/queries';
import { addDays, todayVn, vnDateToMs, type DateString } from '@/lib/date';

import { loadCalendarMonth } from './calendar';
import type { OccurrenceLookup } from './components/OccurrenceRow';
import { loadPlanned } from './planned';

const TABLES = ['schedules', 'schedule_occurrences', 'transactions', 'accounts'] as const;

/** Lịch + các kỳ còn phải xử lý (gồm bill ví trả sau) + dự trù dòng tiền N ngày tới, tự cập nhật */
export function useScheduleOverview(days: number) {
  const safetyThreshold = useSettings((s) => s.safetyThreshold);
  return useLiveData(TABLES, () => {
    const today = todayVn();
    const to = addDays(today, days);
    const { schedules, balances, credit, occurrences } = loadPlanned(db, {
      from: today,
      to,
      today,
    });

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

/** Số liệu lịch tháng (ngày 1 của tháng `month`), tự cập nhật khi có giao dịch / lịch thay đổi */
export function useCalendarMonth(month: DateString) {
  const transfersAsIncomeExpense = useSettings((s) => s.transfersAsIncomeExpense);
  return useLiveData(
    TABLES,
    () => loadCalendarMonth(db, month, { today: todayVn(), transfersAsIncomeExpense }),
    [month, transfersAsIncomeExpense],
  );
}

/** Tra tên / icon ví và danh mục cho các dòng kỳ lịch (OccurrenceRow) */
export function useScheduleLookup(): OccurrenceLookup {
  const { data: accounts } = useLiveData(['accounts'], () =>
    listAccounts(db, { includeArchived: true }),
  );
  const { data: categories } = useLiveData(['categories'], () => listCategories(db));
  return useMemo(() => {
    const acc = new Map((accounts ?? []).map((a) => [a.id, a]));
    const cat = new Map((categories ?? []).map((c) => [c.id, c]));
    return {
      accountName: (id: string) => acc.get(id)?.name ?? '?',
      accountIcon: (id: string) => acc.get(id)?.icon ?? null,
      category: (id: string | null) => (id ? (cat.get(id) ?? null) : null),
    };
  }, [accounts, categories]);
}

const DAY_TABLES = ['transactions', 'accounts', 'categories', 'tags', 'transaction_tags'] as const;

/** Giao dịch thực tế trong một ngày (giờ VN) */
export function useDayTransactions(day: DateString) {
  return useLiveData(
    DAY_TABLES,
    () => listTransactions(db, { from: vnDateToMs(day), to: vnDateToMs(addDays(day, 1)) }),
    [day],
  );
}
