// Một kỳ của lịch: đã thanh toán / bỏ qua / dời ngày / sửa lịch.
import { t } from '@/lib/i18n';
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

import { occurrenceTitle } from '../components/OccurrenceRow';
import { findOccurrence, scheduleRule } from '../occurrences';
import { quickPayWithToast } from '../quickPay';
import {
  clearOccurrence,
  getSchedule,
  listOverrides,
  rescheduleOccurrence,
  skipOccurrence,
} from '../repository';

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
      if (!scheduleId) return null;
      const schedule = getSchedule(db, scheduleId);
      if (!schedule) return null;
      // Tìm theo ngày gốc: kỳ đã dời sang ngày khác vẫn mở được (trước đây tìm theo khoảng
      // [dueDate, dueDate] → dời xong màn hình báo "Không tìm thấy kỳ này")
      const occurrence = findOccurrence(
        schedule,
        listOverrides(db, scheduleId),
        dueDate,
        todayVn(),
      );
      return { schedule, occurrence };
    },
    [scheduleId, dueDate],
  );
  const { data: accounts = [] } = useLiveData(['accounts'], () =>
    listAccounts(db, { includeArchived: true }),
  );
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));

  // Đang tải lần đầu → chưa kết luận "không tìm thấy" (tránh nháy thông báo lỗi)
  if (data === undefined) return <Screen title="Kỳ thanh toán">{null}</Screen>;
  if (!data?.occurrence || !dueDate) {
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

  const pay = () => {
    // Ghi luôn theo thông tin của lịch (có Hoàn tác); khoản ước tính mới cần mở form nhập số thật
    if (quickPayWithToast(db, o, title, format.money)) {
      if (router.canGoBack()) router.back();
      return;
    }
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
  };

  /** Đặt ngày thực tế của kỳ: về đúng ngày gốc thì xoá bản ghi dời ngày thay vì lưu "dời sang chính nó" */
  const moveTo = (date: string) =>
    date === dueDate
      ? clearOccurrence(db, scheduleId, dueDate)
      : rescheduleOccurrence(db, scheduleId, dueDate, date);

  const skip = () => {
    const previous = o.date;
    skipOccurrence(db, scheduleId, dueDate);
    showSnackbar({
      text: t('Đã bỏ qua kỳ {date}', { date: formatDate(previous, false) }),
      actionLabel: 'Hoàn tác',
      // Hoàn tác giữ lại ngày đã dời (nếu có)
      onAction: () => moveTo(previous),
    });
    if (router.canGoBack()) router.back();
  };

  const reschedule = async () => {
    const previous = o.date;
    const picked = await pickDateTime(vnDateToMs(previous, '12:00'), 'date');
    if (picked == null) return;
    const next = toVnDate(picked);
    if (next === previous) return;
    try {
      moveTo(next);
    } catch (error) {
      showSnackbar({
        text: t('Chưa dời được: {error}', {
          error: error instanceof Error ? error.message : String(error),
        }),
        tone: 'error',
      });
      return;
    }
    showSnackbar({
      text:
        next === dueDate
          ? t('Đã đưa về ngày gốc {date}', { date: formatDate(next, false) })
          : t('Đã dời sang {date}', { date: formatDate(next, false) }),
      tone: 'success',
      actionLabel: 'Hoàn tác',
      onAction: () => moveTo(previous),
    });
  };

  return (
    <Screen title={title}>
      <Card style={{ alignItems: 'center', gap: 4 }}>
        <AppText variant="label" color="textMuted">
          {STATUS_TEXT[o.status]}
        </AppText>
        <AppText
          variant="hero"
          color={o.type === 'income' ? 'income' : o.type === 'expense' ? 'expense' : 'text'}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {format.money(o.amount)}
        </AppText>
        <AppText color="textMuted">
          {formatDate(o.date)} · {formatRelativeDue(o.date)}
          {o.date !== o.dueDate
            ? t(' (dời từ {date})', { date: formatDate(o.dueDate, false) })
            : ''}
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
            {o.date !== o.dueDate ? (
              <Button
                title={t('Về ngày gốc {date}', { date: formatDate(o.dueDate, false) })}
                icon="arrow-undo-outline"
                variant="secondary"
                onPress={() => clearOccurrence(db, scheduleId, dueDate)}
              />
            ) : null}
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
