// Một dòng ngân sách: tên, đã dùng / hạn mức, thanh tiến độ, còn lại + dự báo. Dùng ở màn Ngân sách và Tổng quan.
import { t } from '@/lib/i18n';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { rgba, useTheme } from '@/theme';

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

  const over = item.state === 'over';
  const percent = Math.round(item.ratio * 100);

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
          {item.name}
        </AppText>
        <AppText
          variant="label"
          style={{
            color: tone,
            backgroundColor: rgba(tone, colors.dark ? 0.2 : 0.12),
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            overflow: 'hidden',
            fontVariant: ['tabular-nums'],
          }}
        >
          {mask(`${percent}%`)}
        </AppText>
      </View>
      <View>
        <AppText variant="caption" color="textMuted">
          {over ? 'Vượt ngân sách' : 'Còn lại'}
        </AppText>
        <AppText
          variant="title"
          style={{ color: over ? colors.expense : colors.text, fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {mask(format.money(Math.abs(item.remaining)))}
        </AppText>
      </View>
      <ProgressBar value={Math.min(1, item.ratio)} color={tone} height={10} />
      <AppText variant="caption" color={item.willExceed && !over ? 'warning' : 'textMuted'}>
        {mask(
          over
            ? t('Đã chi {spent} / {limit}', {
                spent: format.money(item.spent),
                limit: format.money(item.amount),
              })
            : t('{spent} / {limit} · tối đa {perDay}/ngày ({daysLeft} ngày)', {
                spent: format.money(item.spent),
                limit: format.money(item.amount),
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
