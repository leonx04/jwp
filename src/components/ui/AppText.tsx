import { Text, type TextProps } from 'react-native';

import { t } from '@/lib/i18n';
import { useTheme, type ThemeColors, type TypographyVariant } from '@/theme';

/** Các key màu dạng chuỗi trong theme (bỏ gradient vì là mảng) */
export type TextColor = {
  [K in keyof ThemeColors]: ThemeColors[K] extends string ? K : never;
}[keyof ThemeColors];

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
};

/** Chuỗi tĩnh được dịch tự động theo ngôn ngữ; chuỗi động (có số, tên người dùng) tự dùng t() với tham số. */
const translate = (node: TextProps['children']): TextProps['children'] =>
  typeof node === 'string'
    ? t(node)
    : Array.isArray(node)
      ? node.map((child) => (typeof child === 'string' ? t(child) : child))
      : node;

/** Thay cho <Text>: luôn đúng font Be Vietnam Pro, cỡ chữ và màu theo theme. */
export function AppText({
  variant = 'body',
  color = 'text',
  style,
  children,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  return (
    <Text style={[theme.typography[variant], { color: theme.colors[color] }, style]} {...rest}>
      {translate(children)}
    </Text>
  );
}
