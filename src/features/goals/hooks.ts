import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { todayVn } from '@/lib/date';

import { listGoals } from './queries';

export function useGoals() {
  return useLiveData(['goals', 'accounts', 'transactions'], () => listGoals(db, todayVn()));
}
