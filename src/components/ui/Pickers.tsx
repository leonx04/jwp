import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { ICON_CHOICES, type IconName } from '@/lib/icons';
import { readableOn, rgba, useTheme } from '@/theme';

/** Bảng màu cho ví / danh mục / tag */
export const COLOR_CHOICES = [
  '#5B5BD6',
  '#7C3AED',
  '#2563EB',
  '#0EA5E9',
  '#0D9488',
  '#16A34A',
  '#65A30D',
  '#CA8A04',
  '#EA580C',
  '#DC2626',
  '#E11D48',
  '#DB2777',
  '#A16207',
  '#64748B',
  '#475569',
  '#111827',
] as const;

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {COLOR_CHOICES.map((color) => {
        const selected = color.toUpperCase() === value.toUpperCase();
        return (
          <Pressable
            key={color}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={color}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(color);
            }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: color,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 3,
              borderColor: selected ? colors.text : 'transparent',
            }}
          >
            {selected ? <Ionicons name="checkmark" size={18} color={readableOn(color)} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (icon: IconName) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {ICON_CHOICES.map((icon) => {
        const selected = icon === value;
        return (
          <Pressable
            key={icon}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={icon}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(icon);
            }}
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: selected ? rgba(color, 0.7) : colors.glassBorder,
              backgroundColor: selected ? rgba(color, colors.dark ? 0.3 : 0.16) : colors.glassFill,
            }}
          >
            <Ionicons name={icon} size={22} color={selected ? color : colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}
