// Tổng kết kỳ kiểu "Wrapped": các thẻ vuốt ngang — tiền vào/ra, danh mục số một, ngày chi nhiều nhất,
// nơi hay ghé, khoản lớn nhất, ngày không chi, lời nhận xét. Chia sẻ dạng chữ.
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { FlatList, Share, View, useWindowDimensions } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import { AppText, EmptyState, Screen, SegmentedControl } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { periodRange, periodTitle, statsPeriod, type StatsMode } from '@/features/stats/periods';
import { listTransactions } from '@/features/transactions/queries';
import { formatDate, todayVn, WEEKDAY_NAMES } from '@/lib/date';
import { t } from '@/lib/i18n';
import type { IconName } from '@/lib/icons';
import { createStyles, useTheme } from '@/theme';

import { buildWrapped, type Wrapped } from '../wrapped';

const MODES = [
  { value: 'month', label: 'Tháng' },
  { value: 'year', label: 'Năm' },
] as const;

type Slide = { id: string; icon: IconName; kicker: string; big: string; lines: string[] };

const VERDICT: Record<Wrapped['verdict'], string> = {
  great: 'Kỳ tiết kiệm đỉnh! Bạn giữ lại hơn 30% thu nhập.',
  good: 'Giữ nhịp tốt: còn dư từ 10% thu nhập.',
  tight: 'Gần hết lương rồi — thử đặt thêm ngân sách cho khoản chi lớn.',
  over: 'Chi vượt thu. Xem lại các khoản lớn ở thẻ trước nhé.',
  none: 'Chưa ghi thu nhập trong kỳ này nên chưa tính được tỷ lệ tiết kiệm.',
};

export function WrappedScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const { width } = useWindowDimensions();
  const startDay = useSettings((s) => s.startDayOfMonth);
  const [mode, setMode] = useState<StatsMode>('month');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(0);

  const period = useMemo(
    () => statsPeriod(mode, offset, todayVn(), startDay),
    [mode, offset, startDay],
  );

  const { data: items } = useLiveData(
    ['transactions', 'categories'],
    () => listTransactions(db, periodRange(period)),
    [period.start, period.end],
  );

  const wrapped = useMemo(
    () => (items ? buildWrapped(items, { ...period, today: todayVn() }) : null),
    [items, period],
  );

  const slides = useMemo<Slide[]>(() => {
    if (!wrapped || !wrapped.txCount) return [];
    const out: Slide[] = [
      {
        id: 'total',
        icon: 'wallet-outline',
        kicker: periodTitle(mode, period),
        big: format.compact(wrapped.expense),
        lines: [
          t('đã chi trong {n} giao dịch', { n: wrapped.txCount }),
          t('Thu nhập {amount}', { amount: format.compact(wrapped.income) }),
        ],
      },
    ];
    if (wrapped.topCategories.length) {
      const [top, ...rest] = wrapped.topCategories;
      out.push({
        id: 'category',
        icon: 'pie-chart-outline',
        kicker: t('Danh mục số một'),
        big: t(top.name),
        lines: [
          t('{amount} · {pct}% tổng chi', {
            amount: format.money(top.amount),
            pct: Math.round(top.share * 100),
          }),
          ...rest.map((c) => `${t(c.name)} · ${format.compact(c.amount)}`),
        ],
      });
    }
    if (wrapped.priciestDay) {
      const d = wrapped.priciestDay;
      const wd = t(WEEKDAY_NAMES[(new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7]);
      out.push({
        id: 'day',
        icon: 'flame-outline',
        kicker: t('Ngày chi mạnh tay nhất'),
        big: `${wd}, ${formatDate(d.date, false)}`,
        lines: [t('{amount} trong {n} giao dịch', { amount: format.money(d.amount), n: d.count })],
      });
    }
    if (wrapped.favorite) {
      out.push({
        id: 'favorite',
        icon: 'heart-outline',
        kicker: t('Bạn ghé nhiều nhất'),
        big: wrapped.favorite.title,
        lines: [
          t('{n} lần · tổng {amount}', {
            n: wrapped.favorite.count,
            amount: format.money(wrapped.favorite.total),
          }),
        ],
      });
    }
    if (wrapped.biggest) {
      out.push({
        id: 'biggest',
        icon: 'trophy-outline',
        kicker: t('Khoản chi lớn nhất'),
        big: format.compact(wrapped.biggest.amount),
        lines: [wrapped.biggest.title || t('(không tiêu đề)'), formatDate(wrapped.biggest.date)],
      });
    }
    if (wrapped.noSpendDays > 0) {
      out.push({
        id: 'nospend',
        icon: 'leaf-outline',
        kicker: t('Ngày không tiêu đồng nào'),
        big: t('{n} ngày', { n: wrapped.noSpendDays }),
        lines: [t('Mỗi ngày nghỉ chi tiêu là một ngày tiền ở lại với bạn.')],
      });
    }
    out.push({
      id: 'saving',
      icon: 'trending-up-outline',
      kicker: t('Tiết kiệm'),
      big: wrapped.savingRate === null ? '—' : `${Math.round(wrapped.savingRate * 100)}%`,
      lines: [
        wrapped.savingRate === null
          ? ''
          : t(wrapped.saved >= 0 ? 'Còn lại {amount}' : 'Âm {amount}', {
              amount: format.compact(Math.abs(wrapped.saved)),
            }),
        t(VERDICT[wrapped.verdict]),
      ].filter(Boolean),
    });
    return out;
  }, [wrapped, mode, period, format]);

  const share = () => {
    const text = slides
      .map((s) => `${s.kicker}: ${s.big}${s.lines.length ? ` — ${s.lines[0]}` : ''}`)
      .join('\n');
    void Share.share({ message: `${periodTitle(mode, period)}\n${text}` });
  };

  const cardWidth = width - 32;
  const tones = [colors.gradient, [colors.income, colors.primary], [colors.expense, colors.primary]] as const;

  return (
    <Screen
      title="Tổng kết"
      scroll
      headerRight={slides.length ? <IconButton icon="share-outline" accessibilityLabel={t('Chia sẻ')} onPress={share} /> : undefined}
    >
      <SegmentedControl
        options={MODES}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setOffset(0);
          setPage(0);
        }}
      />
      <View style={styles.periodRow}>
        <IconButton icon="chevron-back" accessibilityLabel={t('Kỳ trước')} onPress={() => { setOffset(offset - 1); setPage(0); }} />
        <AppText variant="heading">{periodTitle(mode, period)}</AppText>
        <IconButton icon="chevron-forward" accessibilityLabel={t('Kỳ sau')} onPress={() => { setOffset(offset + 1); setPage(0); }} />
      </View>

      {!slides.length ? (
        <EmptyState icon="sparkles-outline" title="Chưa có giao dịch trong kỳ này" />
      ) : (
        <>
          <FlatList
            horizontal
            pagingEnabled={false}
            snapToInterval={cardWidth + 12}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            data={slides}
            keyExtractor={(s) => s.id}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 12)))}
            renderItem={({ item, index }) => (
              <LinearGradient
                colors={[...tones[index % tones.length]] as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.card, { width: cardWidth }]}
              >
                <Ionicons name={item.icon} size={34} color="rgba(255,255,255,0.9)" />
                <View style={{ gap: 6 }}>
                  <AppText variant="label" style={styles.kicker}>
                    {item.kicker}
                  </AppText>
                  <AppText variant="display" style={styles.big} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>
                    {item.big}
                  </AppText>
                  {item.lines.map((line, i) => (
                    <AppText key={i} style={styles.line}>
                      {line}
                    </AppText>
                  ))}
                </View>
              </LinearGradient>
            )}
          />
          <View style={styles.dots}>
            {slides.map((s, i) => (
              <View
                key={s.id}
                style={[
                  styles.pip,
                  { backgroundColor: i === page ? colors.primary : colors.border, width: i === page ? 18 : 6 },
                ]}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const useStyles = createStyles((th) => ({
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: {
    minHeight: 380,
    borderRadius: 32,
    padding: 28,
    justifyContent: 'space-between',
  },
  kicker: { color: 'rgba(255,255,255,0.8)' },
  big: { color: '#fff', fontWeight: '800' },
  line: { color: 'rgba(255,255,255,0.92)' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: th.spacing.sm },
  pip: { height: 6, borderRadius: 3 },
}));
