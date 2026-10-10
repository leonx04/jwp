import { router } from 'expo-router';

import { Button, Card, EmptyState, Screen } from '@/components/ui';

export default function NewTransactionScreen() {
  return (
    <Screen>
      <Card>
        <EmptyState
          icon="add-circle-outline"
          title="Thêm giao dịch"
          description="Giai đoạn 2: bàn phím số có phím 000, chọn ví / danh mục / tag, chuyển tiền giữa các ví, gợi ý theo lịch sử và số tiền tương tự."
          action={<Button title="Đóng" variant="secondary" onPress={() => router.back()} />}
        />
      </Card>
    </Screen>
  );
}
