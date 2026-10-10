import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/theme';

type CardProps = {
  children?: ReactNode;
  /** Kiểu bố cục cho phần nội dung bên trong (gap, alignItems...) */
  style?: StyleProp<ViewStyle>;
  /** false: không có padding (vd danh sách sát mép thẻ) */
  padded?: boolean;
  /** Kiểu cho khung ngoài (margin, width...) */
  containerStyle?: StyleProp<ViewStyle>;
};

/** Thẻ kính chứa nội dung */
export function Card({ children, style, padded = true, containerStyle }: CardProps) {
  const { spacing } = useTheme();
  return (
    <GlassSurface
      style={containerStyle}
      contentStyle={[padded && { padding: spacing.lg, gap: spacing.md }, style]}
    >
      {children}
    </GlassSurface>
  );
}
