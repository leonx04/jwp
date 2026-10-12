// Phần dùng chung của bộ biểu đồ SVG: đo bề rộng, hiệu ứng xuất hiện (chạy trên luồng UI, không tốn JS
// mỗi khung hình), nhãn trục, chú thích (legend).
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme';

/** Bề rộng thật của khung biểu đồ (đo bằng onLayout). 0 = chưa đo xong → chưa vẽ. */
export function useChartWidth(): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);
  return [width, onLayout];
}

/** id an toàn cho <LinearGradient id> / url(#id) — mỗi biểu đồ một id riêng */
export function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * Tiến trình hiệu ứng xuất hiện 0 → 1 (một lần, không lặp vô hạn).
 * Chạy lại khi `trigger` đổi (vd chuyển sang tháng khác). Tự tắt khi máy bật "giảm chuyển động".
 */
export function useEntrance(trigger: unknown, duration = 650, delay = 0): SharedValue<number> {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [trigger, duration, delay, progress]);
  return progress;
}

type LayerProps = {
  progress: SharedValue<number>;
  width: number;
  height: number;
  children: ReactNode;
};

/**
 * Hiện dần từ trái sang phải (cho đường / vùng) chỉ bằng transform:
 * khung ngoài (cắt nội dung) trượt sang phải, khung trong trượt ngược lại → nội dung đứng yên, "lộ" dần.
 */
export function RevealLayer({ progress, width, height, children }: LayerProps) {
  const outer = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * width }],
  }));
  const inner = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * width }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.layer, { width, height, overflow: 'hidden' }, outer]}
    >
      <Animated.View style={[{ width, height }, inner]}>{children}</Animated.View>
    </Animated.View>
  );
}

/** Cột "mọc" lên từ đường gốc: lớp cao đúng tới đường gốc, co giãn theo trục Y từ mép dưới */
export function GrowLayer({ progress, width, height, children }: LayerProps) {
  const grow = useAnimatedStyle(() => ({
    transform: [{ scaleY: Math.max(0.001, progress.value) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.layer, { width, height, transformOrigin: 'bottom' }, grow]}
    >
      {children}
    </Animated.View>
  );
}

/** Nhãn trục cỡ nhỏ, chữ số đều độ rộng */
export function AxisLabel({
  children,
  style,
  strong = false,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
  strong?: boolean;
}) {
  const { colors, fonts } = useTheme();
  return (
    <AppText
      variant="label"
      numberOfLines={1}
      allowFontScaling={false}
      style={[
        styles.axis,
        {
          color: strong ? colors.text : colors.textMuted,
          fontFamily: strong ? fonts.semibold : fonts.medium,
        },
        style,
      ]}
    >
      {children}
    </AppText>
  );
}

export type LegendItem = { key: string; label: string; color: string; dashed?: boolean };

/** Chú thích: chấm / vạch màu + nhãn. Chữ dùng màu chữ của theme, màu dữ liệu chỉ ở ký hiệu. */
export function ChartLegend({ items }: { items: readonly LegendItem[] }) {
  return (
    <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no">
      {items.map((item) => (
        <View key={item.key} style={styles.legendItem}>
          {item.dashed ? (
            <View style={styles.legendDash}>
              <View style={[styles.legendDashPart, { backgroundColor: item.color }]} />
              <View style={[styles.legendDashPart, { backgroundColor: item.color }]} />
            </View>
          ) : (
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          )}
          <AppText variant="label" color="textMuted">
            {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export const AXIS_FONT_SIZE = 10;
export const AXIS_LINE_HEIGHT = 14;

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  axis: {
    fontSize: AXIS_FONT_SIZE,
    lineHeight: AXIS_LINE_HEIGHT,
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDash: {
    flexDirection: 'row',
    gap: 2,
  },
  legendDashPart: {
    width: 5,
    height: 2,
    borderRadius: 1,
  },
});
