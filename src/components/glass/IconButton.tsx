import { t } from '@/lib/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from '@/lib/haptics';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import type { IconName } from '@/lib/icons';
import { useTheme } from '@/theme';

type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  /** 'glass': nút tròn kính · 'plain': chỉ icon · 'primary': nền màu chủ đạo */
  variant?: 'glass' | 'plain' | 'primary';
  color?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

/** Nút tròn chỉ có icon (quay lại, đóng, thêm...) */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 40,
  variant = 'glass',
  color,
  style,
  disabled,
}: IconButtonProps) {
  const { colors } = useTheme();
  const tint = color ?? (variant === 'primary' ? colors.onPrimary : colors.text);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(accessibilityLabel)}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        },
        variant === 'glass' && {
          backgroundColor: colors.glassFill,
          borderWidth: 1,
          borderColor: colors.glassBorder,
        },
        variant === 'primary' && { backgroundColor: colors.primary },
        style,
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={tint} />
    </Pressable>
  );
}
