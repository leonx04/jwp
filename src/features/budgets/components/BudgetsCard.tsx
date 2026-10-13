// Thẻ ngân sách ở Tổng quan: tối đa 3 ngân sách đang căng nhất. Ẩn khi chưa có ngân sách nào.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Card } from '@/components/ui';

import { useBudgets } from '../hooks';
import { BudgetBar } from './BudgetBar';

export function BudgetsCard() {
  const { data } = useBudgets();
  if (!data?.length) return null;
  const top = [...data].sort((a, b) => b.ratio - a.ratio).slice(0, 3);

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="heading">Ngân sách tháng này</AppText>
        <Pressable onPress={() => router.push('/budgets')} hitSlop={8} accessibilityRole="button">
          <AppText variant="label" color="primary">
            Xem tất cả
          </AppText>
        </Pressable>
      </View>
      {top.map((b) => (
        <BudgetBar key={b.id} item={b} />
      ))}
    </Card>
  );
}
