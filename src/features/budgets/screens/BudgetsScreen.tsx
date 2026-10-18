// Ngân sách theo tháng: thanh tiến độ từng khoản, cảnh báo sắp hết / dự báo vượt.
import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import { AppText, Button, Card, EmptyState, Screen } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { getTypicalMonth } from '@/features/salary/queries';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { todayVn } from '@/lib/date';
import { useTheme } from '@/theme';

import { allocationSummary } from '../allocation';
import { BudgetBar } from '../components/BudgetBar';
import { useBudgets } from '../hooks';

export function BudgetsScreen() {
  const { data: budgets } = useBudgets();
  const startDay = useSettings((s) => s.startDayOfMonth);
  const format = useMoneyFormat();
  const { colors } = useTheme();
  const { data: typical } = useLiveData(
    ['transactions'],
    () => getTypicalMonth(db, todayVn(), startDay),
    [startDay],
  );
  const allocation = allocationSummary(
    (budgets ?? []).reduce((sum, b) => sum + b.amount, 0),
    typical?.income ?? null,
  );
  const add = () => router.push('/budget/edit');

  return (
    <Screen
      title="Ngân sách"
      headerRight={<IconButton icon="add" accessibilityLabel={t('Thêm ngân sách')} onPress={add} />}
    >
      {budgets && budgets.length === 0 ? (
        <Card>
          <EmptyState
            icon="speedometer-outline"
            title="Chưa có ngân sách nào"
            description="Đặt hạn mức chi mỗi tháng cho Ăn uống, Đổ xăng… app sẽ báo khi gần hết hoặc có nguy cơ vượt."
            action={<Button title="Thêm ngân sách" icon="add" onPress={add} />}
          />
        </Card>
      ) : null}

      {budgets?.length && allocation ? (
        <Card>
          <View style={{ gap: 8 }}>
            <AppText variant="label" color="textMuted">
              Phân bổ thu nhập
            </AppText>
            <AppText variant="heading">
              {t('Đã giao {total} / {income} thu nhập trung bình', {
                total: format.money(allocation.total),
                income: format.money(allocation.income),
              })}
            </AppText>
            <ProgressBar
              value={Math.min(1, allocation.ratio)}
              color={allocation.over ? colors.expense : colors.primary}
              height={10}
            />
            <AppText variant="caption" color={allocation.over ? 'expense' : 'textMuted'}>
              {allocation.over
                ? t('Hạn mức đang vượt thu nhập {amount}', {
                    amount: format.money(-allocation.free),
                  })
                : t('Còn {amount} chưa giao cho ngân sách nào (để tiết kiệm hoặc chi khác)', {
                    amount: format.money(allocation.free),
                  })}
            </AppText>
          </View>
        </Card>
      ) : null}

      {budgets?.map((b) => (
        <Pressable
          key={b.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/budget/[id]', params: { id: b.id } })}
        >
          <Card>
            <BudgetBar item={b} />
          </Card>
        </Pressable>
      ))}

      {budgets?.length ? (
        <AppText variant="caption" color="textMuted">
          Chỉ tính khoản chi (không tính chuyển khoản, điều chỉnh số dư, sổ nợ). Kỳ theo ngày bắt
          đầu tháng trong cài đặt.
        </AppText>
      ) : null}
    </Screen>
  );
}
