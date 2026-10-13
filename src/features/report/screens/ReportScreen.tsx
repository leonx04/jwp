// Báo cáo tháng: còn lại bao nhiêu, so với tháng trước, chi nhiều nhất cho gì, khoản lớn, ngân sách.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';

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
import { useMoneyFormat } from '@/features/settings';
import { periodRangeLabel, periodTitle } from '@/features/stats/periods';
import { formatDate, toVnDate } from '@/lib/date';
import { toAppIcon } from '@/lib/icons';
import { useTheme } from '@/theme';

import { useMonthlyReport } from '../hooks';
import { reportToText, type Highlight, type MonthlyReport } from '../report';

const TONE_ICON = {
  good: 'checkmark-circle',
  bad: 'alert-circle',
  neutral: 'information-circle',
} as const;

export function ReportScreen() {
  const params = useLocalSearchParams<{ offset?: string }>();
  const initial = Number(params.offset);
  const [offset, setOffset] = useState(Number.isInteger(initial) && initial <= 0 ? initial : 0);
  const format = useMoneyFormat();
  const { report, period } = useMonthlyReport(offset);
  const title = `Báo cáo ${periodTitle('month', period).toLowerCase()}`;

  const share = () => {
    if (!report) return;
    Share.share({
      message: reportToText(report, title, periodRangeLabel(period), format.money),
    }).catch(() => {});
  };

  return (
    <Screen
      title="Báo cáo tháng"
      headerRight={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton
            icon="chevron-back"
            accessibilityLabel="Tháng trước"
            onPress={() => setOffset(offset - 1)}
          />
          <IconButton
            icon="chevron-forward"
            accessibilityLabel="Tháng sau"
            disabled={offset >= 0}
            onPress={() => setOffset(Math.min(0, offset + 1))}
          />
        </View>
      }
    >
      <View>
        <AppText variant="heading">{periodTitle('month', period)}</AppText>
        <AppText variant="caption" color="textMuted">
          {periodRangeLabel(period)}
          {report?.inProgress ? ' · chưa kết thúc, số liệu tính đến hôm nay' : ''}
        </AppText>
      </View>

      {report && !report.hasData ? (
        <Card>
          <EmptyState
            icon="document-text-outline"
            title="Tháng này chưa có giao dịch"
            description="Ghi thu chi rồi quay lại — báo cáo tự tổng hợp."
          />
        </Card>
      ) : null}

      {report?.hasData ? (
        <>
          <Summary report={report} />
          {report.highlights.length ? <Highlights items={report.highlights} /> : null}
          <Categories report={report} />
          <Biggest report={report} />
          <Budgets report={report} />
          <Button title="Chia sẻ báo cáo" icon="share-outline" onPress={share} />
        </>
      ) : null}
    </Screen>
  );
}

function Summary({ report: r }: { report: MonthlyReport }) {
  const format = useMoneyFormat();
  const positive = r.net >= 0;
  return (
    <Card style={{ gap: 12 }}>
      <View>
        <AppText variant="label" color="textMuted">
          {positive ? 'CÒN LẠI' : 'CHI VƯỢT THU'}
        </AppText>
        <AppText
          variant="display"
          color={positive ? 'income' : 'expense'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {positive ? '' : '−'}
          {format.money(Math.abs(r.net))}
        </AppText>
        {r.savingRate !== null ? (
          <AppText variant="caption" color="textMuted">
            {positive
              ? `Giữ lại ${Math.max(0, Math.round(r.savingRate))}% thu nhập`
              : 'Chi nhiều hơn thu nhập trong tháng'}
          </AppText>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Flow label="Thu" amount={r.income} change={r.incomeChange} goodWhenUp />
        <Flow label="Chi" amount={r.expense} change={r.expenseChange} goodWhenUp={false} />
      </View>
      <AppText variant="caption" color="textMuted">
        Chi trung bình khoảng {format.money(Math.round(r.averagePerDay))}/ngày
      </AppText>
    </Card>
  );
}

function Flow({
  label,
  amount,
  change,
  goodWhenUp,
}: {
  label: string;
  amount: number;
  change: number | null;
  goodWhenUp: boolean;
}) {
  const format = useMoneyFormat();
  const up = (change ?? 0) > 0;
  const good = up === goodWhenUp;
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText
        variant="heading"
        style={{ fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {format.money(amount)}
      </AppText>
      {change !== null && Math.round(change) !== 0 ? (
        <AppText variant="caption" color={good ? 'income' : 'expense'}>
          {up ? '▲' : '▼'} {Math.abs(Math.round(change))}% so với tháng trước
        </AppText>
      ) : null}
    </View>
  );
}

function Highlights({ items }: { items: Highlight[] }) {
  const { colors } = useTheme();
  const color = { good: colors.income, bad: colors.expense, neutral: colors.textMuted };
  return (
    <>
      <SectionTitle>Nhận xét</SectionTitle>
      <Card style={{ gap: 10 }}>
        {items.map((h) => (
          <View key={h.key} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Ionicons name={TONE_ICON[h.tone]} size={20} color={color[h.tone]} />
            <AppText style={{ flex: 1 }}>{h.text}</AppText>
          </View>
        ))}
      </Card>
    </>
  );
}

function Categories({ report: r }: { report: MonthlyReport }) {
  const format = useMoneyFormat();
  const { colors } = useTheme();
  if (!r.categories.length) return null;
  return (
    <>
      <SectionTitle>Chi nhiều nhất</SectionTitle>
      <Card style={{ gap: 14 }}>
        {r.categories.map((c) => (
          <View key={c.key} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconBadge icon={toAppIcon(c.icon, 'pricetag-outline')} color={c.color} size={32} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium" numberOfLines={1}>
                  {c.name}
                </AppText>
                {c.change !== null && Math.round(c.change) !== 0 ? (
                  <AppText variant="caption" color={c.change > 0 ? 'expense' : 'income'}>
                    {c.change > 0 ? '▲' : '▼'} {Math.abs(Math.round(c.change))}% so với tháng trước
                  </AppText>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText
                  variant="bodyMedium"
                  style={{ fontVariant: ['tabular-nums'] }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {format.money(c.amount)}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {Math.round(c.share * 100)}%
                </AppText>
              </View>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  width: `${Math.max(2, Math.round(c.share * 100))}%`,
                  backgroundColor: c.color,
                }}
              />
            </View>
          </View>
        ))}
        {r.otherAmount > 0 ? (
          <AppText variant="caption" color="textMuted">
            Các danh mục còn lại: {format.money(r.otherAmount)}
          </AppText>
        ) : null}
      </Card>
    </>
  );
}

function Biggest({ report: r }: { report: MonthlyReport }) {
  const format = useMoneyFormat();
  if (!r.biggestExpenses.length) return null;
  return (
    <>
      <SectionTitle>Khoản chi lớn</SectionTitle>
      <Card style={{ gap: 12 }}>
        {r.biggestExpenses.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium" numberOfLines={1}>
                {e.title || e.categoryName || 'Chi tiêu'}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {formatDate(toVnDate(e.date), false)}
                {e.categoryName && e.title ? ` · ${e.categoryName}` : ''}
              </AppText>
            </View>
            <AppText color="expense" variant="bodyMedium" style={{ fontVariant: ['tabular-nums'] }}>
              −{format.money(e.amount)}
            </AppText>
          </View>
        ))}
      </Card>
    </>
  );
}

function Budgets({ report: r }: { report: MonthlyReport }) {
  const format = useMoneyFormat();
  if (!r.budgets.length) return null;
  return (
    <>
      <SectionTitle>Ngân sách</SectionTitle>
      <Card style={{ gap: 10 }}>
        {r.budgets.map((b) => (
          <View key={b.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons
              name={b.over ? 'close-circle' : 'checkmark-circle'}
              size={20}
              color={b.over ? '#C9372C' : '#13803F'}
            />
            <AppText style={{ flex: 1 }} numberOfLines={1}>
              {b.name}
            </AppText>
            <AppText
              variant="caption"
              color={b.over ? 'expense' : 'textMuted'}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {format.money(b.spent)} / {format.money(b.amount)}
            </AppText>
          </View>
        ))}
      </Card>
    </>
  );
}
