import type { StyleProp, TextStyle } from 'react-native';

// Import thẳng hook (không qua index của feature) để tránh vòng lặp import components ↔ features
import { useMoneyFormat } from '@/features/settings/hooks/useMoneyFormat';
import type { Money, MoneyFlow } from '@/lib/money';
import type { TypographyVariant } from '@/theme';

import { AppText, type TextColor } from './AppText';

type AmountTextProps = {
  amount: Money;
  /** Có flow → hiện dấu và màu theo loại: chi đỏ (−), thu xanh (+), chuyển trung tính */
  flow?: MoneyFlow;
  compact?: boolean;
  variant?: TypographyVariant;
  color?: TextColor;
  style?: StyleProp<TextStyle>;
};

const FLOW_COLOR: Record<MoneyFlow, TextColor> = {
  expense: 'expense',
  income: 'income',
  transfer: 'transfer',
};

export function AmountText({
  amount,
  flow,
  compact = false,
  variant = 'bodyMedium',
  color,
  style,
}: AmountTextProps) {
  const format = useMoneyFormat();
  const text = flow
    ? format.flow(amount, flow)
    : compact
      ? format.compact(amount)
      : format.money(amount);
  return (
    <AppText
      variant={variant}
      color={color ?? (flow ? FLOW_COLOR[flow] : amount < 0 ? 'expense' : 'text')}
      // Chữ số đều độ rộng → số không "nhảy" khi thay đổi
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
    >
      {text}
    </AppText>
  );
}
