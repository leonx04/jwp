import { AppText, Card, EmptyState, Screen } from '@/components/ui';

export default function ScheduleTab() {
  return (
    <Screen safeTop>
      <AppText variant="title">Lịch thu chi</AppText>
      <Card>
        <EmptyState
          icon="calendar-outline"
          title="Dự trù & lịch thu chi"
          description="Giai đoạn 3: lịch nhận lương, khoản phải trả định kỳ, dòng tiền dự kiến và mức chi an toàn mỗi ngày."
        />
      </Card>
    </Screen>
  );
}
