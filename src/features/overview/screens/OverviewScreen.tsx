import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { IconButton } from '@/components/glass/IconButton';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  IconBadge,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { db } from '@/db';
import { totalBalance, useAccountBalances } from '@/features/accounts';
import { createDefaultData } from '@/features/onboarding/defaults';
import { UpcomingCard } from '@/features/schedules/components/UpcomingCard';
import { useScheduleOverview } from '@/features/schedules/hooks';
import { BudgetsCard } from '@/features/budgets/components/BudgetsCard';
import { DebtsCard } from '@/features/debts/components/DebtsCard';
import { TodayCard, useTodayStatus } from '@/features/today';
import { CreditSection } from '../components/CreditSection';
import { bnplLoad } from '../bnpl';
import { getAverageMonthlyIncome } from '../queries';
import { useLiveData } from '@/db/useLiveData';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { usePeriodSummary, useTransactions } from '@/features/transactions/hooks';
import {
  WEEKDAY_NAMES,
  addDays,
  formatDate,
  periodContaining,
  todayVn,
  vnDateToMs,
  weekdayOf,
} from '@/lib/date';
import { toAppIcon, type IconName } from '@/lib/icons';
import { createStyles, rgba, useTheme } from '@/theme';

const QUICK_ACTIONS: {
  label: string;
  icon: IconName;
  href: Href;
  tone: 'expense' | 'income' | 'primary';
}[] = [
  { label: 'Chi tiêu', icon: 'arrow-up', href: '/transaction/new?type=expense', tone: 'expense' },
  { label: 'Thu nhập', icon: 'arrow-down', href: '/transaction/new?type=income', tone: 'income' },
  {
    label: 'Chuyển tiền',
    icon: 'swap-horizontal',
    href: '/transaction/new?type=transfer',
    tone: 'primary',
  },
  { label: 'Quét biên lai', icon: 'scan-outline', href: '/receipt-scan', tone: 'primary' },
];

function greeting(now = new Date()): string {
  const hour = (now.getUTCHours() + 7) % 24;
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function OverviewScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const { userName, hideBalance, startDayOfMonth, transfersAsIncomeExpense, update } =
    useSettings();
  const { data: balances } = useAccountBalances();

  const period = periodContaining(todayVn(), startDayOfMonth);
  const { data: summary } = usePeriodSummary({
    from: vnDateToMs(period.start),
    to: vnDateToMs(addDays(period.end, 1)),
    transfersAsIncomeExpense,
  });
  const { data: recent } = useTransactions({ limit: 6 });
  const { data: overview } = useScheduleOverview(30);
  const todayStatus = useTodayStatus(overview);
  const { data: avgIncome = null } = useLiveData(['transactions'], () =>
    getAverageMonthlyIncome(db, todayVn(), startDayOfMonth),
  );
  const load = useMemo(
    () =>
      overview
        ? bnplLoad({
            occurrences: overview.occurrences,
            today: overview.today,
            avgMonthlyIncome: avgIncome,
          })
        : null,
    [overview, avgIncome],
  );

  // Ví trả sau: hiện DƯ NỢ (dương, gồm cả khoản theo lịch) thay vì số dư âm
  const owedById = useMemo(
    () => new Map((overview?.credit ?? []).map((c) => [c.account.id, c.status.owed])),
    [overview],
  );
  const total = balances ? totalBalance(balances) : 0;
  const hasAccounts = (balances?.length ?? 0) > 0;
  const mask = (text: string) => (hideBalance ? '••••••' : text);

  return (
    <Screen
      tabBar
      largeTitle
      title={userName ? `Chào ${userName}` : 'Tổng quan'}
      subtitle={`${greeting()} · ${WEEKDAY_NAMES[weekdayOf(todayVn()) - 1]}, ${formatDate(todayVn(), false)}`}
      headerRight={
        <IconButton
          icon={hideBalance ? 'eye-off-outline' : 'eye-outline'}
          accessibilityLabel={hideBalance ? 'Hiện số dư' : 'Ẩn số dư'}
          onPress={() => update({ hideBalance: !hideBalance })}
        />
      }
    >
      {/* Thẻ số dư */}
      <GlassSurface contentStyle={styles.hero}>
        <LinearGradient
          colors={[rgba(colors.primary, colors.dark ? 0.32 : 0.22), 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <AppText variant="label" color="textMuted">
          TỔNG SỐ DƯ
        </AppText>
        <AppText
          variant="hero"
          style={{ fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {mask(format.money(total))}
        </AppText>
        <View style={styles.heroStats}>
          <HeroStat
            icon="arrow-down"
            tone={colors.income}
            label="Thu tháng này"
            value={mask(format.compact(summary?.income ?? 0))}
          />
          <HeroStat
            icon="arrow-up"
            tone={colors.expense}
            label="Chi tháng này"
            value={mask(format.compact(summary?.expense ?? 0))}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/stats')}
          hitSlop={8}
          style={{ alignSelf: 'flex-end', marginTop: 4 }}
        >
          <AppText variant="label" color="primary">
            Xem thống kê ›
          </AppText>
        </Pressable>
      </GlassSurface>

      {!hasAccounts && balances ? (
        <Card>
          <EmptyState
            icon="sparkles-outline"
            title="Bắt đầu với JWP"
            description="Chuyển toàn bộ dữ liệu từ Ivy Wallet, hoặc bắt đầu mới với ví Tiền mặt và 18 danh mục có sẵn."
            action={
              <View style={{ gap: 10, alignSelf: 'stretch' }}>
                <Button
                  icon="download-outline"
                  title="Import từ Ivy Wallet"
                  onPress={() => router.push('/import/ivy')}
                />
                <Button
                  variant="secondary"
                  icon="add-circle-outline"
                  title="Bắt đầu mới"
                  onPress={() => {
                    createDefaultData(db);
                    useSettings.getState().update({ onboarded: true });
                  }}
                />
              </View>
            }
          />
        </Card>
      ) : null}

      {/* Thao tác nhanh */}
      <View style={styles.actions}>
        {QUICK_ACTIONS.map((action) => {
          const tone = colors[action.tone];
          return (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={() => router.push(action.href)}
              style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.94 }] }]}
            >
              <GlassSurface
                radius={22}
                shadow={false}
                style={styles.actionIcon}
                contentStyle={styles.center}
              >
                <View
                  style={[
                    styles.actionDot,
                    { backgroundColor: rgba(tone, colors.dark ? 0.25 : 0.14) },
                  ]}
                >
                  <Ionicons name={action.icon} size={20} color={tone} />
                </View>
              </GlassSurface>
              <AppText variant="label" color="textMuted">
                {action.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Ví */}
      {hasAccounts ? (
        <>
          <View style={styles.sectionRow}>
            <SectionTitle tone="section">Ví của bạn</SectionTitle>
            <Pressable onPress={() => router.push('/accounts')} hitSlop={8}>
              <AppText variant="label" color="primary">
                Quản lý
              </AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accounts}
            style={styles.bleed}
          >
            {balances!.map((account) => (
              <Pressable key={account.id} onPress={() => router.push(`/account/${account.id}`)}>
                {({ pressed }) => (
                  <GlassSurface
                    style={[styles.accountCard, pressed && { transform: [{ scale: 0.97 }] }]}
                    contentStyle={styles.accountContent}
                    radius={24}
                  >
                    <IconBadge
                      icon={toAppIcon(account.icon, 'wallet-outline')}
                      color={account.color}
                      size={36}
                    />
                    <AppText variant="caption" color="textMuted" numberOfLines={1}>
                      {owedById.has(account.id) ? `${account.name} · dư nợ` : account.name}
                    </AppText>
                    <AppText
                      variant="heading"
                      numberOfLines={1}
                      color={!owedById.has(account.id) && account.balance < 0 ? 'expense' : 'text'}
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {mask(
                        format.money(
                          owedById.has(account.id) ? owedById.get(account.id)! : account.balance,
                        ),
                      )}
                    </AppText>
                  </GlassSurface>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {todayStatus ? <TodayCard status={todayStatus} /> : null}
      {overview?.credit.length ? <CreditSection credit={overview.credit} load={load} /> : null}
      <UpcomingCard />
      <BudgetsCard />
      <DebtsCard />

      {/* Giao dịch gần đây */}
      {recent && recent.length > 0 ? (
        <>
          <View style={styles.sectionRow}>
            <SectionTitle tone="section">Gần đây</SectionTitle>
            <Pressable onPress={() => router.navigate('/transactions')} hitSlop={8}>
              <AppText variant="label" color="primary">
                Xem tất cả
              </AppText>
            </Pressable>
          </View>
          <Card style={{ gap: 0, paddingVertical: 6 }}>
            {recent.map((item) => (
              <TransactionRow key={item.id} item={item} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function HeroStat({
  icon,
  tone,
  label,
  value,
}: {
  icon: IconName;
  tone: string;
  label: string;
  value: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.heroStat}>
      <View style={[styles.statIcon, { backgroundColor: rgba(tone, colors.dark ? 0.22 : 0.14) }]}>
        <Ionicons name={icon} size={14} color={tone} />
      </View>
      <View>
        <AppText variant="label" color="textMuted">
          {label}
        </AppText>
        <AppText variant="bodyMedium" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  hero: {
    padding: t.spacing.xl,
    gap: t.spacing.xs,
  },
  heroStats: {
    flexDirection: 'row',
    gap: t.spacing.lg,
    marginTop: t.spacing.md,
  },
  heroStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  action: {
    alignItems: 'center',
    gap: 6,
    width: '23%',
  },
  actionIcon: {
    width: 62,
    height: 62,
  },
  actionDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -t.spacing.xs,
  },
  bleed: {
    marginHorizontal: -t.spacing.lg,
  },
  accounts: {
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.md,
    paddingVertical: 4,
  },
  accountCard: {
    width: 156,
  },
  accountContent: {
    padding: t.spacing.lg,
    gap: 6,
  },
}));
