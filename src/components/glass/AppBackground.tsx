// Nền "Calm Glass": một tông màu tĩnh + MỘT quầng sáng tròn rất nhẹ ở đỉnh theo màu chủ đạo.
// Mịn (gradient tròn, không có mảng màu loang), vẽ một lần bằng Skia trên GPU.
import { Canvas, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { rgba, useTheme } from '@/theme';

export const AppBackground = memo(function AppBackground() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const glow = colors.glowOpacity;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={height * 0.6}>
          <RadialGradient
            c={vec(width * 0.5, -height * 0.06)}
            r={Math.max(width, height * 0.55)}
            colors={[rgba(colors.primary, glow), rgba(colors.primary, glow * 0.35), rgba(colors.primary, 0)]}
            positions={[0, 0.45, 1]}
          />
        </Rect>
      </Canvas>
    </View>
  );
});
