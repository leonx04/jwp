// "Việc cần làm" ở Hôm nay: một danh sách gộp mọi thứ cần bạn bấm — giao dịch chờ ghi từ thông báo
// ngân hàng, kỳ thu chi quá hạn / 7 ngày tới, khoản nợ sắp đến hạn, báo cáo tháng mới. Không có gì thì ẩn.
import { t } from '@/lib/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card, ListRow, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { usePendingCaptureCount } from '@/features/capture/hooks';
import { listCategories } from '@/features/categories/repository';
import { statusText } from '@/features/debts/components/display';
import { useDebts } from '@/features/debts/hooks';
import { useReportReady } from '@/features/report/useReportReady';
import { OccurrenceRow } from '@/features/schedules/components/OccurrenceRow';
import { useScheduleOverview } from '@/features/schedules/hooks';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { pickTodos } from '@/features/today/todos';
import { formatDate } from '@/lib/date';
import { SWATCH, useTheme } from '@/theme';

export function TodoSection() {
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const hide = useSettings((s) => s.hideBalance);
  const mask = (text: string) => (hide ? '••••••' : text);

  const { data: overview } = useScheduleOverview(30);
  const pending = usePendingCaptureCount();
  const { items: debtItems } = useDebts();
  const report = useReportReady();
  const { data: accounts = [] } = useLiveData(['accounts'], () =>
    listAccounts(db, { includeArchived: true }),
  );
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));

  const lookup = useMemo(() => {
    const acc = new Map(accounts.map((a) => [a.id, a]));
    const cat = new Map(categories.map((c) => [c.id, c]));
    return {
      accountName: (id: string) => acc.get(id)?.name ?? '?',
      accountIcon: (id: string) => acc.get(id)?.icon ?? null,
      category: (id: string | null) => (id ? (cat.get(id) ?? null) : null),
    };
  }, [accounts, categories]);

  const todos = useMemo(
    () =>
      overview
        ? pickTodos({ today: overview.today, occurrences: overview.occurrences, debts: debtItems })
        : null,
    [overview, debtItems],
  );

  if (!overview || !todos) return null;
  const negative = overview.forecast.firstNegative;
  const count =
    (pending ? 1 : 0) +
    todos.occurrences.length +
    todos.moreOccurrences +
    todos.debts.length +
    (report ? 1 : 0);
  if (!count && !negative) return null;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle tone="section">
          {count ? t('Việc cần làm · {count}', { count }) : 'Việc cần làm'}
        </SectionTitle>
        <Pressable onPress={() => router.navigate('/schedule')} hitSlop={8}>
          <AppText variant="label" color="primary">
            Xem lịch
          </AppText>
        </Pressable>
      </View>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {negative ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <Ionicons name="warning" size={18} color={colors.expense} />
            <AppText variant="caption" color="expense" style={{ flex: 1 }}>
              Dự kiến âm {mask(format.money(-negative.balance))} vào{' '}
              {formatDate(negative.date, false)} nếu không có khoản thu
            </AppText>
          </View>
        ) : null}
        {pending ? (
          <ListRow
            icon="mail-unread-outline"
            iconColor={SWATCH.violet}
            title={t('{count} giao dịch chờ xác nhận', { count: pending })}
            subtitle={t('Đọc từ thông báo ngân hàng')}
            onPress={() => router.push('/inbox')}
            right={
              <AppText variant="label" color="primary">
                Ghi ›
              </AppText>
            }
          />
        ) : null}
        {todos.occurrences.map((o) => (
          <OccurrenceRow key={`${o.scheduleId}-${o.dueDate}`} occurrence={o} lookup={lookup} />
        ))}
        {todos.moreOccurrences ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/schedule')}
            style={{ paddingVertical: 10 }}
          >
            <AppText variant="label" color="primary">
              {t('Thêm {count} khoản trong 7 ngày tới ›', { count: todos.moreOccurrences })}
            </AppText>
          </Pressable>
        ) : null}
        {todos.debts.map((d) => (
          <ListRow
            key={d.debt.id}
            icon={d.direction === 'lent' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
            iconColor={d.direction === 'lent' ? colors.income : colors.expense}
            title={d.person.name}
            subtitle={`${t(d.direction === 'lent' ? 'Họ nợ bạn' : 'Bạn nợ họ')} · ${statusText(d)}`}
            onPress={() => router.push({ pathname: '/debt/[id]', params: { id: d.debt.id } })}
            right={
              <AppText
                variant="bodyMedium"
                color={d.status === 'overdue' ? 'expense' : 'text'}
                style={{ fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
              >
                {mask(format.money(d.remaining))}
              </AppText>
            }
          />
        ))}
        {report ? (
          <ListRow
            icon="document-text-outline"
            iconColor={SWATCH.violet}
            title={t('Báo cáo {month} đã sẵn sàng', { month: report.month })}
            subtitle={t('Thu chi, so với tháng trước, khoản chi lớn')}
            onPress={report.open}
          />
        ) : null}
      </Card>
    </View>
  );
}
