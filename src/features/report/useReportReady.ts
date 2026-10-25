// Những ngày đầu tháng: "Báo cáo tháng trước đã sẵn sàng" (một dòng trong Việc cần làm). Ẩn sau khi bạn mở xem.
import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useState } from 'react';

import { useSettings } from '@/features/settings';
import { elapsedDays, periodTitle } from '@/features/stats/periods';
import { periodContaining, todayVn } from '@/lib/date';

import { useMonthlyReport } from './hooks';

const SEEN_KEY = 'jwp.reportSeen';
/** Hiện thẻ trong ngần này ngày đầu của kỳ mới */
const SHOW_DAYS = 7;

const readSeen = (): string | null => {
  try {
    return Storage.getItemSync(SEEN_KEY);
  } catch {
    return null;
  }
};

/** Báo cáo tháng trước sẵn sàng và chưa mở xem → { month, open }, ngược lại null */
export function useReportReady(): { month: string; open: () => void } | null {
  const startDay = useSettings((s) => s.startDayOfMonth);
  const today = todayVn();
  const fresh = elapsedDays(periodContaining(today, startDay), today) <= SHOW_DAYS;
  // Chỉ chạy truy vấn báo cáo khi đang trong những ngày đầu kỳ
  const { report, period } = useMonthlyReport(-1, fresh);
  const [seen, setSeen] = useState(readSeen);
  if (!fresh || !report?.hasData || seen === period.start) return null;
  return {
    month: periodTitle('month', period).toLowerCase(),
    open: () => {
      try {
        Storage.setItemSync(SEEN_KEY, period.start);
      } catch {
        // bỏ qua: thẻ sẽ hiện lại lần sau
      }
      setSeen(period.start);
      router.push({ pathname: '/report', params: { offset: '-1' } });
    },
  };
}
