// Một kỳ của lịch: đã thanh toán / bỏ qua / dời ngày / sửa lịch.
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { pickDateTime } from '@/components/ui/pickDateTime';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import { useMoneyFormat } from '@/features/settings';
import { formatDate, formatRelativeDue, toVnDate, todayVn, vnDateToMs } from '@/lib/date';
import { describeRule } from '@/lib/recurrence';

import { expandOccurrences, scheduleRule } from '../occurrences';
import {
  clearOccurrence,
  getSchedule,
  listOverrides,
  rescheduleOccurrence,
  skipOccurrence,
} from '../repository';
import { occurrenceTitle } from '../components/OccurrenceRow';

const STATUS_TEXT = {
  upcoming: 'Sắp tới',
  due: 'Đến hạn hôm nay',
  overdue: 'Quá hạn',
  paid: 'Đã thanh toán',
  skipped: 'Đã bỏ qua',
} as const;

export function OccurrenceScreen() {
  const { scheduleId, dueDate } = useLocalSearchParams<{ scheduleId: string; dueDate: string }>();
  const format = useMoneyFormat();
  const { data } = useLiveData(
    ['schedules', 'schedule_occurrences'],
    () => {
      const schedule = getSchedule(db, scheduleId);
      if (!schedule) return null;
      const occurrence = expandOccurrences([schedule], listOverrides(db, scheduleId), {
        from: dueDate,
        to: dueDate,
        today: todayVn(),
        includeResolved: true,
      }).find((o) => o.dueDate === dueDate);
      return { schedule, occurrence: occurrence ?? null };
    },
    [scheduleId, dueDate],
  );
  const { data: accounts = [] } = useLiveData(['accounts'], () =>
    listAccounts(db, { includeArchived: true }),
  );
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));

  if (!data?.occurrence) {
    return (
      <Screen title="Kỳ thanh toán">
        <Card>
          <EmptyState icon="calendar-outline" title="Không tìm thấy kỳ này" />
        </Card>
      </Screen>
    );
  }
  const { schedule, occurrence: o } = data;
  const lookup = {
    accountName: (id: string) => accounts.find((a) => a.id === id)?.name ?? '?',
    category: (id: string | null) => categories.find((c) => c.id === id) ?? null,
  };
  const title = occurrenceTitle(o, lookup);
  const resolved = o.status === 'paid' || o.status === 'skipped';

  const pay = () =>
    router.replace({
      pathname: '/transaction/new',
      params: {
        type: o.type,
        amount: String(o.amount),
        accountId: schedule.accountId,
        toAccountId: schedule.toAccountId ?? undefined,
        categoryId: schedule.categoryId ?? undefined,
        title: schedule.title,
        scheduleId,
        scheduleDueDate: dueDate,
        date: String(vnDateToMs(o.date < todayVn() ? todayVn() : o.date, '12:00')),
      },
    });

  const skip = () => {
    skipOccurrence(db, scheduleId, dueDate);
    showSnackbar({
      text: `Đã bỏ qua kỳ ${formatDate(o.date, false)}`,
      actionLabel: 'Hoàn tác',
      onAction: () => clearOccurrence(db, scheduleId, dueDate),
    });
    router.back();
  };

  const reschedule = async () => {
    const picked = await pickDateTime(vnDateToMs(o.date, '12:00'), 'date');
    if (!picked) return;
    rescheduleOccurrence(db, scheduleId, dueDate, toVnDate(picked));
    showSnackbar({ text: `Đã dời sang ${formatDate(toVnDate(picked), false)}`, tone: 'success' });
  };

  return (
    <Screen title={title}>
      <Card style={{ alignItems: 'center', gap: 4 }}>
        <AppText variant="label" color="textMuted">
          {STATUS_TEXT[o.status].toUpperCase()}
        </AppText>
        <AppText
          variant="hero"
          color={o.type === 'income' ? 'income' : o.type === 'expense' ? 'expense' : 'text'}
        >
          {format.money(o.amount)}
        </AppText>
        <AppText color="textMuted">
          {formatDate(o.date)} · {formatRelativeDue(o.date)}
          {o.date !== o.dueDate ? ` (dời từ ${formatDate(o.dueDate, false)})` : ''}
        </AppText>
      </Card>
      <Card style={{ gap: 0 }}>
        <ListRow
          icon="repeat-outline"
          title={describeRule(scheduleRule(schedule))}
          subtitle="Lặp lại"
        />
        <ListRow
          icon="wallet-outline"
          title={
            schedule.toAccountId
              ? `${lookup.accountName(schedule.accountId)} → ${lookup.accountName(schedule.toAccountId)}`
              : lookup.accountName(schedule.accountId)
          }
          subtitle="Ví"
        />
        {schedule.isEstimate ? (
          <ListRow
            icon="help-circle-outline"
            title="Số tiền ước tính"
            subtitle="Nhập số thực tế khi thanh toán"
          />
        ) : null}
      </Card>
      <View style={{ gap: 10 }}>
        {o.status === 'paid' && o.transactionId ? (
          <Button
            title="Xem giao dịch đã ghi"
            icon="receipt-outline"
            onPress={() => router.push(`/transaction/${o.transactionId}`)}
          />
        ) : null}
        {!resolved ? (
          <>
            <Button
              title={o.type === 'income' ? 'Đã nhận tiền' : 'Đã thanh toán'}
              icon="checkmark-circle-outline"
              onPress={pay}
            />
            <Button
              title="Dời ngày"
              icon="calendar-outline"
              variant="secondary"
              onPress={reschedule}
            />
            <Button
              title="Bỏ qua kỳ này"
              icon="play-skip-forward-outline"
              variant="secondary"
              onPress={skip}
            />
          </>
        ) : o.status === 'skipped' ? (
          <Button
            title="Bỏ đánh dấu bỏ qua"
            icon="arrow-undo-outline"
            variant="secondary"
            onPress={() => clearOccurrence(db, scheduleId, dueDate)}
          />
        ) : null}
        <Button
          title="Sửa lịch"
          icon="create-outline"
          variant="ghost"
          onPress={() => router.push({ pathname: '/schedule/edit', params: { id: scheduleId } })}
        />
      </View>
    </Screen>
  );
}
