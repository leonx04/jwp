import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { useSettings } from '@/features/settings';
import { todayVn, type DateString } from '@/lib/date';

import { getBudgetDetail, listBudgets } from './queries';

export function useBudgets() {
  const startDayOfMonth = useSettings((s) => s.startDayOfMonth);
  return useLiveData(
    ['budgets', 'transactions'],
    () => listBudgets(db, { today: todayVn(), startDayOfMonth }),
    [startDayOfMonth],
  );
}

/** Chi tiết một ngân sách ở kỳ chứa `anchor` (bỏ trống = kỳ hiện tại) */
export function useBudgetDetail(id: string | undefined, anchor?: DateString) {
  const startDayOfMonth = useSettings((s) => s.startDayOfMonth);
  return useLiveData(
    ['budgets', 'transactions', 'categories', 'accounts'],
    () => (id ? getBudgetDetail(db, { id, today: todayVn(), startDayOfMonth, anchor }) : null),
    [id, anchor, startDayOfMonth],
  );
}
