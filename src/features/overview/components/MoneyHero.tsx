// Thẻ chính của Hôm nay: con số người dùng cần nhất là "còn tiêu được bao nhiêu hôm nay".
// Tổng số dư và thu / chi tháng xuống dòng phụ. Chưa đủ dữ liệu dự báo thì hiện tổng số dư như cũ.
import { t } from '@/lib/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { AppText } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { incomeLabel, shortfallText, type TodayStatus } from '@/features/today';
import { createStyles, rgba, useTheme } from '@/theme';

type Props = {
  status: TodayStatus | null;
  total: number;
  income: number;
  expense: number;
  mask: (text: string) => string;
};

export function MoneyHero({ status, total, income, expense, mask }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const on = colors.onGradient;
  const soft = rgba(on, 0.75);

  const overspent = (status?.over ?? 0) > 0;
  const nextIncome = status ? (status.incomeToday ?? status.nextIncome) : null;

  return (
    <GlassSurface
      contentStyle={styles.hero}
      background={colors.gradient[1]}
      shadow={false}
      style={{ boxShadow: `0 10px 28px ${rgba(colors.gradient[0], colors.dark ? 0.4 : 0.32)}` }}
    >
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {status ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Hôm nay được tiêu, mở lịch thu chi')}
          onPress={() => router.navigate('/schedule')}
          style={({ pressed }) => [styles.main, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.headRow}>
            <AppText variant="label" style={{ color: soft }}>
              {overspent ? 'ĐÃ TIÊU VƯỢT HÔM NAY' : 'CÒN TIÊU ĐƯỢC HÔM NAY'}
            </AppText>
            {nextIncome ? (
              <View style={[styles.pill, { backgroundColor: rgba(on, 0.18) }]}>
                <Ionicons name="calendar-outline" size={12} color={on} />
                <AppText variant="label" style={{ color: on }} numberOfLines={1}>
                  {incomeLabel(nextIncome)}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText
            variant="hero"
            style={{ fontVariant: ['tabular-nums'], color: on }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {mask(format.money(overspent ? status.over : status.left))}
          </AppText>
          <View style={[styles.track, { backgroundColor: rgba(on, 0.22) }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.round(status.progress * 100)}%`,
                  backgroundColor: overspent ? colors.warning : on,
                },
              ]}
            />
          </View>
          <AppText variant="caption" style={[styles.tabular, { color: soft }]}>
            {t('Đã tiêu {spent} / {budget}', {
              spent: mask(format.compact(status.spent)),
              budget: mask(format.compact(status.budget)),
            })}
            {' · '}
            {status.days > 1
              ? t('chia đều {days} ngày', { days: status.days })
              : t('đến hết hôm nay')}
          </AppText>
          {status.available < 0 ? (
            <View style={styles.warn}>
              <Ionicons name="alert-circle" size={15} color={on} />
              <AppText variant="caption" style={{ color: on, flex: 1 }}>
                {shortfallText(status, format.compact, mask)}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      ) : (
        <View style={styles.main}>
          <AppText variant="label" style={{ color: soft }}>
            TỔNG SỐ DƯ
          </AppText>
          <AppText
            variant="hero"
            style={{ fontVariant: ['tabular-nums'], color: on }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {mask(format.money(total))}
          </AppText>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Xem thống kê')}
        onPress={() => router.push('/stats')}
        style={({ pressed }) => [
          styles.stats,
          { borderTopColor: rgba(on, 0.2) },
          pressed && { opacity: 0.8 },
        ]}
      >
        {status ? <Stat label="Số dư" value={mask(format.compact(total))} color={on} /> : null}
        <Stat label="Thu tháng" icon="arrow-down" value={mask(format.compact(income))} color={on} />
        <Stat label="Chi tháng" icon="arrow-up" value={mask(format.compact(expense))} color={on} />
        <Ionicons name="chevron-forward" size={16} color={soft} />
      </Pressable>
    </GlassSurface>
  );
}

function Stat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon?: 'arrow-down' | 'arrow-up';
}) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <View style={styles.statLabel}>
        {icon ? <Ionicons name={icon} size={12} color={rgba(color, 0.75)} /> : null}
        <AppText variant="label" style={{ color: rgba(color, 0.75) }} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <AppText
        variant="bodyMedium"
        style={[styles.tabular, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </AppText>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  hero: { padding: t.spacing.xl, gap: t.spacing.md },
  main: { gap: t.spacing.xs },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 1,
  },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 4 },
  fill: { height: '100%', borderRadius: 3 },
  tabular: { fontVariant: ['tabular-nums'] },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingTop: t.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, gap: 2 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 3 },
}));
