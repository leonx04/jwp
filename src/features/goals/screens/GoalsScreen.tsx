// Quỹ / mục tiêu tiết kiệm: tiến độ từng mục tiêu, cần góp bao nhiêu mỗi tháng để kịp hạn.
import { t } from '@/lib/i18n';
import { router } from 'expo-router';

import { IconButton } from '@/components/glass/IconButton';
import { Confetti } from '@/components/motion/Confetti';
import { Reveal } from '@/components/motion/Reveal';
import { AppText, Button, Card, EmptyState, Screen } from '@/components/ui';

import { GoalCard } from '../components/GoalCard';
import { useGoals } from '../hooks';
import { useGoalCelebration } from '../useGoalCelebration';

export function GoalsScreen() {
  const { data: goals } = useGoals();
  const celebration = useGoalCelebration(goals);
  const add = () => router.push('/goal/edit');

  return (
    <>
      <Screen
        title="Quỹ tiết kiệm"
        headerRight={
          <IconButton icon="add" accessibilityLabel={t('Thêm mục tiêu')} onPress={add} />
        }
      >
        {goals && goals.length === 0 ? (
          <Card>
            <EmptyState
              icon="flag-outline"
              title="Chưa có mục tiêu nào"
              description="Đặt mục tiêu (du lịch, mua máy, quỹ dự phòng…) và gắn với một ví để app theo dõi tiến độ, tính cần góp bao nhiêu mỗi tháng."
              action={<Button title="Thêm mục tiêu" icon="add" onPress={add} />}
            />
          </Card>
        ) : null}

        {goals?.map((g, i) => (
          <Reveal key={g.goal.id} index={i}>
            <Card>
              <GoalCard item={g} actions />
            </Card>
          </Reveal>
        ))}

        {goals?.length ? (
          <AppText variant="caption" color="textMuted">
            Mục tiêu gắn ví: tiến độ chính là số dư của ví đó, nên mọi khoản chuyển vào ví đều được
            tính. Mục tiêu không gắn ví: bạn tự cập nhật số đã góp trong màn sửa.
          </AppText>
        ) : null}
      </Screen>
      {/* Phủ cả màn (ngoài vùng cuộn) */}
      {celebration.show ? <Confetti onDone={celebration.hide} /> : null}
    </>
  );
}
