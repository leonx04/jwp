// Biểu đồ đường số dư dự kiến (victory-native, vẽ bằng Skia trên GPU).
// Vạch đứt đỏ ở mức 0 ₫ và vạch vàng ở ngưỡng an toàn.
import { BeVietnamPro_500Medium } from '@expo-google-fonts/be-vietnam-pro';
import {
  DashPathEffect,
  LinearGradient,
  Line as SkLine,
  useFont,
  vec,
} from '@shopify/react-native-skia';
import { View } from 'react-native';
import { Area, CartesianChart, Line } from 'victory-native';

import { parseDate, type DateString } from '@/lib/date';
import { formatCompact } from '@/lib/money';
import { rgba, useTheme } from '@/theme';

type Point = { date: DateString; balance: number };

type BalanceLineChartProps = {
  points: readonly Point[];
  safetyThreshold?: number;
  height?: number;
};

export function BalanceLineChart({
  points,
  safetyThreshold = 0,
  height = 180,
}: BalanceLineChartProps) {
  const { colors } = useTheme();
  const font = useFont(BeVietnamPro_500Medium, 10);
  const data = points.map((p, index) => ({ x: index, y: p.balance }));
  const min = Math.min(0, safetyThreshold, ...data.map((d) => d.y));
  const max = Math.max(0, ...data.map((d) => d.y));
  const pad = Math.max(1, (max - min) * 0.12);
  const lineColor = data.some((d) => d.y < 0) ? colors.expense : colors.primary;

  if (data.length < 2) return <View style={{ height }} />;

  return (
    <View style={{ height }}>
      <CartesianChart
        data={data}
        xKey="x"
        yKeys={['y']}
        domain={{ y: [min - pad, max + pad] }}
        padding={{ left: 4, right: 8, top: 8, bottom: 4 }}
        xAxis={{
          font,
          tickCount: 4,
          labelColor: colors.textMuted,
          lineColor: 'transparent',
          formatXLabel: (x) => {
            const p = points[Math.round(Number(x))];
            if (!p) return '';
            const { day, month } = parseDate(p.date);
            return `${day}/${month}`;
          },
        }}
        yAxis={[
          {
            font,
            tickCount: 4,
            labelColor: colors.textMuted,
            lineColor: rgba(colors.textMuted, 0.15),
            formatYLabel: (y) => formatCompact(Number(y)).replace(/ ₫$/, ''),
          },
        ]}
      >
        {({ points: chartPoints, chartBounds, yScale }) => (
          <>
            <Area
              points={chartPoints.y}
              y0={chartBounds.bottom}
              curveType="monotoneX"
              animate={{ type: 'timing', duration: 400 }}
            >
              <LinearGradient
                start={vec(0, chartBounds.top)}
                end={vec(0, chartBounds.bottom)}
                colors={[rgba(lineColor, 0.35), rgba(lineColor, 0.02)]}
              />
            </Area>
            <Line
              points={chartPoints.y}
              color={lineColor}
              strokeWidth={2.5}
              curveType="monotoneX"
              animate={{ type: 'timing', duration: 400 }}
            />
            <SkLine
              p1={vec(chartBounds.left, yScale(0))}
              p2={vec(chartBounds.right, yScale(0))}
              color={rgba(colors.expense, 0.7)}
              strokeWidth={1}
            >
              <DashPathEffect intervals={[5, 5]} />
            </SkLine>
            {safetyThreshold > 0 ? (
              <SkLine
                p1={vec(chartBounds.left, yScale(safetyThreshold))}
                p2={vec(chartBounds.right, yScale(safetyThreshold))}
                color={rgba(colors.warning, 0.7)}
                strokeWidth={1}
              >
                <DashPathEffect intervals={[3, 5]} />
              </SkLine>
            ) : null}
          </>
        )}
      </CartesianChart>
    </View>
  );
}
