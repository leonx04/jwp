import Constants from 'expo-constants';
import { router } from 'expo-router';

import { AppText, Card, ListRow, Screen, SectionTitle } from '@/components/ui';

export function MoreScreen() {
  return (
    <Screen safeTop>
      <AppText variant="title">Thêm</AppText>

      <SectionTitle>Cài đặt</SectionTitle>
      <Card>
        <ListRow
          icon="color-palette-outline"
          title="Giao diện"
          subtitle="Sáng / Tối / AMOLED, màu chủ đạo, ký hiệu tiền"
          onPress={() => router.push('/settings/appearance')}
        />
        <ListRow
          icon="notifications-outline"
          title="Kiểm tra thông báo"
          subtitle="Thử popup, nút hành động, hướng dẫn cho Huawei"
          onPress={() => router.push('/settings/notifications')}
        />
      </Card>

      <SectionTitle>Dữ liệu</SectionTitle>
      <Card>
        <ListRow
          icon="download-outline"
          title="Import từ Ivy Wallet"
          subtitle="Chuyển ví, giao dịch, lịch định kỳ từ file backup"
          onPress={() => router.push('/import/ivy')}
        />
        <ListRow
          icon="cloud-upload-outline"
          title="Sao lưu & xuất file"
          subtitle="Giai đoạn 6"
          disabled
          onPress={() => {}}
        />
      </Card>

      <AppText variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
        JWP {Constants.expoConfig?.version ?? ''} · dữ liệu lưu trên máy, không cần internet
      </AppText>
    </Screen>
  );
}
