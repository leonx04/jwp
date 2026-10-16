import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import { AmountText, Card, EmptyState, ListRow, Screen, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { formatDate, todayVn } from '@/lib/date';
import { describeRule, nextOccurrence } from '@/lib/recurrence';

import { scheduleRule } from '../occurrences';
import { listSchedules } from '../repository';

export function SchedulesScreen() {
  const { data: all = [] } = useLiveData(['schedules'], () => listSchedules(db));
  const today = todayVn();
  const active = all.filter((s) => s.active);
  const ended = all.filter((s) => !s.active);

  const row = (s: (typeof all)[number]) => {
    const next = s.active ? nextOccurrence(scheduleRule(s), today) : null;
    return (
      <ListRow
        key={s.id}
        icon={
          s.type === 'income'
            ? 'arrow-down-circle-outline'
            : s.type === 'transfer'
              ? 'swap-horizontal-outline'
              : 'arrow-up-circle-outline'
        }
        title={
          s.title ||
          (s.type === 'income' ? 'Khoản thu' : s.type === 'transfer' ? 'Chuyển khoản' : 'Khoản chi')
        }
        subtitle={`${describeRule(scheduleRule(s))}${next ? t(' · kỳ tới {false}', { false: formatDate(next, false) }) : ''}`}
        right={<AmountText amount={s.amount} flow={s.type} />}
        onPress={() => router.push({ pathname: '/schedule/edit', params: { id: s.id } })}
      />
    );
  };

  return (
    <Screen
      title="Tất cả lịch"
      headerRight={
        <IconButton
          icon="add"
          accessibilityLabel="Thêm lịch"
          onPress={() => router.push('/schedule/edit')}
        />
      }
    >
      {active.length ? (
        <Card style={{ gap: 0, paddingVertical: 6 }}>{active.map(row)}</Card>
      ) : (
        <Card>
          <EmptyState icon="calendar-outline" title="Chưa có lịch đang chạy" />
        </Card>
      )}
      {ended.length ? (
        <View style={{ gap: 12 }}>
          <SectionTitle tone="section">Đã kết thúc</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: 6 }}>{ended.map(row)}</Card>
        </View>
      ) : null}
    </Screen>
  );
}
