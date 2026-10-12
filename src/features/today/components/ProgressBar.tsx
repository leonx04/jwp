import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, withAlpha } from '@/theme';

type ProgressBarProps = {
  /** 0–1 */
  value: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Thanh tiến độ mảnh, tĩnh (không animation → nhẹ khi cuộn) */
export function ProgressBar({ value, color, height = 6, style }: ProgressBarProps) {
  const { colors } = useTheme();
  const tint = color ?? colors.primary;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 1000) / 10;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[
        {
          height,
          borderRadius: height / 2,
          backgroundColor: withAlpha(tint, colors.dark ? 0.18 : 0.12),
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: tint,
        }}
      />
    </View>
  );
}
