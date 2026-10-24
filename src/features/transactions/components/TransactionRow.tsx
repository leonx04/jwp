import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { AmountText, AppText, IconBadge } from '@/components/ui';
import { toVnTime } from '@/lib/date';
import { t } from '@/lib/i18n';
import { DEFAULT_CATEGORY_ICON, UNCATEGORIZED_ICON, toAppIcon, type AppIcon } from '@/lib/icons';
import { createStyles, NEUTRAL_MARK, useTheme } from '@/theme';

import type { TransactionListItem } from '../queries';

export function transactionTitle(item: TransactionListItem): string {
  if (item.title) return item.title;
  if (item.type === 'transfer') return 'Chuyển khoản';
  if (item.isAdjustment) return 'Điều chỉnh số dư';
  return item.categoryName ?? 'Chưa phân loại';
}

function iconOf(item: TransactionListItem): { icon: AppIcon; color?: string } {
  if (item.type === 'transfer') return { icon: 'swap-horizontal-outline' };
  if (item.isAdjustment) return { icon: 'options-outline' };
  if (!item.categoryId) return { icon: UNCATEGORIZED_ICON, color: NEUTRAL_MARK };
  return {
    icon: toAppIcon(item.categoryIcon, DEFAULT_CATEGORY_ICON),
    color: item.categoryColor ?? undefined,
  };
}

type TransactionRowProps = {
  item: TransactionListItem;
  showTime?: boolean;
  onPress?: (item: TransactionListItem) => void;
};

export const TransactionRow = memo(function TransactionRow({
  item,
  showTime = true,
  onPress,
}: TransactionRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { icon, color } = iconOf(item);
  const accountText =
    item.type === 'transfer'
      ? `${item.accountName} → ${item.toAccountName ?? '?'}`
      : item.accountName;
  const secondary = [
    item.title && item.type !== 'transfer' ? t(item.categoryName ?? 'Chưa phân loại') : null,
    accountText,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => (onPress ? onPress(item) : router.push(`/transaction/${item.id}`))}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <IconBadge icon={icon} color={color} size={42} />
      <View style={styles.texts}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {transactionTitle(item)}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {secondary}
        </AppText>
        {item.tagNames.length ? (
          <View style={styles.tags}>
            {item.tagNames.slice(0, 3).map((tag) => (
              <AppText
                key={tag}
                variant="label"
                style={[styles.tag, { backgroundColor: colors.primarySoft, color: colors.primary }]}
              >
                #{tag}
              </AppText>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.right}>
        <AmountText
          amount={item.amount}
          flow={item.type}
          variant="bodyMedium"
          style={{ fontFamily: 'BeVietnamPro_600SemiBold', fontVariant: ['tabular-nums'] }}
        />
        {showTime ? (
          <AppText variant="caption" color="textMuted">
            {toVnTime(item.date)}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
});

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  tags: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 11,
  },
}));
