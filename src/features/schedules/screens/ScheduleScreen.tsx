// Tab Lịch: dự trù dòng tiền + các kỳ thu/chi sắp tới.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BalanceLineChart } from '@/components/charts/BalanceLineChart';
import { IconButton } from '@/components/glass/IconButton';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionTitle,
  SegmentedControl,
} from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { addDays, formatDate, formatRelativeDue } from '@/lib/date';
import { rgba, useTheme } from '@/theme';

import { MonthCalendar } from '../components/MonthCalendar';
import { OccurrenceRow, occurrenceTitle } from '../components/OccurrenceRow';
import { useScheduleOverview } from '../hooks';
import type { Occurrence } from '../occurrences';

const VIEW_OPTIONS = [
  { value: 'forecast', label: 'Dự trù' },
  { value: 'month', label: 'Lịch tháng' },
] as const;

const RANGE_OPTIONS = [
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: '90', label: '90 ngày' },
] as const;

export function ScheduleScreen() {
  const [view, setView] = useState<'forecast' | 'month'>('forecast');
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const days = Number(range);
  const { data } = useScheduleOverview(days);
  const { data: accounts = [] } = useLiveData(['accounts'], () =>
    listAccounts(db, { includeArchived: true }),
  );
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));
  const format = useMoneyFormat();
  const { colors } = useTheme();
  const safetyThreshold = useSettings((s) => s.safetyThreshold);

  const lookup = useMemo(() => {
    const acc = new Map(accounts.map((a) => [a.id, a]));
    const cat = new Map(categories.map((c) => [c.id, c]));
    return {
      accountName: (id: string) => acc.get(id)?.name ?? '?',
      accountIcon: (id: string) => acc.get(id)?.icon ?? null,
      category: (id: string | null) => (id ? (cat.get(id) ?? null) : null),
    };
  }, [accounts, categories]);

  const groups = useMemo(() => {
    if (!data) return [];
    const { today, occurrences } = data;
    const week = addDays(today, 7);
    const by = (predicate: (o: Occurrence) => boolean) => occurrences.filter(predicate);
    return [
      { title: 'Quá hạn', items: by((o) => o.status === 'overdue') },
      { title: 'Hôm nay', items: by((o) => o.status === 'due') },
      { title: '7 ngày tới', items: by((o) => o.status === 'upcoming' && o.date <= week) },
      { title: 'Sau đó', items: by((o) => o.status === 'upcoming' && o.date > week) },
    ].filter((g) => g.items.length);
  }, [data]);

  const headerRight = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <IconButton
        icon="list-outline"
        accessibilityLabel="Tất cả lịch"
        onPress={() => router.push('/schedules')}
      />
      <IconButton
        icon="add"
        accessibilityLabel="Thêm lịch"
        onPress={() => router.push('/schedule/edit')}
      />
    </View>
  );

  if (!data)
    return (
      <Screen tabBar largeTitle title="Lịch thu chi" headerRight={headerRight}>
        {null}
      </Screen>
    );
  const { forecast, schedules } = data;
  const accountName = lookup.accountName;

  return (
    <Screen tabBar largeTitle title="Lịch thu chi" headerRight={headerRight}>
      <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
      {view === 'month' ? <MonthCalendar lookup={lookup} /> : null}
      {view === 'month' ? null : (
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
      )}

      {/* Dự trù */}
      {view === 'month' ? null : (
        <>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              }}
            >
              <View>
                <AppText variant="label" color="textMuted">
                  SỐ DƯ DỰ KIẾN SAU {days} NGÀY
                </AppText>
                <AppText
                  variant="display"
                  color={forecast.endBalance < 0 ? 'expense' : 'text'}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {format.money(forecast.endBalance)}
                </AppText>
              </View>
            </View>
            <BalanceLineChart points={forecast.points} safetyThreshold={safetyThreshold} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Stat
                label="Thu dự kiến"
                value={`+${format.compact(forecast.totalIncome)}`}
                color={colors.income}
              />
              <Stat
                label="Chi dự kiến"
                value={`−${format.compact(forecast.totalExpense)}`}
                color={colors.expense}
              />
              <Stat
                label={`Thấp nhất ${formatDate(forecast.lowest.date, false)}`}
                value={format.compact(forecast.lowest.balance)}
                color={forecast.lowest.balance < 0 ? colors.expense : colors.text}
              />
            </View>
          </Card>

          {/* Cảnh báo */}
          {forecast.firstNegative ? (
            <Alert
              tone="expense"
              icon="warning"
              text={`Ngày ${formatDate(forecast.firstNegative.date, false)} số dư dự kiến âm ${format.money(-forecast.firstNegative.balance)}`}
            />
          ) : forecast.firstBelowSafety ? (
            <Alert
              tone="warning"
              icon="alert-circle"
              text={`Ngày ${formatDate(forecast.firstBelowSafety.date, false)} số dư xuống dưới ngưỡng an toàn ${format.money(safetyThreshold)}`}
            />
          ) : null}
          {forecast.walletWarnings.slice(0, 3).map((w) => (
            <Alert
              key={`${w.occurrence.scheduleId}-${w.occurrence.dueDate}`}
              tone="warning"
              icon="wallet"
              text={`${occurrenceTitle(w.occurrence, lookup)} ${format.money(w.occurrence.amount)} (${formatRelativeDue(w.occurrence.date)}) trả từ ${accountName(w.accountId)} nhưng ví sẽ thiếu ${format.money(-w.balanceAfter)}`}
            />
          ))}

          {/* Chi tiêu an toàn */}
          {forecast.nextIncome ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: rgba(colors.income, 0.18),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="shield-checkmark" size={22} color={colors.income} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" color="textMuted">
                  Có thể chi mỗi ngày đến kỳ thu {formatDate(forecast.nextIncome.date, false)} (còn{' '}
                  {forecast.safeDays} ngày)
                </AppText>
                <AppText variant="title" color={forecast.safeDailySpend > 0 ? 'income' : 'expense'}>
                  ~{format.money(forecast.safeDailySpend)}
                </AppText>
              </View>
            </Card>
          ) : (
            <Card>
              <AppText color="textMuted">
                Chưa có lịch khoản thu nào trong {days} ngày tới. Thêm lịch nhận lương để JWP tính
                được mức chi an toàn mỗi ngày.
              </AppText>
              <Button
                title="Thêm lịch nhận lương"
                icon="cash-outline"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/schedule/edit', params: { type: 'income' } })
                }
              />
            </Card>
          )}

          {/* Các kỳ */}
          {groups.length ? (
            groups.map((g) => (
              <View key={g.title} style={{ gap: 10 }}>
                <SectionTitle tone="section">{`${g.title} · ${g.items.length}`}</SectionTitle>
                <Card style={{ gap: 0, paddingVertical: 4 }}>
                  {g.items.slice(0, 30).map((o) => (
                    <OccurrenceRow
                      key={`${o.scheduleId}-${o.dueDate}`}
                      occurrence={o}
                      lookup={lookup}
                    />
                  ))}
                </Card>
              </View>
            ))
          ) : (
            <Card>
              <EmptyState
                icon="calendar-outline"
                title={schedules.length ? 'Không có khoản nào sắp tới' : 'Chưa có lịch thu chi'}
                description="Đặt lịch cho lương, tiền nhà, trả góp, điện nước... để được nhắc và dự trù dòng tiền."
                action={
                  <Button
                    title="Thêm lịch"
                    icon="add"
                    onPress={() => router.push('/schedule/edit')}
                  />
                }
              />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ gap: 2, flexShrink: 1 }}>
      <AppText variant="label" color="textMuted" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="bodyMedium" style={{ color, fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
    </View>
  );
}

function Alert({
  tone,
  icon,
  text,
}: {
  tone: 'expense' | 'warning';
  icon: 'warning' | 'alert-circle' | 'wallet';
  text: string;
}) {
  const { colors } = useTheme();
  const color = colors[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        padding: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: rgba(color, 0.4),
        backgroundColor: rgba(color, colors.dark ? 0.16 : 0.1),
      }}
    >
      <Ionicons name={icon} size={20} color={color} />
      <AppText variant="bodyMedium" style={{ flex: 1, color }}>
        {text}
      </AppText>
    </View>
  );
}
