import { Text, type TextProps } from 'react-native';

import { useTheme, type ThemeColors, type TypographyVariant } from '@/theme';

/** Các key màu dạng chuỗi trong theme (bỏ gradient vì là mảng) */
export type TextColor = {
  [K in keyof ThemeColors]: ThemeColors[K] extends string ? K : never;
}[keyof ThemeColors];

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
};

/** Thay cho <Text>: luôn đúng font Be Vietnam Pro, cỡ chữ và màu theo theme. */
export function AppText({ variant = 'body', color = 'text', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  return (
    <Text style={[theme.typography[variant], { color: theme.colors[color] }, style]} {...rest} />
  );
}
