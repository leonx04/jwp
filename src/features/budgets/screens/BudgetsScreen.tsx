// Ngân sách theo tháng: thanh tiến độ từng khoản, cảnh báo sắp hết / dự báo vượt.
import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import { AppText, Button, Card, EmptyState, Screen } from '@/components/ui';

import { BudgetBar } from '../components/BudgetBar';
import { useBudgets } from '../hooks';

export function BudgetsScreen() {
  const { data: budgets } = useBudgets();
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

      {budgets?.map((b) => (
        <Pressable
          key={b.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/budget/edit', params: { id: b.id } })}
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
