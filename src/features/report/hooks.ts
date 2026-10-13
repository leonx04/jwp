import { useMemo } from 'react';

import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { todayVn } from '@/lib/date';

import { loadReportInput, reportPeriod } from './queries';
import { buildMonthlyReport } from './report';

/** Báo cáo của tháng `offset` (0 = tháng này, −1 = tháng trước…). `undefined` khi đang tải. */
export function useMonthlyReport(offset: number) {
  const format = useMoneyFormat();
  const startDayOfMonth = useSettings((s) => s.startDayOfMonth);
  const transfersAsIncomeExpense = useSettings((s) => s.transfersAsIncomeExpense);
  const today = todayVn();
  const period = reportPeriod(offset, today, startDayOfMonth);

  const { data: input } = useLiveData(
    ['transactions', 'categories', 'budgets'],
    () => loadReportInput(db, { period, today, transfersAsIncomeExpense, startDayOfMonth }),
    [period.start, period.end, today, transfersAsIncomeExpense, startDayOfMonth],
  );
  const report = useMemo(
    () => (input ? buildMonthlyReport({ ...input, format: format.money }) : undefined),
    [input, format],
  );
  return { report, period };
}
