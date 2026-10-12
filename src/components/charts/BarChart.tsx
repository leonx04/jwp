// Biểu đồ cột dọc bằng react-native-svg: một chuỗi hoặc cặp (vd thu / chi), bo góc trên 4px, đáy vuông.
// - Vạch trung bình nét đứt + nhãn.
// - Cột đang chọn rõ nét, các cột khác nhạt đi; chạm vào cột → onSelect (vùng chạm rộng cả khe).
// - Cột "mọc" lên từ đường gốc một lần khi mở (scaleY trên luồng UI).
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

import { useAxisMoney } from './format';
import {
  AXIS_FONT_SIZE,
  AXIS_LINE_HEIGHT,
  AxisLabel,
  ChartLegend,
  GrowLayer,
  useChartWidth,
  useEntrance,
} from './primitives';
import { estimateTextWidth, linearScale, niceDomain, roundedTopBarPath } from './scale';

export type BarSeries = { key: string; label: string; color: string };

export type BarGroup = {
  key: string;
  /** Nhãn dưới cột (ngắn: 'T10', 'T2') */
  label: string;
  /** Giá trị theo thứ tự `series` (≥ 0) */
  values: readonly number[];
  /** Mô tả cho trình đọc màn hình; mặc định ghép nhãn + giá trị */
  accessibilityLabel?: string;
};

export type BarAverage = { value: number; label?: string; color?: string };

type BarChartProps = {
  data: readonly BarGroup[];
  series: readonly BarSeries[];
  height?: number;
  average?: BarAverage | null;
  /** Cột đang chọn (null = không chọn → mọi cột rõ nét) */
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
  /** Ghi giá trị lên đỉnh cột đang chọn (chỉ khi một chuỗi) */
  labelSelected?: boolean;
  formatValue?: (value: number) => string;
  yTickCount?: number;
  /** Hiện chú thích khi có ≥ 2 chuỗi (mặc định có) */
  legend?: boolean;
  animationKey?: string | number;
  accessibilityLabel?: string;
};

const PAD_TOP = 18;
const PAD_RIGHT = 6;
const X_AXIS_HEIGHT = 22;
const MAX_BAR = 22;
const PAIR_GAP = 3;

export function BarChart({
  data,
  series,
  height = 180,
  average,
  selectedIndex = null,
  onSelect,
  labelSelected = false,
  formatValue,
  yTickCount = 3,
  legend = true,
  animationKey,
  accessibilityLabel,
}: BarChartProps) {
  const { colors } = useTheme();
  const axisMoney = useAxisMoney();
  const format = formatValue ?? axisMoney;
  const [width, onLayout] = useChartWidth();
  const progress = useEntrance(animationKey, 600);

  const geometry = useMemo(() => {
    if (width <= 0 || data.length === 0) return null;
    let max = 0;
    for (const group of data) for (const v of group.values) max = Math.max(max, v);
    if (average) max = Math.max(max, average.value);
    const domain = niceDomain(0, max, yTickCount);
    const tickLabels = domain.ticks.map(format);
    const gutter = Math.max(...tickLabels.map((l) => estimateTextWidth(l, AXIS_FONT_SIZE))) + 8;
    const left = gutter;
    const right = width - PAD_RIGHT;
    const top = PAD_TOP;
    const bottom = height - X_AXIS_HEIGHT;
    const y = linearScale([0, domain.max], [bottom, top]);
    const slot = (right - left) / data.length;
    const k = Math.max(1, series.length);
    // Cột mảnh, chừa khoảng thở giữa các khe (≤ 22px/cột)
    const barWidth = Math.max(
      3,
      Math.min(MAX_BAR, (slot * (k > 1 ? 0.72 : 0.56) - PAIR_GAP * (k - 1)) / k),
    );
    const groupWidth = barWidth * k + PAIR_GAP * (k - 1);

    const groups = data.map((group, index) => {
      const center = left + slot * (index + 0.5);
      const start = center - groupWidth / 2;
      const bars = series.map((s, si) => {
        const value = Math.max(0, group.values[si] ?? 0);
        const yTop = y(value);
        const h = bottom - yTop;
        return {
          key: s.key,
          color: s.color,
          value,
          // Giá trị > 0 nhưng quá nhỏ vẫn hiện một vệt 2px để không trông như "không có"
          path: value > 0 ? roundedTopBarPath(start + si * (barWidth + PAIR_GAP), Math.min(yTop, bottom - 2), barWidth, Math.max(h, 2)) : '',
          top: yTop,
        };
      });
      return { key: group.key, center, slotLeft: left + slot * index, bars };
    });

    return {
      left,
      right,
      top,
      bottom,
      slot,
      ticks: domain.ticks.map((value, i) => ({ value, label: tickLabels[i], y: y(value) })),
      averageY: average ? y(average.value) : null,
      groups,
    };
  }, [width, height, data, series, average, yTickCount, format]);

  const hasSelection = selectedIndex != null && selectedIndex >= 0 && selectedIndex < data.length;

  const bars = useMemo(() => {
    if (!geometry) return null;
    return (
      <Svg width={width} height={geometry.bottom}>
        {geometry.groups.map((group, index) =>
          group.bars.map((bar) =>
            bar.path ? (
              <Path
                key={`${group.key}-${bar.key}`}
                d={bar.path}
                fill={bar.color}
                fillOpacity={hasSelection && index !== selectedIndex ? 0.38 : 1}
              />
            ) : null,
          ),
        )}
      </Svg>
    );
  }, [geometry, width, hasSelection, selectedIndex]);

  const selectedGroup = hasSelection && geometry ? geometry.groups[selectedIndex] : null;
  const selectedTop =
    selectedGroup && labelSelected && series.length === 1 && selectedGroup.bars[0]?.value > 0
      ? selectedGroup.bars[0]
      : null;

  return (
    <View style={styles.wrapper}>
      <View
        style={{ height }}
        onLayout={onLayout}
        accessibilityRole={onSelect ? undefined : 'image'}
        accessible={!onSelect}
        accessibilityLabel={onSelect ? undefined : accessibilityLabel}
      >
        {geometry ? (
          <>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              {geometry.ticks.map((tick) => (
                <Line
                  key={`g-${tick.value}`}
                  x1={geometry.left}
                  x2={geometry.right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
            </Svg>
            {geometry.ticks.map((tick) => (
              <AxisLabel
                key={`y-${tick.value}`}
                style={[
                  styles.yLabel,
                  { width: geometry.left - 6, top: tick.y - AXIS_LINE_HEIGHT / 2 },
                ]}
              >
                {tick.label}
              </AxisLabel>
            ))}

            <GrowLayer progress={progress} width={width} height={geometry.bottom}>
              {bars}
            </GrowLayer>

            {geometry.averageY != null && average ? (
              <>
                <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Line
                    x1={geometry.left}
                    x2={geometry.right}
                    y1={geometry.averageY}
                    y2={geometry.averageY}
                    stroke={average.color ?? colors.textMuted}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                </Svg>
                {average.label ? (
                  <AxisLabel
                    style={[
                      styles.averageLabel,
                      {
                        right: PAD_RIGHT,
                        top: geometry.averageY - AXIS_LINE_HEIGHT - 1,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    {average.label}
                  </AxisLabel>
                ) : null}
              </>
            ) : null}

            {selectedGroup && selectedTop ? (
              <AxisLabel
                strong
                style={[
                  styles.valueLabel,
                  {
                    left: selectedGroup.center - 40,
                    top: Math.max(0, selectedTop.top - AXIS_LINE_HEIGHT - 3),
                  },
                ]}
              >
                {format(selectedTop.value)}
              </AxisLabel>
            ) : null}

            {geometry.groups.map((group, index) => (
              <AxisLabel
                key={`x-${group.key}`}
                strong={index === selectedIndex}
                style={[
                  styles.xLabel,
                  {
                    left: group.slotLeft,
                    width: geometry.slot,
                    top: geometry.bottom + 6,
                  },
                ]}
              >
                {data[index].label}
              </AxisLabel>
            ))}

            {onSelect
              ? geometry.groups.map((group, index) => (
                  <Pressable
                    key={`p-${group.key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: index === selectedIndex }}
                    accessibilityLabel={
                      data[index].accessibilityLabel ??
                      `${data[index].label}: ${series
                        .map((s, si) => `${s.label} ${format(data[index].values[si] ?? 0)}`)
                        .join(', ')}`
                    }
                    onPress={() => onSelect(index)}
                    style={[
                      styles.hit,
                      { left: group.slotLeft, width: geometry.slot, height },
                    ]}
                  />
                ))
              : null}
          </>
        ) : null}
      </View>
      {legend && series.length >= 2 ? (
        <ChartLegend items={series.map((s) => ({ key: s.key, label: s.label, color: s.color }))} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    textAlign: 'right',
  },
  xLabel: {
    position: 'absolute',
    textAlign: 'center',
  },
  averageLabel: {
    position: 'absolute',
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  valueLabel: {
    position: 'absolute',
    width: 80,
    textAlign: 'center',
  },
  hit: {
    position: 'absolute',
    top: 0,
  },
});
