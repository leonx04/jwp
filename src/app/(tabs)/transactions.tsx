import { AppText, Card, EmptyState, Screen } from '@/components/ui';

export default function TransactionsTab() {
  return (
    <Screen safeTop>
      <AppText variant="title">Giao dịch</AppText>
      <Card>
        <EmptyState
          icon="receipt-outline"
          title="Danh sách giao dịch"
          description="Giai đoạn 2: nhóm theo ngày, tìm kiếm, lọc theo ví / danh mục / tag, vuốt để xoá."
        />
      </Card>
    </Screen>
  );
}
