// Bề mặt theo ngôn ngữ "Calm Glass":
//  - 'card' : thẻ nội dung — bề mặt ĐẶC, sạch (phân tầng bằng sắc độ; nền sáng có bóng rất mềm).
//  - 'chrome': lớp điều hướng nổi (thanh tab, header, bảng trượt) — KÍNH làm mờ thật nội dung phía sau
//    (expo-blur + BlurTargetView trên Android 12+; iOS 26 dùng GlassView gốc của hệ thống).
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode, RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type View as RNView, type ViewStyle } from 'react-native';

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
  /** Viền mảnh quanh mép (header tràn viền thì tắt) */
  bordered?: boolean;
  /** Ghi đè màu nền thẻ */
  background?: string;
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
  shadow = true,
  bordered = true,
  background,
  style,
  contentStyle,
  children,
  pointerEvents,
}: GlassSurfaceProps) {
  const { colors, radius: r, dark } = useTheme();
  const borderRadius = radius ?? r.xl;
  const chrome = variant === 'chrome';

  // Bóng: nền sáng dùng 2 lớp rất mềm; nền tối chỉ bóng cho lớp nổi (thẻ phân tầng bằng sắc độ)
  const shadowStyle = shadow
    ? dark
      ? chrome
        ? { boxShadow: `0 12px 32px ${colors.shadow}` }
        : null
      : { boxShadow: `0 1px 2px rgba(16,24,40,0.04), 0 8px 24px ${colors.shadow}` }
    : null;

  return (
    <View pointerEvents={pointerEvents} style={[{ borderRadius }, shadowStyle, style]}>
      <View
        style={[
          styles.clip,
          {
            borderRadius,
            borderColor: colors.glassBorder,
            borderWidth: bordered && (chrome || dark) ? StyleSheet.hairlineWidth * 2 : 0,
            backgroundColor: chrome ? 'transparent' : (background ?? colors.surface),
          },
        ]}
      >
        {chrome ? (
          <>
            {nativeLiquidGlass ? (
              <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
            ) : blurTarget ? (
              <BlurView
                style={StyleSheet.absoluteFill}
                blurTarget={blurTarget}
                blurMethod="dimezisBlurViewSdk31Plus"
                intensity={intensity}
                tint={colors.blurTint}
              />
            ) : null}
            {!nativeLiquidGlass ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassChrome }]} />
            ) : null}
            {/* Vệt phản chiếu nhẹ ở mép trên — cho lớp kính cảm giác có độ dày */}
            <LinearGradient
              pointerEvents="none"
              colors={[colors.glassSheen, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 0.6 }}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : null}
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
