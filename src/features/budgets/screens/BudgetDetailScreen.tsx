// Chi tiết một ngân sách: đã dùng / hạn mức, từng giao dịch đã tính vào kỳ này (để đối chiếu đúng / dư),
// và chuyển qua lại giữa các kỳ.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import { AppText, Button, Card, EmptyState, Screen } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { formatDate, type DateString } from '@/lib/date';
import { t } from '@/lib/i18n';
import { useTheme } from '@/theme';

import { useBudgetDetail } from '../hooks';

export function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const format = useMoneyFormat();
  const { colors } = useTheme();
  const [anchor, setAnchor] = useState<DateString | undefined>(undefined);
  const { data } = useBudgetDetail(id, anchor);

  if (!data) {
    return (
      <Screen title="Ngân sách">
        {data === null ? (
          <Card>
            <EmptyState icon="alert-circle-outline" title="Không tìm thấy ngân sách" />
          </Card>
        ) : null}
      </Screen>
    );
  }

  const { item, transactions, isCurrent, prevAnchor, nextAnchor } = data;
  const over = item.state === 'over';
  const tone = over ? colors.expense : item.state === 'warning' ? colors.warning : colors.primary;
  const edit = () => router.push({ pathname: '/budget/edit', params: { id: item.id } });

  return (
    <Screen
      title={item.name}
      headerRight={
        <IconButton icon="create-outline" accessibilityLabel={t('Sửa')} onPress={edit} />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel={t('Kỳ trước')}
          onPress={() => setAnchor(prevAnchor)}
        />
        <AppText variant="bodyMedium" style={{ flex: 1, textAlign: 'center' }}>
          {formatDate(item.periodStart, false)} – {formatDate(item.periodEnd, false)}
          {isCurrent ? ` · ${t('Kỳ này')}` : ''}
        </AppText>
        <IconButton
          icon="chevron-forward"
          accessibilityLabel={t('Kỳ sau')}
          onPress={() => nextAnchor && setAnchor(nextAnchor)}
          disabled={!nextAnchor}
        />
      </View>

      <Card style={{ gap: 10 }}>
        <View>
          <AppText variant="caption" color="textMuted">
            {over ? 'Vượt ngân sách' : 'Còn lại'}
          </AppText>
          <AppText
            variant="hero"
            style={{ color: over ? colors.expense : colors.text, fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {format.money(Math.abs(item.remaining))}
          </AppText>
        </View>
        <ProgressBar value={Math.min(1, item.ratio)} color={tone} height={10} />
        <AppText variant="caption" color="textMuted">
          {t('Đã chi {spent} / {limit}', {
            spent: format.money(item.spent),
            limit: format.money(item.amount),
          })}
          {` · ${Math.round(item.ratio * 100)}%`}
        </AppText>
        {isCurrent && !over ? (
          <AppText variant="caption" color={item.willExceed ? 'warning' : 'textMuted'}>
            {t('Còn {daysLeft} ngày, tối đa {perDay}/ngày', {
              daysLeft: item.daysLeft,
              perDay: format.money(item.perDay),
            })}
            {item.willExceed
              ? t(' · giữ tốc độ này sẽ vượt (~{projected})', {
                  projected: format.money(item.projected),
                })
              : ''}
          </AppText>
        ) : null}
      </Card>

      <Card style={{ gap: 0, paddingVertical: 6 }}>
        <AppText variant="label" color="textMuted" style={{ padding: 12 }}>
          {t('GIAO DỊCH TÍNH VÀO NGÂN SÁCH · {count}', { count: transactions.length })}
        </AppText>
        {transactions.length ? (
          transactions.map((tx) => <TransactionRow key={tx.id} item={tx} />)
        ) : (
          <EmptyState
            icon="receipt-outline"
            title="Chưa có khoản chi nào trong kỳ này"
            description="Chỉ tính khoản chi thuộc danh mục / ví của ngân sách này."
          />
        )}
      </Card>

      <Button title="Sửa ngân sách" variant="secondary" icon="create-outline" onPress={edit} />
    </Screen>
  );
}
