// Biểu đồ đường số dư dự kiến (SVG — không dùng Skia).
// Vạch đứt đỏ ở mức 0 ₫ và vạch vàng ở ngưỡng an toàn. Chạm / kéo để xem số dư từng ngày.
import { t } from '@/lib/i18n';
import { useMemo } from 'react';
import { View } from 'react-native';

import { useMoneyFormat } from '@/features/settings/hooks/useMoneyFormat';
import { formatDayHeader, parseDate, type DateString } from '@/lib/date';
import { rgba, useTheme } from '@/theme';

import { AreaLineChart, type LineSeries, type ReferenceLine } from './AreaLineChart';

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
  const format = useMoneyFormat();

  const { series, labels, references, summary } = useMemo(() => {
    const balances = points.map((p) => p.balance);
    const negative = balances.some((b) => b < 0);
    const lineColor = negative ? colors.expense : colors.primary;
    const refs: ReferenceLine[] = [
      { key: 'zero', value: 0, color: rgba(colors.expense, 0.7), dash: '5 5' },
    ];
    if (safetyThreshold > 0) {
      refs.push({
        key: 'safety',
        value: safetyThreshold,
        color: rgba(colors.warning, 0.75),
        dash: '3 5',
      });
    }
    const lowest = balances.length ? Math.min(...balances) : 0;
    const last = balances.length ? balances[balances.length - 1] : 0;
    return {
      series: [
        { key: 'balance', label: 'Số dư', values: balances, color: lineColor, area: true },
      ] satisfies LineSeries[],
      labels: points.map((p) => {
        const { day, month } = parseDate(p.date);
        return `${day}/${month}`;
      }),
      references: refs,
      summary: t('Số dư dự kiến: cuối kỳ {last}, thấp nhất {lowest}', {
        last: format.money(last),
        lowest: format.money(lowest),
      }),
    };
  }, [points, safetyThreshold, colors.expense, colors.primary, colors.warning, format]);

  if (points.length < 2) return <View style={{ height }} />;

  return (
    <AreaLineChart
      series={series}
      xLabels={labels}
      height={height}
      references={references}
      xTickCount={4}
      legend={false}
      formatTooltipValue={format.money}
      tooltipTitle={(index) => formatDayHeader(points[index].date)}
      accessibilityLabel={summary}
    />
  );
}
