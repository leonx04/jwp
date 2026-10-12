import { useMemo } from 'react';

import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import type { Forecast } from '@/features/forecast/forecast';
import { useSettings } from '@/features/settings';
import type { DateString } from '@/lib/date';

import { computeToday, type TodayStatus } from './compute';
import { getDaySpending } from './queries';

const TABLES = ['transactions', 'accounts', 'schedules'] as const;

/** Đã tiêu hôm nay — tự cập nhật khi thêm / sửa giao dịch */
export function useDaySpending(day: DateString | undefined) {
  return useLiveData(TABLES, () => (day ? getDaySpending(db, day) : null), [day]);
}

/**
 * Trạng thái "Hôm nay được tiêu" từ dự báo dòng tiền có sẵn (truyền vào từ useScheduleOverview,
 * không tính lại dự báo).
 */
export function useTodayStatus(
  overview: { today: DateString; forecast: Forecast } | undefined,
): TodayStatus | null {
  const safetyThreshold = useSettings((s) => s.safetyThreshold);
  const { data: spending } = useDaySpending(overview?.today);
  return useMemo(
    () =>
      overview && spending
        ? computeToday({
            today: overview.today,
            forecast: overview.forecast,
            spending,
            safetyThreshold,
          })
        : null,
    [overview, spending, safetyThreshold],
  );
}
