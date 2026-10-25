// Thẻ "Hôm nay": còn được tiêu bao nhiêu, đã tiêu bao nhiêu, còn mấy ngày tới lương. Bấm → tab Lịch.
import { t } from '@/lib/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { createStyles, useTheme, withAlpha } from '@/theme';

import { incomeLabel, type TodayStatus } from '../compute';
import { ProgressBar } from './ProgressBar';

const MASK = '••••••';

/** Câu cảnh báo khi tiền tới kỳ thu không đủ (status.available < 0) */
export function shortfallText(
  status: TodayStatus,
  compact: (n: number) => string,
  mask: (text: string) => string,
): string {
  // Tách rõ: thiếu cho các khoản phải trả, và phần ngưỡng an toàn đang giữ lại
  const when = t(status.nextIncome ? 'trước kỳ thu tới' : '30 ngày tới');
  const billsShort = Math.max(0, -(status.available + status.reserve));
  return billsShort > 0
    ? t('Chưa đủ tiền cho các khoản phải trả {when}: thiếu {amount}', {
        when,
        amount: mask(compact(billsShort)),
      }) +
        (status.reserve > 0
          ? t(' (chưa tính {amount} ngưỡng an toàn)', { amount: mask(compact(status.reserve)) })
          : '')
    : t('Đủ trả các khoản {when} nhưng chưa giữ đủ ngưỡng an toàn {reserve} · thiếu {short}', {
        when,
        reserve: mask(compact(status.reserve)),
        short: mask(compact(-status.available)),
      });
}

export const TodayCard = memo(function TodayCard({ status }: { status: TodayStatus }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const hideBalance = useSettings((s) => s.hideBalance);
  const mask = (text: string) => (hideBalance ? MASK : text);

  const income = status.incomeToday ?? status.nextIncome;
  const overspent = status.over > 0;
  const short = status.available < 0;
  const shortText = shortfallText(status, format.compact, mask);
  const barColor = overspent
    ? colors.warning
    : status.progress > 0.8
      ? colors.warning
      : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Hôm nay được tiêu, mở lịch thu chi')}
      onPress={() => router.navigate('/schedule')}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.content}>
        <View style={styles.header}>
          <AppText variant="bodyMedium" color="textMuted">
            Hôm nay được tiêu
          </AppText>
          {income ? (
            <View style={[styles.pill, { backgroundColor: withAlpha(colors.income, 0.12) }]}>
              <Ionicons name="calendar-outline" size={13} color={colors.income} />
              <AppText variant="label" color="income" numberOfLines={1}>
                {incomeLabel(income)}
              </AppText>
            </View>
          ) : null}
        </View>

        <AppText
          variant="display"
          color={overspent ? 'warning' : 'text'}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={styles.amount}
        >
          {overspent
            ? t('Vượt {amount}', { amount: mask(format.money(status.over)) })
            : mask(format.money(status.left))}
        </AppText>

        <ProgressBar value={status.progress} color={barColor} />

        <View style={styles.footer}>
          <AppText variant="caption" color="textMuted" style={styles.tabular}>
            Đã tiêu {mask(format.compact(status.spent))} / {mask(format.compact(status.budget))}
          </AppText>
          <AppText variant="caption" color="textMuted" style={styles.tabular}>
            {status.days > 1 ? t('chia đều {days} ngày', { days: status.days }) : 'đến hết hôm nay'}
          </AppText>
        </View>

        {short ? (
          <View style={styles.hint}>
            <Ionicons name="alert-circle" size={16} color={colors.expense} />
            <AppText variant="caption" color="expense" style={{ flex: 1 }}>
              {shortText}
            </AppText>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
});

const useStyles = createStyles((t) => ({
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  content: {
    gap: t.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 1,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: t.spacing.sm,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
}));
