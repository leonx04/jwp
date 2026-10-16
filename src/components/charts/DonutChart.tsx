// Biểu đồ vành khuyên (donut) cơ cấu theo danh mục: khe hở giữa các phần, nhãn / giá trị ở giữa.
// Chạm vào một phần → onSelect(key) (phần đó nổi lên, phần khác nhạt đi); chạm vào giữa → bỏ chọn.
// Xuất hiện một lần: mờ → rõ + xoay nhẹ (transform trên luồng UI).
import { arc as d3Arc, pie as d3Pie, type PieArcDatum } from 'd3-shape';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

import { useEntrance } from './primitives';

export type DonutSlice = {
  key: string;
  value: number;
  color: string;
  label?: string;
};

type DonutChartProps = {
  data: readonly DonutSlice[];
  /** Đường kính (px) */
  size?: number;
  /** Độ dày vành */
  thickness?: number;
  /** Khe hở giữa các phần (px, đo ở mép ngoài) */
  gap?: number;
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  /** Nội dung ở giữa vòng (tổng, tên phần đang chọn…) */
  center?: ReactNode;
  animationKey?: string | number;
  accessibilityLabel?: string;
};

const SELECTED_GROW = 4;

export function DonutChart({
  data,
  size = 200,
  thickness = 22,
  gap = 2,
  selectedKey = null,
  onSelect,
  center,
  animationKey,
  accessibilityLabel,
}: DonutChartProps) {
  const { colors } = useTheme();
  const progress = useEntrance(animationKey, 700);
  const radius = size / 2 - SELECTED_GROW;
  const inner = radius - thickness;

  const arcs = useMemo(() => {
    const slices = data.filter((d) => d.value > 0);
    if (!slices.length) return [];
    const pie = d3Pie<DonutSlice>()
      .value((d) => d.value)
      .sort(null)
      // Chỉ chừa khe khi có ≥ 2 phần (một phần duy nhất là vòng tròn liền)
      .padAngle(slices.length > 1 ? gap / radius : 0);
    const base = d3Arc<PieArcDatum<DonutSlice>>()
      .innerRadius(inner)
      .outerRadius(radius)
      .cornerRadius(Math.min(4, thickness / 4));
    const raised = d3Arc<PieArcDatum<DonutSlice>>()
      .innerRadius(inner)
      .outerRadius(radius + SELECTED_GROW)
      .cornerRadius(Math.min(4, thickness / 4));
    return pie(slices).map((a) => ({
      key: a.data.key,
      color: a.data.color,
      startAngle: a.startAngle,
      endAngle: a.endAngle,
      path: base(a) ?? '',
      raisedPath: raised(a) ?? '',
    }));
  }, [data, gap, radius, inner, thickness]);

  const hasSelection = selectedKey != null && arcs.some((a) => a.key === selectedKey);

  const enter = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const onPress = (event: GestureResponderEvent) => {
    if (!onSelect) return;
    const { locationX, locationY } = event.nativeEvent;
    const dx = locationX - size / 2;
    const dy = locationY - size / 2;
    const distance = Math.hypot(dx, dy);
    if (distance < inner - 10) {
      onSelect(null);
      return;
    }
    if (distance > radius + 16) return;
    // Góc của d3-shape: 0 ở hướng 12 giờ, tăng theo chiều kim đồng hồ
    let angle = Math.atan2(dx, -dy);
    if (angle < 0) angle += Math.PI * 2;
    const hit = arcs.find((a) => angle >= a.startAngle && angle <= a.endAngle);
    if (hit) onSelect(hit.key === selectedKey ? null : hit.key);
  };

  return (
    <Pressable
      onPress={onSelect ? onPress : undefined}
      disabled={!onSelect}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, enter]} pointerEvents="none">
        <Svg width={size} height={size}>
          <G x={size / 2} y={size / 2}>
            {arcs.length === 0 ? (
              <Circle
                r={radius - thickness / 2}
                fill="none"
                stroke={colors.border}
                strokeWidth={thickness}
              />
            ) : (
              arcs.map((a) => {
                const selected = a.key === selectedKey;
                return (
                  <Path
                    key={a.key}
                    d={selected ? a.raisedPath : a.path}
                    fill={a.color}
                    fillOpacity={hasSelection && !selected ? 0.3 : 1}
                  />
                );
              })
            )}
          </G>
        </Svg>
      </Animated.View>
      {center ? (
        <View
          pointerEvents="none"
          style={[styles.center, { left: size / 2 - inner + 8, right: size / 2 - inner + 8 }]}
        >
          {center}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
