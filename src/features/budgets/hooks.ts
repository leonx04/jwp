import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { useSettings } from '@/features/settings';
import { todayVn } from '@/lib/date';

import { listBudgets } from './queries';

export function useBudgets() {
  const startDayOfMonth = useSettings((s) => s.startDayOfMonth);
  return useLiveData(
    ['budgets', 'transactions'],
    () => listBudgets(db, { today: todayVn(), startDayOfMonth }),
    [startDayOfMonth],
  );
}
