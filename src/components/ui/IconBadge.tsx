import { View } from 'react-native';

import { bankFromIcon } from '@/lib/banks';
import type { AppIcon, IconName } from '@/lib/icons';
import { useTheme, withAlpha } from '@/theme';

import { AppIconGlyph } from './AppIconGlyph';
import { BankMark } from './BankMark';

export type { IconName };

type IconBadgeProps = {
  /** Tên Ionicons hoặc 'bank:<CODE>' (logo ngân hàng) */
  icon: AppIcon;
  /** Màu của danh mục / ví. Mặc định: màu chủ đạo */
  color?: string;
  size?: number;
};

/** Icon trong ô bo góc nền nhạt cùng màu — dùng cho ví, danh mục, menu. Ví ngân hàng hiện logo. */
export function IconBadge({ icon, color, size = 40 }: IconBadgeProps) {
  const { colors, dark } = useTheme();
  const bank = bankFromIcon(icon);
  if (bank) return <BankMark bank={bank} size={size} />;

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
      <AppIconGlyph icon={icon} size={size * 0.5} color={tint} />
    </View>
  );
}
