import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { todayVn } from '@/lib/date';

import { listRecurringSuggestions } from './repository';

export function useRecurringSuggestions() {
  return useLiveData(['transactions', 'schedules'], () => listRecurringSuggestions(db, todayVn()));
}
