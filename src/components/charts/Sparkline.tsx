// Đường xu hướng nhỏ không trục (thẻ số liệu, hàng danh sách). Rất nhẹ: một Path, không hiệu ứng.
import { area as d3Area, curveMonotoneX, line as d3Line } from 'd3-shape';
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

import { useChartWidth, useSvgId } from './primitives';

type SparklineProps = {
  values: readonly number[];
  /** Mặc định: màu chủ đạo */
  color?: string;
  /** Bỏ trống → co giãn theo khung cha */
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** Tô vùng nhạt dưới đường */
  area?: boolean;
  /** Chấm ở điểm cuối (kỳ hiện tại) */
  endDot?: boolean;
  accessibilityLabel?: string;
};

export function Sparkline({
  values,
  color,
  width: fixedWidth,
  height = 36,
  strokeWidth = 2,
  area = true,
  endDot = true,
  accessibilityLabel,
}: SparklineProps) {
  const { colors } = useTheme();
  const tint = color ?? colors.primary;
  const [measured, onLayout] = useChartWidth();
  const width = fixedWidth ?? measured;
  const gradientId = useSvgId('spark');
  const pad = endDot ? 4 : strokeWidth;

  const shape = useMemo(() => {
    if (width <= 0 || values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1);
    // Đường phẳng (mọi giá trị bằng nhau) nằm giữa khung
    const y = (v: number) =>
      max === min ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2);
    const line = d3Line<number>()
      .x((_, i) => x(i))
      .y(y)
      .curve(curveMonotoneX);
    const fill = d3Area<number>()
      .x((_, i) => x(i))
      .y0(height)
      .y1(y)
      .curve(curveMonotoneX);
    const last = values.length - 1;
    return {
      line: line(values) ?? '',
      area: fill(values) ?? '',
      end: { x: x(last), y: y(values[last]) },
    };
  }, [values, width, height, pad]);

  return (
    <View
      style={{ width: fixedWidth, height, flexGrow: fixedWidth ? 0 : 1 }}
      onLayout={fixedWidth ? undefined : onLayout}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {shape ? (
        <Svg width={width} height={height}>
          {area ? (
            <>
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={tint} stopOpacity={0.2} />
                  <Stop offset="1" stopColor={tint} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={shape.area} fill={`url(#${gradientId})`} />
            </>
          ) : null}
          <Path
            d={shape.line}
            fill="none"
            stroke={tint}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {endDot ? (
            <Circle
              cx={shape.end.x}
              cy={shape.end.y}
              r={3.5}
              fill={tint}
              stroke={colors.surface}
              strokeWidth={1.5}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
