import { Card, EmptyState, Screen } from '@/components/ui';

export default function ScheduleTab() {
  return (
    <Screen tabBar largeTitle title="Lịch thu chi">
      <Card>
        <EmptyState
          icon="calendar-outline"
          title="Dự trù & lịch thu chi"
          description="Lịch nhận lương, khoản phải trả định kỳ, dòng tiền dự kiến và mức chi an toàn mỗi ngày."
        />
      </Card>
    </Screen>
  );
}
