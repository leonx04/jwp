// Nền "Calm Glass": một tông màu tĩnh + MỘT quầng sáng tròn rất nhẹ ở đỉnh theo màu chủ đạo.
// Vẽ một lần bằng react-native-svg (gradient tròn, không có mảng màu loang), không tốn công mỗi khung hình.
import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

export const AppBackground = memo(function AppBackground() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const glow = colors.glowOpacity;
  const glowHeight = height * 0.6;
  const radius = Math.max(width, height * 0.55);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} pointerEvents="none">
      <Svg width={width} height={glowHeight}>
        <Defs>
          <RadialGradient
            id="glow"
            cx={width * 0.5}
            cy={-height * 0.06}
            r={radius}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={colors.primary} stopOpacity={glow} />
            <Stop offset="0.45" stopColor={colors.primary} stopOpacity={glow * 0.35} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={glowHeight} fill="url(#glow)" />
      </Svg>
    </View>
  );
});
