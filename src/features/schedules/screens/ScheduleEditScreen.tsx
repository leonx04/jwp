// Thêm / sửa lịch thu chi: lương, tiền nhà, trả góp, điện nước, chuyển tiết kiệm...
import { goBack } from '@/lib/goBack';
import { t } from '@/lib/i18n';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { IconButton } from '@/components/glass/IconButton';
import {
  AppText,
  Button,
  Card,
  Chip,
  Screen,
  SectionTitle,
  SegmentedControl,
  SwitchRow,
  TextField,
} from '@/components/ui';
import { MoneyField } from '@/components/ui/MoneyField';
import { pickDateTime } from '@/components/ui/pickDateTime';
import { db } from '@/db';
import type { TransactionType } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import {
  addDays,
  formatDate,
  parseDate,
  toVnDate,
  toVnTime,
  todayVn,
  vnDateToMs,
  WEEKDAY_SHORT,
} from '@/lib/date';
import { toAppIcon } from '@/lib/icons';
import {
  describeRule,
  generateOccurrences,
  type EndType,
  type Frequency,
  type WeekendRule,
} from '@/lib/recurrence';
import { createStyles } from '@/theme';

import { deleteSchedule, getSchedule, saveSchedule, setScheduleActive } from '../repository';

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Khoản chi', color: 'expense' },
  { value: 'income', label: 'Khoản thu', color: 'income' },
  { value: 'transfer', label: 'Chuyển tiền', color: 'primary' },
] as const;

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'once', label: 'Một lần' },
  { value: 'daily', label: 'Hằng ngày' },
  { value: 'weekly', label: 'Hằng tuần' },
  { value: 'monthly', label: 'Hằng tháng' },
  { value: 'yearly', label: 'Hằng năm' },
];

const WEEKEND_RULES: { value: WeekendRule; label: string }[] = [
  { value: 'none', label: 'Giữ nguyên' },
  { value: 'before', label: 'Lùi về thứ Sáu' },
  { value: 'after', label: 'Dời sang thứ Hai' },
];

const REMIND_OPTIONS = [
  { value: -1, label: 'Không nhắc' },
  { value: 0, label: 'Đúng ngày' },
  { value: 1, label: 'Trước 1 ngày' },
  { value: 3, label: 'Trước 3 ngày' },
  { value: 7, label: 'Trước 7 ngày' },
];

export function ScheduleEditScreen() {
  const params = useLocalSearchParams<{ id?: string; type?: TransactionType }>();
  const id = params.id;
  const existing = id ? getSchedule(db, id) : undefined;
  const styles = useStyles();
  const { data: accounts = [] } = useLiveData(['accounts'], () => listAccounts(db));
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));

  const [type, setType] = useState<TransactionType>(existing?.type ?? params.type ?? 'expense');
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [accountId, setAccountId] = useState<string | null>(existing?.accountId ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(existing?.toAccountId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [startDate, setStartDate] = useState(existing?.startDate ?? todayVn());
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [interval, setInterval] = useState(existing?.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>(
    existing?.weekdays ? existing.weekdays.split(',').map(Number) : [],
  );
  const [lastDayOfMonth, setLastDayOfMonth] = useState(existing?.monthDay === -1);
  // Ngày cố định trong tháng khác ngày bắt đầu (vd lịch nhập từ Ivy): giữ nguyên đến khi đổi ngày bắt đầu
  const [fixedMonthDay, setFixedMonthDay] = useState<number | null>(
    existing?.monthDay && existing.monthDay >= 1 && existing.monthDay <= 31
      ? existing.monthDay
      : null,
  );
  const [weekendRule, setWeekendRule] = useState<WeekendRule>(existing?.weekendRule ?? 'none');
  const [endType, setEndType] = useState<EndType>(existing?.endType ?? 'never');
  const [endDate, setEndDate] = useState(existing?.endDate ?? addDays(todayVn(), 365));
  const [endCount, setEndCount] = useState(String(existing?.endCount ?? 12));
  const [isEstimate, setIsEstimate] = useState(existing?.isEstimate ?? false);
  const [autoPost, setAutoPost] = useState(existing?.autoPost ?? false);
  const [remindDaysBefore, setRemindDaysBefore] = useState(existing?.remindDaysBefore ?? 1);
  const [remindTime, setRemindTime] = useState(existing?.remindTime ?? '09:00');
  const [note, setNote] = useState(existing?.note ?? '');

  const account = accountId ?? accounts[0]?.id ?? null;
  const rule = {
    startDate,
    frequency,
    interval: Math.max(1, interval),
    weekdays: frequency === 'weekly' && weekdays.length ? weekdays : null,
    monthDay: frequency !== 'monthly' ? null : lastDayOfMonth ? -1 : fixedMonthDay,
    weekendRule,
    endType: frequency === 'once' ? ('never' as const) : endType,
    endDate: endType === 'until' ? endDate : null,
    endCount: endType === 'count' ? Math.max(1, Number(endCount) || 1) : null,
  };
  // Xem trước 3 kỳ tới (tính nhanh, không cần memo)
  const preview = generateOccurrences(
    rule,
    todayVn() < startDate ? startDate : todayVn(),
    addDays(todayVn(), 800),
  ).slice(0, 3);

  const save = () => {
    try {
      saveSchedule(db, {
        id,
        type,
        amount,
        title,
        accountId: account ?? '',
        toAccountId,
        categoryId,
        note: note.trim() || null,
        isEstimate,
        autoPost,
        remindDaysBefore,
        remindTime,
        active: existing?.active ?? true,
        ...rule,
        weekdays: rule.weekdays ? rule.weekdays.join(',') : null,
      });
      showSnackbar({ text: id ? 'Đã lưu lịch' : 'Đã thêm lịch', tone: 'success' });
      goBack();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  const remove = () => {
    if (!id) return;
    Alert.alert('Xoá lịch?', 'Các giao dịch đã ghi từ lịch này vẫn được giữ lại.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => {
          deleteSchedule(db, id);
          goBack();
        },
      },
    ]);
  };

  const pick = async (current: string, set: (value: string) => void) => {
    const value = await pickDateTime(vnDateToMs(current, '12:00'), 'date');
    if (value != null) set(toVnDate(value));
  };

  const pickStartDate = () =>
    pick(startDate, (value) => {
      setStartDate(value);
      setFixedMonthDay(null); // ngày trong tháng theo ngày bắt đầu mới
    });

  return (
    <Screen
      title={id ? 'Sửa lịch' : 'Thêm lịch thu chi'}
      headerRight={
        id ? (
          <IconButton icon="trash-outline" accessibilityLabel={t('Xoá lịch')} onPress={remove} />
        ) : null
      }
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button
            title="Lưu lịch"
            icon="checkmark"
            disabled={!amount && !isEstimate}
            onPress={save}
          />
        </View>
      }
    >
      <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />
      <TextField
        label="Tên"
        placeholder={type === 'income' ? 'vd: Lương công ty' : 'vd: Tiền nhà, Trả góp xe'}
        value={title}
        onChangeText={setTitle}
      />
      <MoneyField label="Số tiền" value={amount} onChange={setAmount} />
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <SwitchRow
          icon="help-circle-outline"
          title="Số tiền ước tính"
          subtitle="Điện, nước... nhập số thực tế khi thanh toán"
          value={isEstimate}
          onValueChange={setIsEstimate}
        />
      </Card>

      <SectionTitle>
        {type === 'transfer' ? 'Từ ví' : type === 'income' ? 'Nhận vào ví' : 'Chi từ ví'}
      </SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.row}
      >
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            color={a.color}
            icon={a.icon ? toAppIcon(a.icon, 'wallet-outline') : undefined}
            selected={account === a.id}
            onPress={() => setAccountId(a.id)}
          />
        ))}
      </ScrollView>
      {type === 'transfer' ? (
        <>
          <SectionTitle>Đến ví</SectionTitle>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.row}
          >
            {accounts
              .filter((a) => a.id !== account)
              .map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  color={a.color}
                  icon={a.icon ? toAppIcon(a.icon, 'wallet-outline') : undefined}
                  selected={toAccountId === a.id}
                  onPress={() => setToAccountId(a.id)}
                />
              ))}
          </ScrollView>
        </>
      ) : (
        <>
          <SectionTitle>Danh mục</SectionTitle>
          <View style={styles.wrap}>
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                color={c.color}
                icon={c.icon ? toAppIcon(c.icon, 'pricetag-outline') : undefined}
                selected={categoryId === c.id}
                onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
              />
            ))}
          </View>
        </>
      )}

      <SectionTitle>Lặp lại</SectionTitle>
      <View style={styles.wrap}>
        {FREQUENCIES.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            selected={frequency === f.value}
            onPress={() => setFrequency(f.value)}
          />
        ))}
      </View>
      <View style={styles.wrap}>
        <Chip
          icon="calendar-outline"
          label={`${frequency === 'once' ? 'Ngày' : 'Bắt đầu'} ${formatDate(startDate)}`}
          onPress={pickStartDate}
        />
        {frequency !== 'once' ? (
          <>
            <Chip icon="remove" label="" onPress={() => setInterval(Math.max(1, interval - 1))} />
            <AppText variant="bodyMedium" style={{ alignSelf: 'center' }}>
              Mỗi {interval}{' '}
              {
                { daily: 'ngày', weekly: 'tuần', monthly: 'tháng', yearly: 'năm', once: '' }[
                  frequency
                ]
              }
            </AppText>
            <Chip icon="add" label="" onPress={() => setInterval(interval + 1)} />
          </>
        ) : null}
      </View>
      {frequency === 'weekly' ? (
        <View style={styles.wrap}>
          {WEEKDAY_SHORT.map((label, index) => (
            <Chip
              key={label}
              label={label}
              selected={weekdays.includes(index + 1)}
              onPress={() =>
                setWeekdays(
                  weekdays.includes(index + 1)
                    ? weekdays.filter((d) => d !== index + 1)
                    : [...weekdays, index + 1],
                )
              }
            />
          ))}
        </View>
      ) : null}
      {frequency === 'monthly' ? (
        <View style={styles.wrap}>
          <Chip
            label={t('Ngày {day} hằng tháng', { day: fixedMonthDay ?? parseDate(startDate).day })}
            selected={!lastDayOfMonth}
            onPress={() => setLastDayOfMonth(false)}
          />
          <Chip
            label="Ngày cuối tháng"
            selected={lastDayOfMonth}
            onPress={() => setLastDayOfMonth(true)}
          />
        </View>
      ) : null}

      <SectionTitle>Nếu rơi vào cuối tuần</SectionTitle>
      <View style={styles.wrap}>
        {WEEKEND_RULES.map((w) => (
          <Chip
            key={w.value}
            label={w.label}
            selected={weekendRule === w.value}
            onPress={() => setWeekendRule(w.value)}
          />
        ))}
      </View>

      {frequency !== 'once' ? (
        <>
          <SectionTitle>Kết thúc</SectionTitle>
          <View style={styles.wrap}>
            <Chip
              label="Không bao giờ"
              selected={endType === 'never'}
              onPress={() => setEndType('never')}
            />
            <Chip
              label={
                endType === 'until'
                  ? t('Đến {endDate}', { endDate: formatDate(endDate) })
                  : 'Đến ngày'
              }
              selected={endType === 'until'}
              onPress={() => {
                setEndType('until');
                pick(endDate, setEndDate);
              }}
            />
            <Chip
              label="Sau số lần"
              selected={endType === 'count'}
              onPress={() => setEndType('count')}
            />
          </View>
          {endType === 'count' ? (
            <TextField
              label="Số lần"
              keyboardType="number-pad"
              value={endCount}
              onChangeText={setEndCount}
            />
          ) : null}
        </>
      ) : null}

      <Card style={{ gap: 4 }}>
        <AppText variant="bodyMedium">{describeRule(rule)}</AppText>
        <AppText variant="caption" color="textMuted">
          {preview.length
            ? t('Các kỳ tới: {join}', {
                join: preview.map((d) => formatDate(d, false)).join(' · '),
              })
            : 'Không còn kỳ nào sau hôm nay'}
        </AppText>
      </Card>

      <SectionTitle>Nhắc nhở & ghi nhận</SectionTitle>
      <View style={styles.wrap}>
        {REMIND_OPTIONS.map((r) => (
          <Chip
            key={r.value}
            label={r.label}
            selected={remindDaysBefore === r.value}
            onPress={() => setRemindDaysBefore(r.value)}
          />
        ))}
        <Chip
          icon="time-outline"
          label={t('Lúc {remindTime}', { remindTime })}
          onPress={async () => {
            const value = await pickDateTime(vnDateToMs(todayVn(), remindTime), 'time');
            if (value != null) setRemindTime(toVnTime(value));
          }}
        />
      </View>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <SwitchRow
          icon="flash-outline"
          title="Tự ghi nhận khi đến hạn"
          subtitle="Tự tạo giao dịch (vd lương vào thẳng tài khoản). Tắt: chờ bạn xác nhận"
          value={autoPost}
          onValueChange={setAutoPost}
        />
        {id ? (
          <SwitchRow
            icon="pause-circle-outline"
            title="Đang chạy"
            subtitle="Tắt để tạm dừng lịch, không sinh kỳ mới"
            value={existing?.active ?? true}
            onValueChange={(value) => {
              setScheduleActive(db, id, value);
              goBack();
            }}
          />
        ) : null}
      </Card>
      <TextField
        icon="document-text-outline"
        placeholder="Ghi chú"
        value={note}
        onChangeText={setNote}
        multiline
      />
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  bleed: { marginHorizontal: -t.spacing.lg, flexGrow: 0 },
  row: { paddingHorizontal: t.spacing.lg, gap: t.spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
}));
