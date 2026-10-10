import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useTheme, withAlpha } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type IconBadgeProps = {
  icon: IconName;
  /** Màu của danh mục / ví. Mặc định: màu chủ đạo */
  color?: string;
  size?: number;
};

/** Icon trong ô tròn nền nhạt cùng màu — dùng cho ví, danh mục, menu. */
export function IconBadge({ icon, color, size = 40 }: IconBadgeProps) {
  const { colors, dark } = useTheme();
  const tint = color ?? colors.primary;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(tint, dark ? 0.22 : 0.14),
      }}
    >
      <Ionicons name={icon} size={size * 0.5} color={tint} />
    </View>
  );
}
