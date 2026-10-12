// Lịch tháng: lưới 6 tuần, chấm màu thu / chi / bill, âm lịch nhỏ; bấm ngày để xem chi tiết.
import { memo, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import { AppText, Card, SectionTitle } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { useTransactions } from '@/features/transactions/hooks';
import {
  WEEKDAY_SHORT,
  addDays,
  formatDate,
  todayVn,
  vnDateToMs,
  type DateString,
} from '@/lib/date';
import { rgba, useTheme } from '@/theme';

import { formatMonthTitle, shiftMonth, type CalendarDay } from '../calendar';
import { useCalendarMonth } from '../hooks';
import { OccurrenceRow, type OccurrenceLookup } from './OccurrenceRow';

const CELL_HEIGHT = 56;

export function MonthCalendar({ lookup }: { lookup: OccurrenceLookup }) {
  const [month, setMonth] = useState<DateString>(() => todayVn());
  const [selected, setSelected] = useState<DateString>(() => todayVn());
  const { data } = useCalendarMonth(month);
  const format = useMoneyFormat();
  const { colors } = useTheme();

  const title = formatMonthTitle(data?.grid.month ?? month);
  const rows = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: 6 }, (_, i) => data.days.slice(i * 7, i * 7 + 7));
  }, [data]);
  const day = data?.days.find((d) => d.date === selected);
  // Giao dịch thật của ngày chọn (bấm vào để sửa)
  const { data: dayTransactions = [] } = useTransactions({
    from: vnDateToMs(selected),
    to: vnDateToMs(addDays(selected, 1)),
  });

  const go = (offset: number) => {
    const next = shiftMonth(data?.grid.month ?? month, offset);
    setMonth(next);
    setSelected(next);
  };

  return (
    <>
      <Card style={{ gap: 12 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <IconButton icon="chevron-back" accessibilityLabel="Tháng trước" onPress={() => go(-1)} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMonth(todayVn());
              setSelected(todayVn());
            }}
          >
            <AppText variant="heading">{title}</AppText>
          </Pressable>
          <IconButton icon="chevron-forward" accessibilityLabel="Tháng sau" onPress={() => go(1)} />
        </View>

        {data ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Summary
              label="Đã thu"
              value={`+${format.compact(data.summary.income)}`}
              color={colors.income}
            />
            <Summary
              label="Đã chi"
              value={`−${format.compact(data.summary.expense)}`}
              color={colors.expense}
            />
            <Summary
              label="Dự kiến chi"
              value={`−${format.compact(data.summary.plannedExpense)}`}
              color={colors.warning}
            />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row' }}>
          {WEEKDAY_SHORT.map((w, i) => (
            <AppText
              key={w}
              variant="label"
              color={i === 6 ? 'expense' : 'textMuted'}
              style={{ flex: 1, textAlign: 'center' }}
            >
              {w}
            </AppText>
          ))}
        </View>

        {rows.map((week) => (
          <View key={week[0].date} style={{ flexDirection: 'row' }}>
            {week.map((d) => (
              <DayCell key={d.date} day={d} selected={d.date === selected} onPress={setSelected} />
            ))}
          </View>
        ))}
      </Card>

      {day ? (
        <View style={{ gap: 10 }}>
          <SectionTitle tone="section">{formatDate(day.date)}</SectionTitle>
          <Card style={{ gap: 6 }}>
            <AppText variant="caption" color="textMuted">
              Âm lịch {day.lunar}
            </AppText>
            {day.totals ? (
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <AppText color="income">+{format.compact(day.totals.income)}</AppText>
                <AppText color="expense">−{format.compact(day.totals.expense)}</AppText>
                <AppText color="textMuted">{day.totals.count} giao dịch</AppText>
              </View>
            ) : (
              <AppText color="textMuted">Không có giao dịch</AppText>
            )}
          </Card>
          {dayTransactions.length ? (
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {dayTransactions.map((item) => (
                <TransactionRow key={item.id} item={item} />
              ))}
            </Card>
          ) : null}
          {day.planned.length ? (
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {day.planned.map((o) => (
                <OccurrenceRow
                  key={`${o.scheduleId}-${o.dueDate}`}
                  occurrence={o}
                  lookup={lookup}
                />
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const DayCell = memo(function DayCell({
  day,
  selected,
  onPress,
}: {
  day: CalendarDay;
  selected: boolean;
  onPress: (date: DateString) => void;
}) {
  const { colors } = useTheme();
  const hasExpense = (day.totals?.expense ?? 0) > 0;
  const hasIncome = (day.totals?.income ?? 0) > 0;
  const dots: string[] = [];
  if (hasIncome || day.income !== 'none') dots.push(colors.income);
  if (hasExpense || day.expense !== 'none') dots.push(colors.expense);
  if (day.billDue || day.overdue) dots.push(colors.warning);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(day.date)}
      style={{
        flex: 1,
        height: CELL_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        opacity: day.inMonth ? 1 : 0.35,
        backgroundColor: selected
          ? rgba(colors.primary, 0.22)
          : day.isToday
            ? rgba(colors.primary, 0.1)
            : 'transparent',
        borderWidth: day.isToday ? 1 : 0,
        borderColor: colors.primary,
      }}
    >
      <AppText variant="bodyMedium" color={day.isSunday ? 'expense' : 'text'}>
        {day.day}
      </AppText>
      <AppText
        variant="caption"
        color={day.lunarFirst ? 'primary' : 'textMuted'}
        style={{ fontSize: 10 }}
      >
        {day.lunar}
      </AppText>
      <View style={{ flexDirection: 'row', gap: 3, height: 5 }}>
        {dots.map((c) => (
          <View key={c} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />
        ))}
      </View>
    </Pressable>
  );
});

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      <AppText variant="bodyMedium" style={{ color, fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
    </View>
  );
}
