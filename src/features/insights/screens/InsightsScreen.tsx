// Tab Phân tích: kỳ lương này tiêu thế nào + lối vào thống kê, dòng chảy, báo cáo, công cụ.
import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { AppText, Card, ListRow, Screen, SectionTitle } from '@/components/ui';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { usePeriodSummary } from '@/features/transactions/hooks';
import { addDays, formatDate, periodContaining, todayVn, vnDateToMs } from '@/lib/date';
import type { AppIcon } from '@/lib/icons';
import { SWATCH } from '@/theme';

type Link = { icon: AppIcon; title: string; subtitle: string; href: Href; color: string };

const ANALYSIS: Link[] = [
  {
    icon: 'stats-chart-outline',
    title: 'Thống kê',
    subtitle: 'Biểu đồ, xu hướng chi tiêu, so sánh kỳ trước',
    href: '/stats',
    color: SWATCH.violet,
  },
  {
    icon: 'git-network-outline',
    title: 'Dòng chảy đồng lương',
    subtitle: 'Lương vào đi đâu: sơ đồ từ thu nhập tới từng khoản chi',
    href: '/flow',
    color: SWATCH.sky,
  },
  {
    icon: 'document-text-outline',
    title: 'Báo cáo tháng',
    subtitle: 'Còn lại bao nhiêu, so tháng trước, khoản chi lớn, chia sẻ',
    href: '/report',
    color: SWATCH.pink,
  },
  {
    icon: 'sparkles-outline',
    title: 'Tổng kết',
    subtitle: 'Kỳ này bạn chi gì nhiều nhất, ngày nào, nơi nào — vuốt từng thẻ',
    href: '/wrapped',
    color: SWATCH.amber,
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Hỏi app',
    subtitle: 'Hỏi bằng tiếng Việt: tháng này tiêu bao nhiêu, cafe mấy lần…',
    href: '/ask',
    color: SWATCH.indigo,
  },
];

const TOOLS: Link[] = [
  {
    icon: 'speedometer-outline',
    title: 'Xăng xe',
    subtitle: 'Giá xăng mỗi lít, chi phí theo tháng, dự kiến lần đổ tới',
    href: '/fuel',
    color: SWATCH.orange,
  },
  {
    icon: 'trending-up-outline',
    title: 'Mô phỏng tăng lương',
    subtitle: 'Lương tăng thì tiền dư, tiết kiệm và các quỹ thay đổi ra sao',
    href: '/salary',
    color: SWATCH.green,
  },
  {
    icon: 'gift-outline',
    title: 'Quỹ Tết & thưởng',
    subtitle: 'Thưởng Tết, chi phí Tết và mỗi tháng cần để dành bao nhiêu',
    href: '/tet',
    color: SWATCH.red,
  },
];

function LinkCard({ title, links }: { title: string; links: Link[] }) {
  return (
    <Card style={{ gap: 0, paddingVertical: 8 }}>
      <SectionTitle>{title}</SectionTitle>
      {links.map((item) => (
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
  );
}

function PeriodSummary() {
  const format = useMoneyFormat();
  const { startDayOfMonth, transfersAsIncomeExpense, hideBalance } = useSettings();
  const period = periodContaining(todayVn(), startDayOfMonth);
  const { data } = usePeriodSummary({
    from: vnDateToMs(period.start),
    to: vnDateToMs(addDays(period.end, 1)),
    transfersAsIncomeExpense,
  });
  const income = data?.income ?? 0;
  const expense = data?.expense ?? 0;
  const left = income - expense;
  const mask = (text: string) => (hideBalance ? '••••' : text);
  const cells = [
    { label: 'Thu', value: income, color: 'income' as const },
    { label: 'Chi', value: expense, color: 'expense' as const },
    { label: 'Còn', value: left, color: left < 0 ? ('expense' as const) : ('text' as const) },
  ];

  return (
    <Card style={{ gap: 10 }}>
      <AppText variant="label" color="textMuted">
        {formatDate(period.start, false)} – {formatDate(period.end, false)}
      </AppText>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {cells.map((c) => (
          <View key={c.label} style={{ flex: 1, gap: 2 }}>
            <AppText variant="label" color="textMuted">
              {c.label}
            </AppText>
            <AppText variant="heading" color={c.color} numberOfLines={1}>
              {mask(format.compact(c.value))}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function InsightsScreen() {
  return (
    <Screen tabBar largeTitle title="Phân tích">
      <PeriodSummary />
      <LinkCard title="Phân tích" links={ANALYSIS} />
      <LinkCard title="Công cụ" links={TOOLS} />
    </Screen>
  );
}
