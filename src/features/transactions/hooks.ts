// Hook dữ liệu giao dịch tự cập nhật khi DB thay đổi.
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';

import { getPeriodSummary, listTransactions, type TransactionFilter } from './queries';

const TABLES = ['transactions', 'transaction_tags', 'accounts', 'categories', 'tags'] as const;

export function useTransactions(filter: TransactionFilter) {
  return useLiveData(TABLES, () => listTransactions(db, filter), [JSON.stringify(filter)]);
}

export function usePeriodSummary(params: Parameters<typeof getPeriodSummary>[1]) {
  return useLiveData(['transactions'], () => getPeriodSummary(db, params), [
    JSON.stringify(params),
  ]);
}
