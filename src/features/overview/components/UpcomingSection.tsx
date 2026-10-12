// "Sắp tới 7 ngày" trên Tổng quan — nhận dữ liệu từ useScheduleOverview của màn (không tự tính lại
// dự báo như UpcomingCard cũ) + cảnh báo nếu dòng tiền 30 ngày tới bị âm.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import type { Forecast } from '@/features/forecast/forecast';
import { OccurrenceRow } from '@/features/schedules/components/OccurrenceRow';
import type { Occurrence } from '@/features/schedules/occurrences';
import { useMoneyFormat } from '@/features/settings';
import { addDays, formatDate, type DateString } from '@/lib/date';
import { useTheme } from '@/theme';

type UpcomingSectionProps = {
  today: DateString;
  occurrences: readonly Occurrence[];
  forecast: Forecast;
};

export const UpcomingSection = memo(function UpcomingSection({
  today,
  occurrences,
  forecast,
}: UpcomingSectionProps) {
  const { data: accounts } = useLiveData(['accounts'], () =>
    listAccounts(db, { includeArchived: true }),
  );
  const { data: categories } = useLiveData(['categories'], () => listCategories(db));
  const format = useMoneyFormat();
  const { colors } = useTheme();

  const lookup = useMemo(() => {
    const acc = new Map((accounts ?? []).map((a) => [a.id, a]));
    const cat = new Map((categories ?? []).map((c) => [c.id, c]));
    return {
      accountName: (id: string) => acc.get(id)?.name ?? '?',
      accountIcon: (id: string) => acc.get(id)?.icon ?? null,
      category: (id: string | null) => (id ? (cat.get(id) ?? null) : null),
    };
  }, [accounts, categories]);

  const week = addDays(today, 7);
  const soon = useMemo(
    () => occurrences.filter((o) => o.status === 'overdue' || o.date <= week).slice(0, 4),
    [occurrences, week],
  );
  const negative = forecast.firstNegative;
  if (!soon.length && !negative) return null;

  return (
    <View style={{ gap: 12 }}>
      <SectionTitle
        tone="section"
        right={
          <Pressable onPress={() => router.navigate('/schedule')} hitSlop={8}>
            <AppText variant="label" color="primary">
              Xem lịch
            </AppText>
          </Pressable>
        }
      >
        Sắp tới 7 ngày
      </SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {negative ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <Ionicons name="warning" size={18} color={colors.expense} />
            <AppText variant="caption" color="expense" style={{ flex: 1 }}>
              Dự kiến âm {format.money(-negative.balance)} vào {formatDate(negative.date, false)}{' '}
              nếu không có khoản thu
            </AppText>
          </View>
        ) : null}
        {soon.map((o) => (
          <OccurrenceRow key={`${o.scheduleId}-${o.dueDate}`} occurrence={o} lookup={lookup} />
        ))}
      </Card>
    </View>
  );
});
