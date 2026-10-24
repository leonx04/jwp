import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { db } from '@/db';
import { useMoneyFormat } from '@/features/settings';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import { AmountText, AppText, IconBadge } from '@/components/ui';
import { creditAccountOfBill, isCreditBill } from '@/features/credit/bills';
import { loanOfOccurrence } from '@/features/debts/loanOccurrences';
import { formatDate, formatRelativeDue } from '@/lib/date';
import { toAppIcon, type AppIcon } from '@/lib/icons';
import { useTheme } from '@/theme';

import type { Occurrence } from '../occurrences';
import { quickPayWithToast } from '../quickPay';

export type OccurrenceLookup = {
  accountName: (id: string) => string;
  /** Icon của ví (logo ngân hàng) — dùng cho kỳ bill ví trả sau */
  accountIcon?: (id: string) => string | null;
  category: (id: string | null) => { name: string; icon: string | null; color: string } | null;
};

export function occurrenceTitle(o: Occurrence, lookup: OccurrenceLookup): string {
  if (o.schedule.title) return o.schedule.title;
  if (o.type === 'transfer') return 'Chuyển khoản định kỳ';
  return (
    lookup.category(o.schedule.categoryId)?.name ??
    (o.type === 'income' ? 'Khoản thu' : 'Khoản chi')
  );
}

/** Một kỳ của lịch: ngày đến hạn, số tiền, nút "đã trả" nhanh */
export function OccurrenceRow({
  occurrence: o,
  lookup,
}: {
  occurrence: Occurrence;
  lookup: OccurrenceLookup;
}) {
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const category = lookup.category(o.schedule.categoryId);
  // Kỳ bill ví trả sau: không phải lịch thật → mở chi tiết ví, "đã trả" = ghi chuyển khoản trả bill
  const creditBill = isCreditBill(o.scheduleId);
  const creditId = creditBill ? creditAccountOfBill(o.scheduleId) : null;
  // Kỳ trả nợ có lãi: mở khoản nợ, "đã trả" = mở màn trả kỳ (tách gốc / lãi)
  const loan = loanOfOccurrence(o.scheduleId);
  const icon: AppIcon = creditId
    ? toAppIcon(lookup.accountIcon?.(creditId), 'card-outline')
    : loan
      ? 'people-outline'
      : o.type === 'transfer'
        ? 'swap-horizontal-outline'
        : toAppIcon(
            category?.icon,
            o.type === 'income' ? 'arrow-down-circle-outline' : 'calendar-outline',
          );
  const tone = o.status === 'overdue' ? 'expense' : o.status === 'due' ? 'warning' : 'textMuted';
  const params = { scheduleId: o.scheduleId, dueDate: o.dueDate };

  return (
    <Pressable
      onPress={() =>
        creditId
          ? router.push(`/account/${creditId}`)
          : loan
            ? router.push(`/debt/${loan.debtId}`)
            : router.push({ pathname: '/schedule/occurrence', params })
      }
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
        pressed && { opacity: 0.6 },
      ]}
    >
      <IconBadge
        icon={icon}
        color={category?.color ?? (o.type === 'income' ? colors.income : colors.primary)}
        size={42}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {occurrenceTitle(o, lookup)}
        </AppText>
        <AppText variant="caption" color={tone} numberOfLines={1}>
          {formatDate(o.date, false)} · {formatRelativeDue(o.date)} ·{' '}
          {lookup.accountName(o.schedule.accountId)}
          {o.schedule.isEstimate ? ' · ước tính' : ''}
        </AppText>
      </View>
      <AmountText amount={o.amount} flow={o.type} />
      <IconButton
        icon="checkmark"
        size={34}
        accessibilityLabel={t('Đã thanh toán')}
        color={colors.income}
        onPress={() => {
          if (loan) {
            router.push({ pathname: '/debt/installment', params: { debtId: loan.debtId } });
            return;
          }
          // Bấm ✓ = ghi luôn theo đúng thông tin của lịch (có Hoàn tác); chỉ khoản ước tính mới mở form
          if (quickPayWithToast(db, o, occurrenceTitle(o, lookup), format.money)) return;
          router.push({
            pathname: '/transaction/new',
            params: {
              type: o.type,
              amount: String(o.amount),
              accountId: o.schedule.accountId,
              toAccountId: o.schedule.toAccountId ?? undefined,
              categoryId: o.schedule.categoryId ?? undefined,
              title: o.schedule.title,
              scheduleId: creditBill ? undefined : o.scheduleId,
              scheduleDueDate: creditBill ? undefined : o.dueDate,
            },
          });
        }}
      />
    </Pressable>
  );
}
