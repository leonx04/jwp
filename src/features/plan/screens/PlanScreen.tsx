// Tab Kế hoạch: tiền sẽ đi đâu trong 30 ngày tới + lối vào lịch thu chi, ngân sách, sổ nợ, quỹ.
import { t } from '@/lib/i18n';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { BalanceLineChart } from '@/components/charts/BalanceLineChart';
import { AppText, Card, ListRow, Screen, SectionTitle } from '@/components/ui';
import { BudgetsCard } from '@/features/budgets/components/BudgetsCard';
import { DebtsCard } from '@/features/debts/components/DebtsCard';
import { GoalsCard } from '@/features/goals/components/GoalsCard';
import { UpcomingCard } from '@/features/schedules/components/UpcomingCard';
import { useScheduleOverview } from '@/features/schedules/hooks';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { formatDate } from '@/lib/date';
import type { AppIcon } from '@/lib/icons';
import { SWATCH } from '@/theme';

const LINKS: { icon: AppIcon; title: string; subtitle: string; href: Href; color: string }[] = [
  {
    icon: 'calendar-outline',
    title: 'Lịch thu chi',
    subtitle: 'Lương, tiền nhà, hoá đơn… và dự trù số dư',
    href: '/schedule',
    color: SWATCH.blue,
  },
  {
    icon: 'speedometer-outline',
    title: 'Ngân sách',
    subtitle: 'Hạn mức chi mỗi tháng, cảnh báo sắp hết',
    href: '/budgets',
    color: SWATCH.amber,
  },
  {
    icon: 'people-outline',
    title: 'Sổ nợ & khoản vay',
    subtitle: 'Ai nợ bạn, bạn nợ ai, trả theo kỳ',
    href: '/debts',
    color: SWATCH.rose,
  },
  {
    icon: 'flag-outline',
    title: 'Quỹ tiết kiệm',
    subtitle: 'Mục tiêu, tiến độ, cần góp mỗi tháng',
    href: '/goals',
    color: SWATCH.sky,
  },
  {
    icon: 'repeat-outline',
    title: 'Khoản lặp phát hiện được',
    subtitle: 'Tiền nhà, đăng ký, lương… gợi ý tạo lịch nhắc',
    href: '/recurring',
    color: SWATCH.teal,
  },
  {
    icon: 'calculator-outline',
    title: 'Tính khoản vay',
    subtitle: 'Lãi suất, số kỳ → trả mỗi tháng, tổng lãi, lãi thực',
    href: '/loan-calculator',
    color: SWATCH.violet,
  },
];

function ForecastSummary() {
  const format = useMoneyFormat();
  const safetyThreshold = useSettings((s) => s.safetyThreshold);
  const { data } = useScheduleOverview(30);
  if (!data) return <Card style={{ minHeight: 220 }}>{null}</Card>;
  const { forecast } = data;
  const low = forecast.lowest;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/schedule')}
      style={({ pressed }) => pressed && { opacity: 0.8 }}
    >
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="heading">30 ngày tới</AppText>
          <AppText variant="label" color="primary">
            Xem lịch ›
          </AppText>
        </View>
        <BalanceLineChart points={forecast.points} safetyThreshold={safetyThreshold} height={140} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="label" color="textMuted">
              {t('Thấp nhất {date}', { date: formatDate(low.date, false) })}
            </AppText>
            <AppText variant="heading" color={low.balance < 0 ? 'expense' : 'text'}>
              {format.compact(low.balance)}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="label" color="textMuted">
              Mỗi ngày tiêu được
            </AppText>
            <AppText variant="heading" color={forecast.safeDailySpend > 0 ? 'income' : 'expense'}>
              ~{format.compact(forecast.safeDailySpend)}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="label" color="textMuted">
              Cuối kỳ
            </AppText>
            <AppText variant="heading">{format.compact(forecast.endBalance)}</AppText>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export function PlanScreen() {
  return (
    <Screen tabBar largeTitle title="Kế hoạch">
      <ForecastSummary />
      <UpcomingCard />
      <Card style={{ gap: 0, paddingVertical: 8 }}>
        <SectionTitle>Lập kế hoạch</SectionTitle>
        {LINKS.map((item) => (
          <ListRow
            key={item.title}
            icon={item.icon}
            iconColor={item.color}
            title={item.title}
            subtitle={item.subtitle}
            onPress={() => router.push(item.href)}
          />
        ))}
      </Card>
      <BudgetsCard />
      <DebtsCard />
      <GoalsCard />
    </Screen>
  );
}
