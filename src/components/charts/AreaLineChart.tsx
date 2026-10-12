// Biểu đồ đường / vùng bằng react-native-svg + d3-shape (đường cong monotone, không vọt quá dữ liệu).
// - Nhiều chuỗi: chuỗi đầu là chính (tô vùng gradient), chuỗi sau thường là "kỳ trước" (nét đứt).
// - Vạch tham chiếu nét đứt (mức 0, ngưỡng an toàn, trung bình).
// - Chạm / kéo ngang để xem giá trị từng điểm (tính chỉ số trên luồng UI, chỉ báo về JS khi đổi điểm).
// - Hiện dần từ trái sang phải một lần khi mở (transform trên luồng UI, không chạy JS mỗi khung hình).
import { area as d3Area, curveMonotoneX, line as d3Line } from 'd3-shape';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme';

import { useAxisMoney } from './format';
import {
  AXIS_FONT_SIZE,
  AXIS_LINE_HEIGHT,
  AxisLabel,
  ChartLegend,
  RevealLayer,
  useChartWidth,
  useEntrance,
  useSvgId,
} from './primitives';
import { estimateTextWidth, linearScale, niceDomain, pickTickIndices } from './scale';

export type LineSeries = {
  key: string;
  /** Tên hiện trong chú thích + ô giá trị khi chạm */
  label?: string;
  /** Giá trị theo chỉ số trục X; null = không có dữ liệu (vd những ngày chưa tới) */
  values: readonly (number | null)[];
  color: string;
  /** Tô vùng dưới đường bằng gradient nhạt */
  area?: boolean;
  /** Nét đứt — dùng cho chuỗi so sánh (kỳ trước) */
  dashed?: boolean;
  /** Chấm tròn ở điểm cuối cùng có dữ liệu (mặc định: có với chuỗi tô vùng) */
  endDot?: boolean;
};

export type ReferenceLine = {
  key: string;
  value: number;
  color: string;
  /** Mẫu nét đứt SVG, vd '5 5' */
  dash?: string;
  label?: string;
};

type AreaLineChartProps = {
  series: readonly LineSeries[];
  /** Nhãn của từng điểm (cùng độ dài với values) — dùng cho trục X và ô giá trị */
  xLabels: readonly string[];
  height?: number;
  references?: readonly ReferenceLine[];
  /** Luôn có mức 0 trong miền giá trị (mặc định có) */
  includeZero?: boolean;
  yTickCount?: number;
  xTickCount?: number;
  /** Định dạng nhãn trục Y (mặc định: tiền rút gọn không ký hiệu) */
  formatValue?: (value: number) => string;
  /** Định dạng giá trị trong ô khi chạm (mặc định = formatValue) */
  formatTooltipValue?: (value: number) => string;
  /** Tiêu đề ô giá trị khi chạm (mặc định = xLabels[index]) */
  tooltipTitle?: (index: number) => string;
  /** Cho phép chạm / kéo để xem giá trị (mặc định có) */
  scrub?: boolean;
  onScrub?: (index: number | null) => void;
  /** Hiện chú thích khi có ≥ 2 chuỗi có nhãn (mặc định có) */
  legend?: boolean;
  /** Đổi giá trị này → chạy lại hiệu ứng xuất hiện (vd khi chuyển kỳ) */
  animationKey?: string | number;
  accessibilityLabel?: string;
};

const PAD_TOP = 10;
const PAD_RIGHT = 10;
const X_AXIS_HEIGHT = 22;
const X_LABEL_WIDTH = 64;
const EMPTY_REFERENCES: readonly ReferenceLine[] = [];

export function AreaLineChart({
  series,
  xLabels,
  height = 180,
  references = EMPTY_REFERENCES,
  includeZero = true,
  yTickCount = 4,
  xTickCount = 5,
  formatValue,
  formatTooltipValue,
  tooltipTitle,
  scrub = true,
  onScrub,
  legend = true,
  animationKey,
  accessibilityLabel,
}: AreaLineChartProps) {
  const { colors } = useTheme();
  const axisMoney = useAxisMoney();
  const format = formatValue ?? axisMoney;
  const formatTip = formatTooltipValue ?? format;
  const [width, onLayout] = useChartWidth();
  const gradientId = useSvgId('area');
  const progress = useEntrance(animationKey);
  const [active, setActive] = useState<number | null>(null);

  const count = series.reduce((max, s) => Math.max(max, s.values.length), 0);

  const geometry = useMemo(() => {
    if (width <= 0 || count === 0) return null;
    const values: number[] = [];
    for (const s of series) for (const v of s.values) if (v != null) values.push(v);
    for (const r of references) values.push(r.value);
    if (includeZero) values.push(0);
    const domain = niceDomain(Math.min(...values), Math.max(...values), yTickCount);
    const tickLabels = domain.ticks.map(format);
    const gutter = Math.max(...tickLabels.map((l) => estimateTextWidth(l, AXIS_FONT_SIZE))) + 8;
    const left = gutter;
    const right = width - PAD_RIGHT;
    const top = PAD_TOP;
    const bottom = height - X_AXIS_HEIGHT;
    const x = (index: number) =>
      count === 1 ? (left + right) / 2 : left + (index * (right - left)) / (count - 1);
    const y = linearScale([domain.min, domain.max], [bottom, top]);

    const line = d3Line<number | null>()
      .defined((v) => v != null)
      .x((_, i) => x(i))
      .y((v) => y(v ?? 0))
      .curve(curveMonotoneX);
    const area = d3Area<number | null>()
      .defined((v) => v != null)
      .x((_, i) => x(i))
      .y0(bottom)
      .y1((v) => y(v ?? 0))
      .curve(curveMonotoneX);

    const paths = series.map((s) => {
      let last = -1;
      s.values.forEach((v, i) => {
        if (v != null) last = i;
      });
      return {
        key: s.key,
        color: s.color,
        dashed: !!s.dashed,
        line: line(s.values) ?? '',
        area: s.area ? (area(s.values) ?? '') : null,
        endDot: (s.endDot ?? !!s.area) && last >= 0 ? { x: x(last), y: y(s.values[last] ?? 0) } : null,
      };
    });

    return {
      left,
      right,
      top,
      bottom,
      x,
      y,
      ticks: domain.ticks.map((value, i) => ({ value, label: tickLabels[i], y: y(value) })),
      xTicks: pickTickIndices(count, xTickCount),
      paths,
    };
  }, [width, height, count, series, references, includeZero, yTickCount, xTickCount, format]);

  // ── Chạm / kéo để xem giá trị ──
  const onScrubRef = useRef(onScrub);
  useEffect(() => {
    onScrubRef.current = onScrub;
  });
  useEffect(() => {
    onScrubRef.current?.(active);
  }, [active]);

  const lastIndex = useSharedValue(-1);
  const select = useCallback((index: number | null) => setActive(index), []);
  const toggle = useCallback(
    (index: number) => setActive((prev) => (prev === index ? null : index)),
    [],
  );

  const gesture = useMemo(() => {
    if (!geometry || !scrub || count === 0) return null;
    const left = geometry.left;
    const step = count > 1 ? (geometry.right - geometry.left) / (count - 1) : 1;
    const last = count - 1;
    const indexAt = (px: number) => {
      'worklet';
      return Math.max(0, Math.min(last, Math.round((px - left) / step)));
    };
    const pan = Gesture.Pan()
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onStart((e) => {
        'worklet';
        const index = indexAt(e.x);
        lastIndex.value = index;
        scheduleOnRN(select, index);
      })
      .onUpdate((e) => {
        'worklet';
        const index = indexAt(e.x);
        if (index !== lastIndex.value) {
          lastIndex.value = index;
          scheduleOnRN(select, index);
        }
      })
      .onFinalize(() => {
        'worklet';
        if (lastIndex.value !== -1) {
          lastIndex.value = -1;
          scheduleOnRN(select, null);
        }
      });
    const tap = Gesture.Tap()
      .maxDuration(300)
      .onEnd((e) => {
        'worklet';
        scheduleOnRN(toggle, indexAt(e.x));
      });
    return Gesture.Race(pan, tap);
  }, [geometry, scrub, count, lastIndex, select, toggle]);

  // Lớp dữ liệu chỉ dựng lại khi dữ liệu / kích thước đổi — không dựng lại khi kéo con trỏ
  const dataLayer = useMemo(() => {
    if (!geometry) return null;
    return (
      <Svg width={width} height={height}>
        <Defs>
          {geometry.paths.map((p, i) =>
            p.area != null ? (
              <LinearGradient key={p.key} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={p.color} stopOpacity={colors.dark ? 0.3 : 0.22} />
                <Stop offset="1" stopColor={p.color} stopOpacity={0.01} />
              </LinearGradient>
            ) : null,
          )}
        </Defs>
        {geometry.paths.map((p, i) =>
          p.area ? <Path key={`a-${p.key}`} d={p.area} fill={`url(#${gradientId}-${i})`} /> : null,
        )}
        {geometry.paths.map((p) => (
          <Path
            key={`l-${p.key}`}
            d={p.line}
            fill="none"
            stroke={p.color}
            strokeWidth={p.dashed ? 1.5 : 2}
            strokeDasharray={p.dashed ? '4 4' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeOpacity={p.dashed ? 0.75 : 1}
          />
        ))}
        {geometry.paths.map((p) =>
          p.endDot ? (
            <Circle
              key={`d-${p.key}`}
              cx={p.endDot.x}
              cy={p.endDot.y}
              r={4}
              fill={p.color}
              stroke={colors.surface}
              strokeWidth={2}
            />
          ) : null,
        )}
      </Svg>
    );
  }, [geometry, width, height, gradientId, colors.dark, colors.surface]);

  const shown = active != null && active < count ? active : null;
  const legendItems = series
    .filter((s) => s.label)
    .map((s) => ({ key: s.key, label: s.label ?? '', color: s.color, dashed: s.dashed }));

  return (
    <View style={styles.wrapper}>
      <View
        style={{ height }}
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        {geometry ? (
          <>
            {/* Lưới ngang (nét liền mảnh) + vạch tham chiếu (nét đứt) */}
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
              {references.map((ref) => (
                <Line
                  key={`r-${ref.key}`}
                  x1={geometry.left}
                  x2={geometry.right}
                  y1={geometry.y(ref.value)}
                  y2={geometry.y(ref.value)}
                  stroke={ref.color}
                  strokeWidth={1}
                  strokeDasharray={ref.dash ?? '5 5'}
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
            {references.map((ref) =>
              ref.label ? (
                <AxisLabel
                  key={`rl-${ref.key}`}
                  style={[
                    styles.refLabel,
                    {
                      right: PAD_RIGHT,
                      top: geometry.y(ref.value) - AXIS_LINE_HEIGHT - 1,
                      color: ref.color,
                    },
                  ]}
                >
                  {ref.label}
                </AxisLabel>
              ) : null,
            )}
            {geometry.xTicks.map((index, i) => {
              const label = xLabels[index];
              if (!label) return null;
              const x = geometry.x(index);
              const first = i === 0 && geometry.xTicks.length > 1;
              const last = i === geometry.xTicks.length - 1 && geometry.xTicks.length > 1;
              return (
                <AxisLabel
                  key={`x-${index}`}
                  strong={index === shown}
                  style={[
                    styles.xLabel,
                    { top: geometry.bottom + 6, width: X_LABEL_WIDTH },
                    first
                      ? { left: x - 2, textAlign: 'left' }
                      : last
                        ? { left: x - X_LABEL_WIDTH + 2, textAlign: 'right' }
                        : { left: x - X_LABEL_WIDTH / 2, textAlign: 'center' },
                  ]}
                >
                  {label}
                </AxisLabel>
              );
            })}

            <RevealLayer progress={progress} width={width} height={height}>
              {dataLayer}
            </RevealLayer>

            {shown != null ? (
              <Cursor
                x={geometry.x(shown)}
                top={geometry.top}
                bottom={geometry.bottom}
                width={width}
                height={height}
                points={series.map((s) => {
                  const v = s.values[shown];
                  return { key: s.key, color: s.color, y: v == null ? null : geometry.y(v) };
                })}
              />
            ) : null}
            {shown != null ? (
              <Tooltip
                x={geometry.x(shown)}
                width={width}
                title={tooltipTitle ? tooltipTitle(shown) : (xLabels[shown] ?? '')}
                rows={series.map((s) => ({
                  key: s.key,
                  color: s.color,
                  label: s.label,
                  value: s.values[shown] == null ? '—' : formatTip(s.values[shown] ?? 0),
                }))}
              />
            ) : null}

            {gesture ? (
              <GestureDetector gesture={gesture}>
                <View style={StyleSheet.absoluteFill} collapsable={false} />
              </GestureDetector>
            ) : null}
          </>
        ) : null}
      </View>
      {legend && legendItems.length >= 2 ? <ChartLegend items={legendItems} /> : null}
    </View>
  );
}

function Cursor({
  x,
  top,
  bottom,
  width,
  height,
  points,
}: {
  x: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  points: { key: string; color: string; y: number | null }[];
}) {
  const { colors } = useTheme();
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Line x1={x} x2={x} y1={top} y2={bottom} stroke={colors.textMuted} strokeOpacity={0.45} />
      {points.map((p) =>
        p.y == null ? null : (
          <Circle
            key={p.key}
            cx={x}
            cy={p.y}
            r={4.5}
            fill={p.color}
            stroke={colors.surface}
            strokeWidth={2}
          />
        ),
      )}
    </Svg>
  );
}

function Tooltip({
  x,
  width,
  title,
  rows,
}: {
  x: number;
  width: number;
  title: string;
  rows: { key: string; color: string; label?: string; value: string }[];
}) {
  const { colors, dark, fonts } = useTheme();
  // Con trỏ ở nửa phải → ô nằm bên trái con trỏ và ngược lại (không cần đo bề rộng ô)
  const side = x > width / 2 ? { right: width - x + 10 } : { left: x + 10 };
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tooltip,
        side,
        {
          backgroundColor: colors.glassActive,
          borderColor: colors.glassBorder,
          boxShadow: dark ? 'none' : `0 4px 14px ${colors.shadow}`,
        },
      ]}
    >
      <AppText variant="label" color="textMuted" numberOfLines={1}>
        {title}
      </AppText>
      {rows.map((row) => (
        <View key={row.key} style={styles.tooltipRow}>
          <View style={[styles.tooltipDot, { backgroundColor: row.color }]} />
          {row.label ? (
            <AppText variant="label" color="textMuted" numberOfLines={1}>
              {row.label}
            </AppText>
          ) : null}
          <AppText
            variant="label"
            style={{ fontFamily: fonts.semibold, fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
          >
            {row.value}
          </AppText>
        </View>
      ))}
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
  refLabel: {
    position: 'absolute',
    textAlign: 'right',
  },
  xLabel: {
    position: 'absolute',
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    maxWidth: 200,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tooltipDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
