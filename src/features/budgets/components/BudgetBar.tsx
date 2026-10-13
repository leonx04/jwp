// Một dòng ngân sách: tên, đã dùng / hạn mức, thanh tiến độ, còn lại + dự báo. Dùng ở màn Ngân sách và Tổng quan.
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { useTheme } from '@/theme';

import type { BudgetItem } from '../queries';

export function BudgetBar({ item }: { item: BudgetItem }) {
  const format = useMoneyFormat();
  const hide = useSettings((s) => s.hideBalance);
  const { colors } = useTheme();
  const mask = (text: string) => (hide ? '••••••' : text);
  const tone =
    item.state === 'over'
      ? colors.expense
      : item.state === 'warning'
        ? colors.warning
        : colors.primary;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <AppText variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
          {item.name}
        </AppText>
        <AppText variant="caption" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
          {mask(`${format.money(item.spent)} / ${format.money(item.amount)}`)}
        </AppText>
      </View>
      <ProgressBar value={Math.min(1, item.ratio)} color={tone} height={8} />
      <AppText
        variant="caption"
        color={item.state === 'over' ? 'expense' : item.willExceed ? 'warning' : 'textMuted'}
      >
        {mask(
          item.state === 'over'
            ? `Vượt ${format.money(-item.remaining)}`
            : `Còn ${format.money(item.remaining)} · tối đa ${format.money(item.perDay)}/ngày (${item.daysLeft} ngày)`,
        )}
        {item.willExceed && !hide
          ? ` · giữ tốc độ này sẽ vượt (~${format.money(item.projected)})`
          : ''}
      </AppText>
    </View>
  );
}
