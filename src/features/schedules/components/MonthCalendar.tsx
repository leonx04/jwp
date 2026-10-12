// Lịch tháng: lưới 6 tuần, chấm màu thu / chi / bill, âm lịch nhỏ; bấm ngày để xem chi tiết.
import { useFocusEffect } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/glass/IconButton';
import { AppText, Card } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import type { TransactionListItem } from '@/features/transactions/queries';
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
  // Popup xem nhanh các giao dịch của ngày vừa bấm
  const [sheetOpen, setSheetOpen] = useState(false);
  // Bấm vào một giao dịch / kỳ trong popup sẽ chuyển màn → đóng popup
  useFocusEffect(useCallback(() => () => setSheetOpen(false), []));
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
  const dayFrom = vnDateToMs(selected);
  const dayTo = vnDateToMs(addDays(selected, 1));
  const { data: dayData } = useTransactions({ from: dayFrom, to: dayTo });
  // Hook giữ dữ liệu cũ tới khi truy vấn mới xong → lọc theo đúng ngày để không hiện nhầm ngày trước
  const dayTransactions = useMemo(
    () => (dayData ?? []).filter((t) => t.date >= dayFrom && t.date < dayTo),
    [dayData, dayFrom, dayTo],
  );
  // Ngày không có giao dịch thì dữ liệu cũ luôn bị lọc sạch → chỉ tin là đã tải khi ngày đó có dấu hiệu giao dịch khớp
  const dayLoaded = dayData !== undefined && (dayTransactions.length > 0 || !day?.totals?.count);

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
              <DayCell
                key={d.date}
                day={d}
                selected={d.date === selected}
                onPress={(date) => {
                  setSelected(date);
                  setSheetOpen(true);
                }}
              />
            ))}
          </View>
        ))}
      </Card>

      <DaySheet
        visible={sheetOpen && !!day}
        day={day}
        transactions={dayTransactions}
        loaded={dayLoaded}
        lookup={lookup}
        onClose={() => setSheetOpen(false)}
      />
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

/** Popup xem nhanh trong ngày: trượt từ dưới lên, danh sách cuộn được, bấm một dòng để mở / sửa */
function DaySheet({
  visible,
  day,
  transactions,
  loaded,
  lookup,
  onClose,
}: {
  visible: boolean;
  day: CalendarDay | undefined;
  transactions: readonly TransactionListItem[];
  /** Đã tải xong giao dịch của ngày — tránh hiện "trống" thoáng qua */
  loaded: boolean;
  lookup: OccurrenceLookup;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const insets = useSafeAreaInsets();
  if (!day) return null;
  const empty = loaded && !transactions.length && !day.planned.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
          accessibilityLabel="Đóng"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '75%',
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingTop: 10,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: rgba(colors.text, 0.2),
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="heading">{formatDate(day.date)}</AppText>
            <AppText variant="caption" color="textMuted">
              Âm lịch {day.lunar}
              {day.totals ? ` · ${day.totals.count} giao dịch` : ''}
            </AppText>
          </View>
          {day.totals ? (
            <View style={{ alignItems: 'flex-end' }}>
              {day.totals.income > 0 ? (
                <AppText color="income">+{format.compact(day.totals.income)}</AppText>
              ) : null}
              {day.totals.expense > 0 ? (
                <AppText color="expense">−{format.compact(day.totals.expense)}</AppText>
              ) : null}
            </View>
          ) : null}
          <View style={{ width: 8 }} />
          <IconButton icon="close" accessibilityLabel="Đóng" onPress={onClose} />
        </View>
        <ScrollView
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 12 }}
          showsVerticalScrollIndicator
        >
          {empty ? (
            <AppText color="textMuted" style={{ textAlign: 'center', paddingVertical: 24 }}>
              Không có giao dịch hay khoản dự kiến trong ngày này.
            </AppText>
          ) : null}
          {transactions.length ? (
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {transactions.map((item) => (
                <TransactionRow key={item.id} item={item} />
              ))}
            </Card>
          ) : null}
          {day.planned.length ? (
            <>
              <AppText variant="label" color="textMuted">
                KHOẢN THEO LỊCH
              </AppText>
              <Card style={{ gap: 0, paddingVertical: 4 }}>
                {day.planned.map((o) => (
                  <OccurrenceRow
                    key={`${o.scheduleId}-${o.dueDate}`}
                    occurrence={o}
                    lookup={lookup}
                  />
                ))}
              </Card>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
