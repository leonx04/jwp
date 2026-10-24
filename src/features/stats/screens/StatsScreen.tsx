// Thống kê: tổng quan kỳ, cơ cấu theo danh mục, xu hướng 6 tháng, tích luỹ so với kỳ trước, nhận xét.
import { t } from '@/lib/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AreaLineChart, BarChart, DonutChart, useAxisMoney } from '@/components/charts';
import { IconButton } from '@/components/glass/IconButton';
import { AppText, Card, EmptyState, IconBadge, Screen, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { addDays, todayVn, vnDateToMs } from '@/lib/date';
import { toAppIcon } from '@/lib/icons';
import { NEUTRAL_MARK, rgba, useTheme } from '@/theme';

import {
  averagePer,
  bucketByPeriods,
  categoryDeltas,
  cumulativeByDay,
  eachDay,
  findSpikes,
  foldSlices,
  projectPeriodEnd,
  sumFlows,
  topSpendingDay,
  topWeekday,
  weekdayPattern,
  type FlowType,
} from '../analysis';
import { buildInsights } from '../insights';
import {
  comparablePeriod,
  elapsedDays,
  isInProgress,
  monthShortLabel,
  monthsEnding,
  periodLength,
  periodRangeLabel,
  periodTitle,
  previousPeriod,
  statsPeriod,
  type StatsMode,
} from '../periods';
import { getTagTotals, loadStats } from '../queries';

const TYPE_TABS: { value: FlowType; label: string }[] = [
  { value: 'expense', label: 'Chi tiêu' },
  { value: 'income', label: 'Thu nhập' },
];
const MODE_TABS: { value: StatsMode; label: string }[] = [
  { value: 'month', label: 'Tháng' },
  { value: 'year', label: 'Năm' },
];

export function StatsScreen() {
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const axisMoney = useAxisMoney();
  const startDay = useSettings((s) => s.startDayOfMonth);
  const transfers = useSettings((s) => s.transfersAsIncomeExpense);
  const [mode, setMode] = useState<StatsMode>('month');
  const [type, setType] = useState<FlowType>('expense');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const today = todayVn();
  const period = statsPeriod(mode, offset, today, startDay);
  const previous = previousPeriod(mode, period, startDay);
  const inProgress = isInProgress(period, today);
  const elapsed = elapsedDays(period, today);
  const comparable = inProgress ? comparablePeriod(previous, elapsed) : previous;
  const bars = useMemo(() => monthsEnding(period, 6, startDay), [period, startDay]);
  const dailyRange = { start: bars[0].start, end: period.end };
  const baseline = mode === 'month' ? { start: bars[0].start, end: bars[4].end } : null;

  const { data } = useLiveData(
    ['transactions', 'categories'],
    () =>
      loadStats(db, {
        type,
        current: period,
        comparable,
        baseline,
        dailyRange,
        transfersAsIncomeExpense: transfers,
      }),
    [type, period.start, period.end, transfers],
  );

  const { data: tagTotals = [] } = useLiveData(
    ['transactions', 'tags'],
    () =>
      getTagTotals(db, {
        from: vnDateToMs(period.start),
        to: vnDateToMs(addDays(period.end, 1)),
        type,
      }),
    [type, period.start, period.end],
  );

  const view = useMemo(() => {
    if (!data) return null;
    const total = data.categories.reduce((s, c) => s + c.amount, 0);
    const previousTotal = data.previousCategories.reduce((s, c) => s + c.amount, 0);
    const deltas = categoryDeltas(data.categories, data.previousCategories);
    const length = periodLength(period);
    const units = mode === 'year' ? 12 : Math.max(1, inProgress ? elapsed : length);
    const average = averagePer(total, units);
    const topDay = topSpendingDay(data.daily, type, period);
    const pattern = weekdayPattern(data.daily, type, period.start, period.end);
    const projection = inProgress
      ? projectPeriodEnd({ spent: total, elapsedDays: elapsed, totalDays: length })
      : null;
    const fullPrevious = sumFlows(data.daily, type, previous.start, previous.end);
    const spikes = baseline
      ? findSpikes(data.categories, data.baselineCategories, 5, { minDelta: 100_000 })
      : [];
    const insights = buildInsights({
      type,
      mode,
      inProgress,
      total,
      previousTotal,
      previousFullTotal: fullPrevious,
      categories: deltas,
      spikes,
      average,
      topDay,
      topWeekday: topWeekday(pattern),
      projection,
      format: format.compact,
      limit: 5,
    });
    const slices = foldSlices(deltas, 6, { name: 'Khác', color: NEUTRAL_MARK });
    const buckets = bucketByPeriods(
      data.daily,
      mode === 'year' ? monthsEnding({ start: period.end, end: period.end }, 12, startDay) : bars,
    );
    const days = eachDay(period.start, period.end);
    const curCum = cumulativeByDay(data.daily, type, period, inProgress ? today : period.end);
    const prevCum = cumulativeByDay(data.daily, type, previous);
    return {
      total,
      previousTotal,
      deltas,
      average,
      projection,
      insights,
      slices,
      buckets,
      days,
      curCum,
      prevCum,
    };
  }, [
    data,
    type,
    mode,
    period,
    previous,
    inProgress,
    elapsed,
    baseline,
    bars,
    startDay,
    today,
    format.compact,
  ]);

  const sliceColor = type === 'expense' ? colors.expense : colors.income;
  const change =
    view && view.previousTotal > 0
      ? ((view.total - view.previousTotal) / view.previousTotal) * 100
      : null;

  return (
    <Screen
      title="Thống kê"
      headerRight={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton
            icon="chevron-back"
            accessibilityLabel={t('Kỳ trước')}
            onPress={() => setOffset(offset - 1)}
          />
          <IconButton
            icon="chevron-forward"
            accessibilityLabel={t('Kỳ sau')}
            disabled={offset >= 0}
            onPress={() => setOffset(Math.min(0, offset + 1))}
          />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {MODE_TABS.map((t) => (
          <Pill
            key={t.value}
            label={t.label}
            active={mode === t.value}
            onPress={() => {
              setMode(t.value);
              setOffset(0);
            }}
          />
        ))}
        <View style={{ flexBasis: '100%', height: 0 }} />
        {TYPE_TABS.map((t) => (
          <Pill
            key={t.value}
            label={t.label}
            active={type === t.value}
            onPress={() => {
              setType(t.value);
              setSelected(null);
            }}
          />
        ))}
      </View>

      <Card style={{ gap: 4 }}>
        <AppText variant="label" color="textMuted">
          {periodTitle(mode, period).toUpperCase()} · {periodRangeLabel(period)}
        </AppText>
        <AppText
          variant="display"
          color={type === 'expense' ? 'expense' : 'income'}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {format.money(view?.total ?? 0)}
        </AppText>
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          {change != null ? (
            <AppText
              variant="caption"
              color={change > 0 === (type === 'expense') ? 'expense' : 'income'}
            >
              {change > 0 ? '▲' : '▼'} {Math.abs(Math.round(change))}% so với{' '}
              {inProgress ? 'cùng kỳ trước' : 'kỳ trước'}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textMuted">
            TB {format.compact(view?.average ?? 0)}/{mode === 'year' ? 'tháng' : 'ngày'}
          </AppText>
          {view?.projection ? (
            <AppText variant="caption" color="textMuted">
              Dự kiến cuối kỳ {format.compact(view.projection)}
            </AppText>
          ) : null}
        </View>
      </Card>

      {view && view.total > 0 ? (
        <>
          <SectionTitle tone="section">Theo danh mục</SectionTitle>
          <Card style={{ gap: 14, alignItems: 'center' }}>
            <DonutChart
              data={view.slices}
              selectedKey={selected}
              onSelect={setSelected}
              animationKey={`${type}-${period.start}`}
              center={
                <View style={{ alignItems: 'center' }}>
                  <AppText variant="label" color="textMuted">
                    {selected ? (view.slices.find((s) => s.key === selected)?.label ?? '') : 'Tổng'}
                  </AppText>
                  <AppText
                    variant="heading"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {format.compact(
                      selected
                        ? (view.slices.find((s) => s.key === selected)?.value ?? 0)
                        : view.total,
                    )}
                  </AppText>
                </View>
              }
            />
            <View style={{ alignSelf: 'stretch', gap: 10 }}>
              {view.deltas.slice(0, 8).map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => setSelected(selected === c.key ? null : c.key)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <IconBadge
                    icon={toAppIcon(c.icon, 'pricetag-outline')}
                    color={c.color}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium" numberOfLines={1}>
                      {c.name}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {Math.round(c.share * 100)}% · {c.count} giao dịch
                      {c.change != null
                        ? ` · ${c.change > 0 ? '+' : ''}${Math.round(c.change)}%`
                        : ''}
                    </AppText>
                  </View>
                  <AppText
                    variant="bodyMedium"
                    style={{ fontVariant: ['tabular-nums'] }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {format.compact(c.amount)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </Card>

          {tagTotals.length ? (
            <>
              <SectionTitle tone="section">Theo tag</SectionTitle>
              <Card>
                {tagTotals.slice(0, 8).map((g) => (
                  <Pressable
                    key={g.tagId}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/transactions', params: { tagId: g.tagId } })
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="bodyMedium" numberOfLines={1}>{`#${g.name}`}</AppText>
                      <ProgressBar
                        value={tagTotals[0].amount > 0 ? g.amount / tagTotals[0].amount : 0}
                        color={g.color ?? sliceColor}
                        height={6}
                      />
                      <AppText variant="caption" color="textMuted">
                        {t('{count} giao dịch', { count: g.count })}
                      </AppText>
                    </View>
                    <AppText variant="bodyMedium" style={{ fontVariant: ['tabular-nums'] }}>
                      {format.compact(g.amount)}
                    </AppText>
                  </Pressable>
                ))}
              </Card>
              <AppText variant="caption" color="textMuted">
                Giao dịch gắn nhiều tag được tính vào từng tag.
              </AppText>
            </>
          ) : null}

          <SectionTitle tone="section">
            {mode === 'year' ? 'Theo tháng' : 'Xu hướng 6 tháng'}
          </SectionTitle>
          <Card>
            <BarChart
              data={view.buckets.map((b) => ({
                key: b.period.start,
                label: monthShortLabel(b.period),
                values: [type === 'expense' ? b.expense : b.income],
              }))}
              series={[{ key: 'v', label: type === 'expense' ? 'Chi' : 'Thu', color: sliceColor }]}
              average={{
                value: averagePer(
                  view.buckets.reduce((s, b) => s + (type === 'expense' ? b.expense : b.income), 0),
                  view.buckets.length,
                ),
              }}
              formatValue={axisMoney}
              animationKey={`${type}-${period.start}`}
            />
          </Card>

          {mode === 'month' ? (
            <>
              <SectionTitle tone="section">Tích luỹ trong tháng</SectionTitle>
              <Card>
                <AreaLineChart
                  series={[
                    {
                      key: 'cur',
                      label: 'Kỳ này',
                      values: view.curCum,
                      color: sliceColor,
                      area: true,
                      endDot: true,
                    },
                    {
                      key: 'prev',
                      label: 'Kỳ trước',
                      values: view.prevCum,
                      color: rgba(colors.text, 0.45),
                      dashed: true,
                    },
                  ]}
                  xLabels={view.days.map((d) => d.slice(8))}
                  formatValue={axisMoney}
                  tooltipTitle={(i) => t('Ngày {slice}', { slice: view.days[i]?.slice(8) ?? '' })}
                  animationKey={`${type}-${period.start}`}
                />
              </Card>
            </>
          ) : null}

          {view.insights.length ? (
            <>
              <SectionTitle tone="section">Nhận xét</SectionTitle>
              <Card style={{ gap: 12 }}>
                {view.insights.map((i) => (
                  <View
                    key={i.key}
                    style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
                  >
                    <Ionicons
                      name={
                        i.tone === 'good'
                          ? 'trending-down'
                          : i.tone === 'bad'
                            ? 'trending-up'
                            : 'bulb-outline'
                      }
                      size={20}
                      color={
                        i.tone === 'good'
                          ? colors.income
                          : i.tone === 'bad'
                            ? colors.expense
                            : colors.primary
                      }
                    />
                    <AppText style={{ flex: 1 }}>{i.text}</AppText>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : (
        <Card>
          <EmptyState
            icon="stats-chart-outline"
            title="Chưa có dữ liệu"
            description="Ghi vài giao dịch trong kỳ này để xem thống kê."
          />
        </Card>
      )}
    </Screen>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? rgba(colors.primary, 0.22) : rgba(colors.text, 0.06),
        borderWidth: active ? 1 : 0,
        borderColor: colors.primary,
      }}
    >
      <AppText variant="bodyMedium" color={active ? 'primary' : 'textMuted'}>
        {label}
      </AppText>
    </Pressable>
  );
}
