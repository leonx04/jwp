// Dòng chảy đồng lương: tiền vào kỳ này đi đâu — sơ đồ Sankey + danh sách tỷ lệ.
import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { IconButton } from '@/components/glass/IconButton';
import { AppText, Card, EmptyState, Screen } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { periodRange, periodRangeLabel, periodTitle, statsPeriod } from '@/features/stats/periods';
import { getCategoryTotals } from '@/features/stats/queries';
import { todayVn } from '@/lib/date';
import { t } from '@/lib/i18n';
import { createStyles, useTheme } from '@/theme';

import { layoutFlow, ribbonPath } from '../layout';

const CHART_HEIGHT = 280;
const BAR = 10;

export function FlowScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const startDay = useSettings((s) => s.startDayOfMonth);
  const transfers = useSettings((s) => s.transfersAsIncomeExpense);
  const [offset, setOffset] = useState(0);
  const [width, setWidth] = useState(0);

  const period = useMemo(() => statsPeriod('month', offset, todayVn(), startDay), [offset, startDay]);

  const { data } = useLiveData(
    ['transactions', 'categories'],
    () => {
      const range = { ...periodRange(period), transfersAsIncomeExpense: transfers };
      const income = getCategoryTotals(db, { ...range, type: 'income' }).reduce(
        (s, c) => s + c.amount,
        0,
      );
      const expenses = getCategoryTotals(db, { ...range, type: 'expense' });
      return { income, expenses };
    },
    [period.start, transfers],
  );

  const layout = useMemo(() => {
    if (!data) return null;
    return layoutFlow({
      income: data.income,
      expenses: data.expenses.map((c) => ({
        key: c.key,
        name: t(c.name),
        color: c.color,
        amount: c.amount,
      })),
      height: CHART_HEIGHT,
      labels: {
        income: t('Thu nhập'),
        shortfall: t('Từ số dư'),
        other: t('Khác'),
        remaining: t('Còn lại'),
      },
      colors: {
        income: colors.income,
        shortfall: colors.expense,
        other: colors.textMuted,
        remaining: colors.income,
      },
    });
  }, [data, colors]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width));
  const income = data?.income ?? 0;

  return (
    <Screen title="Dòng chảy đồng lương" scroll>
      <View style={styles.periodRow}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel={t('Kỳ trước')}
          onPress={() => setOffset(offset - 1)}
        />
        <View style={styles.periodLabel}>
          <AppText variant="heading">{periodTitle('month', period)}</AppText>
          <AppText variant="caption" color="textMuted">
            {periodRangeLabel(period)}
          </AppText>
        </View>
        <IconButton
          icon="chevron-forward"
          accessibilityLabel={t('Kỳ sau')}
          onPress={() => setOffset(offset + 1)}
        />
      </View>

      {!layout ? (
        <EmptyState icon="git-network-outline" title="Chưa có thu chi trong kỳ này" />
      ) : (
        <>
          <Card>
            <View style={styles.summary}>
              <View>
                <AppText variant="caption" color="textMuted">
                  Thu nhập
                </AppText>
                <AppText variant="heading" color="income">
                  {format.compact(income)}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText variant="caption" color="textMuted">
                  {layout.remaining >= 0 ? 'Còn lại' : 'Chi vượt thu'}
                </AppText>
                <AppText variant="heading" color={layout.remaining >= 0 ? 'income' : 'expense'}>
                  {format.compact(Math.abs(layout.remaining))}
                </AppText>
              </View>
            </View>
            <View onLayout={onLayout} style={{ height: CHART_HEIGHT }}>
              {width > 0 ? (
                <Svg width={width} height={CHART_HEIGHT}>
                  {layout.links.map((l, i) => (
                    <Path
                      key={i}
                      d={ribbonPath(BAR, l.from, width - BAR, l.to)}
                      fill={l.color}
                      fillOpacity={0.32}
                    />
                  ))}
                  {layout.left.map((n) => (
                    <Rect
                      key={n.key}
                      x={0}
                      y={n.y}
                      width={BAR}
                      height={Math.max(n.h, 1)}
                      rx={3}
                      fill={n.color}
                    />
                  ))}
                  {layout.right.map((n) => (
                    <Rect
                      key={n.key}
                      x={width - BAR}
                      y={n.y}
                      width={BAR}
                      height={Math.max(n.h, 1)}
                      rx={3}
                      fill={n.color}
                    />
                  ))}
                </Svg>
              ) : null}
            </View>
          </Card>

          <Card>
            {layout.right.map((n) => (
              <View key={n.key} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: n.color }]} />
                <AppText style={{ flex: 1 }}>{n.name}</AppText>
                <AppText color="textMuted" variant="caption">
                  {income > 0 ? `${Math.round((n.amount / income) * 100)}%` : ''}
                </AppText>
                <AppText style={styles.amount}>{format.money(n.amount)}</AppText>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const useStyles = createStyles((th) => ({
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodLabel: { alignItems: 'center' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: th.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  amount: { fontVariant: ['tabular-nums'], minWidth: 96, textAlign: 'right' },
}));
