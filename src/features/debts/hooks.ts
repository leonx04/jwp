import { useMemo } from 'react';

import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { todayVn } from '@/lib/date';

import { summarize } from './compute';
import { getDebtItem, groupByPerson, listDebtProposals, listDebts } from './queries';

const TABLES = ['debts', 'debt_records', 'people'] as const;

export function useDebts() {
  const { data } = useLiveData(TABLES, () => listDebts(db, todayVn()));
  return useMemo(
    () => ({
      loaded: data !== undefined,
      items: data ?? [],
      groups: groupByPerson(data ?? []),
      summary: summarize(data ?? []),
    }),
    [data],
  );
}

export function useDebt(id: string | undefined) {
  return useLiveData(TABLES, () => (id ? getDebtItem(db, id, todayVn()) : null), [id]);
}

export function useDebtProposals() {
  return useLiveData(['transactions', 'debts', 'categories'], () => listDebtProposals(db));
}
