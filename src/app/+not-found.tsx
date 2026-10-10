// Hiển thị khi điều hướng tới một route không tồn tại
import { Link, Stack } from 'expo-router';

import { AppText, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Không tìm thấy' }} />
      <AppText variant="heading">Màn hình này không tồn tại.</AppText>
      <Link href="/">
        <AppText color="primary">Về Tổng quan</AppText>
      </Link>
    </Screen>
  );
}
