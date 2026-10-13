// Thẻ Quỹ ở Tổng quan: tối đa 2 mục tiêu chưa đạt. Ẩn khi chưa có mục tiêu nào.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Card } from '@/components/ui';

import { useGoals } from '../hooks';
import { GoalCard } from './GoalCard';

export function GoalsCard() {
  const { data } = useGoals();
  const open = (data ?? []).filter((g) => !g.done).slice(0, 2);
  if (!open.length) return null;

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="heading">Quỹ tiết kiệm</AppText>
        <Pressable onPress={() => router.push('/goals')} hitSlop={8} accessibilityRole="button">
          <AppText variant="label" color="primary">
            Xem tất cả
          </AppText>
        </Pressable>
      </View>
      {open.map((g) => (
        <GoalCard key={g.goal.id} item={g} />
      ))}
    </Card>
  );
}
