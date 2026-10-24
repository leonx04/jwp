// Thẻ ở Tổng quan những ngày đầu tháng: "Báo cáo tháng trước đã sẵn sàng". Ẩn sau khi bạn mở xem.
import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card, IconBadge } from '@/components/ui';
import { useSettings } from '@/features/settings';
import { elapsedDays, periodTitle } from '@/features/stats/periods';
import { periodContaining, todayVn } from '@/lib/date';
import { SWATCH } from '@/theme';

import { useMonthlyReport } from '../hooks';

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

export function ReportBanner() {
  const startDay = useSettings((s) => s.startDayOfMonth);
  const today = todayVn();
  const current = periodContaining(today, startDay);
  if (elapsedDays(current, today) > SHOW_DAYS) return null;
  return <Ready />;
}

/** Tách riêng để chỉ chạy truy vấn báo cáo khi đang trong những ngày đầu kỳ */
function Ready() {
  const { report, period } = useMonthlyReport(-1);
  const [seen, setSeen] = useState(readSeen);
  if (!report?.hasData || seen === period.start) return null;

  const open = () => {
    try {
      Storage.setItemSync(SEEN_KEY, period.start);
    } catch {
      // bỏ qua: thẻ sẽ hiện lại lần sau
    }
    setSeen(period.start);
    router.push({ pathname: '/report', params: { offset: '-1' } });
  };

  return (
    <Pressable accessibilityRole="button" onPress={open}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBadge icon="document-text-outline" color={SWATCH.violet} size={40} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium">
            Báo cáo {periodTitle('month', period).toLowerCase()} đã sẵn sàng
          </AppText>
          <AppText variant="caption" color="textMuted">
            Thu chi, so với tháng trước, khoản chi lớn — bấm để xem
          </AppText>
        </View>
        <AppText variant="label" color="primary">
          Xem ›
        </AppText>
      </Card>
    </Pressable>
  );
}
