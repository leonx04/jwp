import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import { AmountText, AppText, IconBadge } from '@/components/ui';
import { formatDate, formatRelativeDue } from '@/lib/date';
import type { IconName } from '@/lib/icons';
import { useTheme } from '@/theme';

import type { Occurrence } from '../occurrences';

type Lookup = {
  accountName: (id: string) => string;
  category: (id: string | null) => { name: string; icon: string | null; color: string } | null;
};

export function occurrenceTitle(o: Occurrence, lookup: Lookup): string {
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
  lookup: Lookup;
}) {
  const { colors } = useTheme();
  const category = lookup.category(o.schedule.categoryId);
  const icon: IconName =
    o.type === 'transfer'
      ? 'swap-horizontal-outline'
      : ((category?.icon as IconName) ??
        (o.type === 'income' ? 'arrow-down-circle-outline' : 'calendar-outline'));
  const tone = o.status === 'overdue' ? 'expense' : o.status === 'due' ? 'warning' : 'textMuted';
  const params = { scheduleId: o.scheduleId, dueDate: o.dueDate };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/schedule/occurrence', params })}
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
        accessibilityLabel="Đã thanh toán"
        color={colors.income}
        onPress={() =>
          router.push({
            pathname: '/transaction/new',
            params: {
              type: o.type,
              amount: String(o.amount),
              accountId: o.schedule.accountId,
              toAccountId: o.schedule.toAccountId ?? undefined,
              categoryId: o.schedule.categoryId ?? undefined,
              title: o.schedule.title,
              scheduleId: o.scheduleId,
              scheduleDueDate: o.dueDate,
            },
          })
        }
      />
    </Pressable>
  );
}
