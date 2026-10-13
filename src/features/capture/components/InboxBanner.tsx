// Thẻ nhắc ở Tổng quan: có giao dịch app tự đọc đang chờ xác nhận. Ẩn khi không có gì chờ.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Card, IconBadge } from '@/components/ui';

import { usePendingCaptureCount } from '../hooks';

export function InboxBanner() {
  const count = usePendingCaptureCount();
  if (!count) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/inbox')}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBadge icon="mail-unread-outline" color="#7C3AED" size={40} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium">{count} giao dịch chờ xác nhận</AppText>
          <AppText variant="caption" color="textMuted">
            App đọc từ thông báo ngân hàng — bấm để kiểm tra và ghi
          </AppText>
        </View>
        <AppText variant="label" color="primary">
          Xem ›
        </AppText>
      </Card>
    </Pressable>
  );
}
