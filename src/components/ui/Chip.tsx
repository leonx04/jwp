import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { bankFromIcon } from '@/lib/banks';
import type { AppIcon, IconName } from '@/lib/icons';
import { rgba, useTheme } from '@/theme';

import { AppText } from './AppText';
import { BankMark } from './BankMark';

type ChipProps = {
  label: string;
  selected?: boolean;
  /** Tên Ionicons hoặc 'bank:<CODE>' (logo ngân hàng) */
  icon?: AppIcon;
  /** Màu riêng (ví / danh mục / tag): chấm màu khi chưa chọn, nền màu khi chọn */
  color?: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Hiện dấu × để bỏ chọn */
  removable?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Viên chọn nhỏ dạng capsule (ví, danh mục, tag, bộ lọc, gợi ý) */
export function Chip({
  label,
  selected = false,
  icon,
  color,
  onPress,
  onLongPress,
  removable,
  style,
}: ChipProps) {
  const { colors } = useTheme();
  const tint = color ?? colors.primary;
  const bank = bankFromIcon(icon);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 36,
          paddingHorizontal: 14,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: selected ? rgba(tint, 0.55) : colors.glassBorder,
          backgroundColor: selected ? rgba(tint, colors.dark ? 0.28 : 0.16) : colors.glassFill,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
        style,
      ]}
    >
      {bank ? (
        <BankMark bank={bank} size={20} />
      ) : icon ? (
        <Ionicons name={icon as IconName} size={16} color={selected ? tint : colors.textMuted} />
      ) : color ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
      ) : null}
      <AppText
        variant="label"
        style={{ fontSize: 13 }}
        color={selected ? 'text' : 'textMuted'}
        numberOfLines={1}
      >
        {label}
      </AppText>
      {removable ? <Ionicons name="close" size={14} color={colors.textMuted} /> : null}
    </Pressable>
  );
}
