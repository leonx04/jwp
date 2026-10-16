import { t } from '@/lib/i18n';
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
import { InboxBanner } from '@/features/capture/components/InboxBanner';
import { DebtsCard } from '@/features/debts/components/DebtsCard';
import { ReportBanner } from '@/features/report/components/ReportBanner';
import { GoalsCard } from '@/features/goals/components/GoalsCard';
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
    label: 'Chuyển',
    icon: 'swap-horizontal',
    href: '/transaction/new?type=transfer',
    tone: 'primary',
  },
  { label: 'Quét bill', icon: 'scan-outline', href: '/receipt-scan', tone: 'primary' },
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
      title={userName ? t('Chào {name}', { name: userName }) : 'Tổng quan'}
      subtitle={`${t(greeting())} · ${t(WEEKDAY_NAMES[weekdayOf(todayVn()) - 1])}, ${formatDate(todayVn(), false)}`}
      headerRight={
        <IconButton
          icon={hideBalance ? 'eye-off-outline' : 'eye-outline'}
          accessibilityLabel={t(hideBalance ? 'Hiện số dư' : 'Ẩn số dư')}
          onPress={() => update({ hideBalance: !hideBalance })}
        />
      }
    >
      {/* Thẻ số dư */}
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
        <AppText variant="label" style={{ color: rgba(colors.onGradient, 0.75) }}>
          TỔNG SỐ DƯ
        </AppText>
        <AppText
          variant="hero"
          style={{ fontVariant: ['tabular-nums'], color: colors.onGradient }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {mask(format.money(total))}
        </AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/stats')}
          hitSlop={8}
          style={{ alignSelf: 'flex-end', marginTop: 4 }}
        >
          <AppText variant="label" style={{ color: colors.onGradient }}>
            Xem thống kê ›
          </AppText>
        </Pressable>
      </GlassSurface>

      {/* Ô bento: thu / chi tháng này */}
      <View style={styles.tiles}>
        <StatTile
          icon="arrow-down"
          tone={colors.income}
          label="Thu tháng này"
          value={mask(format.compact(summary?.income ?? 0))}
        />
        <StatTile
          icon="arrow-up"
          tone={colors.expense}
          label="Chi tháng này"
          value={mask(format.compact(summary?.expense ?? 0))}
        />
      </View>

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

      <InboxBanner />
      <ReportBanner />

      {/* Thao tác nhanh: một thẻ, bốn nút tròn màu */}
      <Card style={styles.actions}>
        {QUICK_ACTIONS.map((action) => {
          const tone = colors[action.tone];
          return (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={() => router.push(action.href)}
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
            >
              <View
                style={[
                  styles.actionDot,
                  { backgroundColor: rgba(tone, colors.dark ? 0.25 : 0.14) },
                ]}
              >
                <Ionicons name={action.icon} size={22} color={tone} />
              </View>
              <AppText variant="label" color="text" numberOfLines={1}>
                {action.label}
              </AppText>
            </Pressable>
          );
        })}
      </Card>

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
                      {owedById.has(account.id)
                        ? t('{name} · dư nợ', { name: account.name })
                        : account.name}
                    </AppText>
                    <AppText
                      variant="heading"
                      numberOfLines={1}
                      color={!owedById.has(account.id) && account.balance < 0 ? 'expense' : 'text'}
                      style={{ fontVariant: ['tabular-nums'] }}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
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
      <GoalsCard />

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

function StatTile({
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
    <View style={[styles.tile, { backgroundColor: rgba(tone, colors.dark ? 0.16 : 0.1) }]}>
      <View style={[styles.statIcon, { backgroundColor: rgba(tone, colors.dark ? 0.3 : 0.18) }]}>
        <Ionicons name={icon} size={16} color={tone} />
      </View>
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      <AppText
        variant="title"
        style={{ color: tone, fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </AppText>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  hero: {
    padding: t.spacing.xl,
    gap: t.spacing.xs,
  },
  tiles: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  tile: {
    flex: 1,
    padding: t.spacing.lg,
    borderRadius: t.radius.xl,
    gap: t.spacing.xs,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    marginBottom: t.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: t.spacing.md,
  },
  action: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  actionDot: {
    width: 52,
    height: 52,
    borderRadius: 18,
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
