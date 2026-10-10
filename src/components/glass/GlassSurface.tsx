// Bề mặt kính (Liquid Glass phỏng theo trên Android):
//  - 'chrome': lớp điều hướng nổi (thanh tab, header, bảng trượt) → LÀM MỜ THẬT nội dung phía sau
//    (expo-blur + BlurTargetView, Android 12+). iOS 26 dùng GlassView gốc của hệ thống.
//  - 'card': thẻ nội dung → kính "giả": nền trong mờ + viền sáng + vệt phản chiếu (nhẹ, cuộn mượt).
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode, RefObject } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type View as RNView,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

const nativeLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

type GlassSurfaceProps = {
  variant?: 'card' | 'chrome';
  /** Vùng nội dung để làm mờ (chỉ cần với 'chrome' trên Android) */
  blurTarget?: RefObject<RNView | null>;
  intensity?: number;
  radius?: number;
  /** Đổ bóng mềm phía dưới */
  shadow?: boolean;
  /** Viền sáng quanh mép (header tràn viền thì tắt) */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pointerEvents?: 'box-none' | 'none' | 'auto' | 'box-only';
};

export function GlassSurface({
  variant = 'card',
  blurTarget,
  intensity = 60,
  radius,
  shadow = variant === 'card',
  bordered = true,
  style,
  contentStyle,
  children,
  pointerEvents,
}: GlassSurfaceProps) {
  const { colors, radius: r } = useTheme();
  const borderRadius = radius ?? r.xl;
  const chrome = variant === 'chrome';

  return (
    <View
      pointerEvents={pointerEvents}
      style={[{ borderRadius }, shadow && { boxShadow: `0 10px 30px ${colors.shadow}` }, style]}
    >
      <View
        style={[
          styles.clip,
          { borderRadius, borderColor: colors.glassBorder, borderWidth: bordered ? 1 : 0 },
        ]}
      >
        {chrome && nativeLiquidGlass ? (
          <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
        ) : chrome && blurTarget ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={intensity}
            tint={colors.blurTint}
          />
        ) : null}
        {!nativeLiquidGlass || !chrome ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: chrome ? colors.glassChrome : colors.glassFill },
            ]}
          />
        ) : null}
        {/* Vệt phản chiếu ánh sáng ở góc trên — thứ làm "kính" trông có độ dày */}
        <LinearGradient
          pointerEvents="none"
          colors={[colors.glassSheen, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.35, y: 0.7 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={contentStyle}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    flexGrow: 1,
  },
});
