import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';

import { getAccountBalances } from '../queries';

const TABLES = ['accounts', 'transactions'] as const;

/** Số dư các ví, tự cập nhật khi có giao dịch / ví thay đổi */
export function useAccountBalances() {
  return useLiveData(TABLES, () => getAccountBalances(db));
}
