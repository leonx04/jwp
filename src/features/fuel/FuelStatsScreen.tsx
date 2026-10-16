// Xăng xe: giá mỗi lít theo thời gian, chi / lít theo tháng, bao lâu đổ một lần, dự kiến lần tới.
import { useMemo } from 'react';
import { View } from 'react-native';

import { Sparkline } from '@/components/charts';
import { AppText, Card, EmptyState, Screen, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { useMoneyFormat } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { formatDate, todayVn } from '@/lib/date';
import { t } from '@/lib/i18n';
import { createStyles } from '@/theme';

import { listFuelFills, summarizeFuel } from './stats';

const group = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const liters = (n: number) => `${(Math.round(n * 10) / 10).toString().replace('.', ',')} ${t('lít')}`;

export function FuelStatsScreen() {
  const styles = useStyles();
  const format = useMoneyFormat();
  const { data: fills } = useLiveData(['transactions'], () => listFuelFills(db));
  const today = todayVn();
  const summary = useMemo(() => (fills ? summarizeFuel(fills, today) : null), [fills, today]);

  if (!summary) {
    return (
      <Screen title="Xăng xe" scroll>
        <EmptyState
          icon="speedometer-outline"
          title="Chưa có lần đổ xăng nào ghi giá"
          description="Khi thêm khoản chi xăng, nhập giá mỗi lít để app thống kê giá và chi phí."
        />
      </Screen>
    );
  }

  const thisMonth = summary.monthly[summary.monthly.length - 1];
  const maxMonth = Math.max(1, ...summary.monthly.map((m) => m.amount));
  const change = summary.lastChange;

  return (
    <Screen title="Xăng xe" scroll>
      <Card>
        <AppText variant="label" color="textMuted">
          Tháng này
        </AppText>
        <AppText variant="display">{format.money(thisMonth.amount)}</AppText>
        <AppText color="textMuted">
          {t('{liters} · {n} lần đổ', { liters: liters(thisMonth.liters), n: thisMonth.count })}
        </AppText>
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <View>
            <AppText variant="label" color="textMuted">
              Giá xăng lần gần nhất
            </AppText>
            <AppText variant="heading">{`${group(summary.lastPrice)}đ/${t('lít')}`}</AppText>
          </View>
          {change !== null && change !== 0 ? (
            <AppText color={change > 0 ? 'expense' : 'income'}>
              {change > 0 ? '▲ ' : '▼ '}
              {`${group(Math.abs(change))}đ`}
            </AppText>
          ) : null}
        </View>
        {summary.prices.length >= 2 ? (
          <Sparkline values={summary.prices} height={56} area endDot accessibilityLabel={t('Giá xăng theo thời gian')} />
        ) : null}
        <View style={styles.rowBetween}>
          <AppText variant="caption" color="textMuted">
            {t('Thấp nhất {price}', { price: `${group(summary.minPrice)}đ` })}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {t('Cao nhất {price}', { price: `${group(summary.maxPrice)}đ` })}
          </AppText>
        </View>
      </Card>

      <Card>
        <SectionTitle tone="section">6 tháng gần nhất</SectionTitle>
        {summary.monthly.map((m) => (
          <View key={m.key} style={styles.month}>
            <View style={styles.rowBetween}>
              <AppText variant="caption" color="textMuted">{`${m.key.slice(5)}/${m.key.slice(2, 4)}`}</AppText>
              <AppText variant="caption">
                {m.count ? `${format.compact(m.amount)} · ${liters(m.liters)}` : '—'}
              </AppText>
            </View>
            <ProgressBar value={m.amount / maxMonth} />
          </View>
        ))}
      </Card>

      <Card>
        <Row label="Tổng đã đổ" value={`${format.money(summary.totalAmount)} · ${liters(summary.totalLiters)}`} />
        <Row label="Giá trung bình" value={`${group(summary.avgPrice)}đ/${t('lít')}`} />
        <Row label="Số lần đổ" value={String(summary.count)} />
        {summary.avgGapDays ? (
          <Row label="Cách nhau trung bình" value={t('{n} ngày', { n: summary.avgGapDays })} />
        ) : null}
        {summary.nextEstimate ? (
          <Row label="Dự kiến đổ lần tới" value={formatDate(summary.nextEstimate)} />
        ) : null}
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.rowBetween}>
      <AppText color="textMuted">{label}</AppText>
      <AppText style={{ flexShrink: 1, textAlign: 'right' }}>{value}</AppText>
    </View>
  );
}

const useStyles = createStyles((th) => ({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: th.spacing.md },
  month: { gap: 4, paddingVertical: 2 },
}));
