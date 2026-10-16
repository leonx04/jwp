// Một dòng ngân sách: tên, đã dùng / hạn mức, thanh tiến độ, còn lại + dự báo. Dùng ở màn Ngân sách và Tổng quan.
import { t } from '@/lib/i18n';
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
        <AppText
          variant="caption"
          color="textMuted"
          style={{ fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
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
            ? t('Vượt {remaining}', { remaining: format.money(-item.remaining) })
            : t('Còn {remaining} · tối đa {perDay}/ngày ({daysLeft} ngày)', {
                remaining: format.money(item.remaining),
                perDay: format.money(item.perDay),
                daysLeft: item.daysLeft,
              }),
        )}
        {item.willExceed && !hide
          ? t(' · giữ tốc độ này sẽ vượt (~{projected})', {
              projected: format.money(item.projected),
            })
          : ''}
      </AppText>
    </View>
  );
}
