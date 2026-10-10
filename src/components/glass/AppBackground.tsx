// Nền "lỏng": các khối màu lớn được làm nhoè (vẽ bằng Skia trên GPU, vẽ một lần — không tốn pin).
// Lớp kính phía trên cần nền có màu sắc thì hiệu ứng mờ / trong suốt mới thấy rõ.
import { BlurMask, Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';
import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/theme';

export const AppBackground = memo(function AppBackground() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const r = Math.max(width, height) * 0.36;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={height} color={colors.background} />
        <Group opacity={colors.blobOpacity}>
          <Circle cx={width * 0.05} cy={height * 0.06} r={r} color={colors.blobs[0]}>
            <BlurMask blur={r * 0.7} style="normal" />
          </Circle>
          <Circle cx={width * 1.02} cy={height * 0.34} r={r * 0.8} color={colors.blobs[1]}>
            <BlurMask blur={r * 0.7} style="normal" />
          </Circle>
          <Circle cx={width * 0.2} cy={height * 0.92} r={r * 0.9} color={colors.blobs[2]}>
            <BlurMask blur={r * 0.75} style="normal" />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
});
