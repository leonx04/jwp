// Thẻ gợi ý ở tab Lịch: app thấy khoản lặp hằng tháng chưa có lịch. Ẩn khi không có gì để gợi ý.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Card, IconBadge } from '@/components/ui';
import { SWATCH } from '@/theme';

import { useRecurringSuggestions } from '../hooks';

export function RecurringBanner() {
  const { data } = useRecurringSuggestions();
  if (!data || data.length === 0) return null;
  const names = data
    .slice(0, 2)
    .map((s) => s.title)
    .join(', ');
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/recurring')}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBadge icon="repeat-outline" color={SWATCH.sky} size={40} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium">{data.length} khoản có vẻ lặp hằng tháng</AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {names}
            {data.length > 2 ? '…' : ''} — bấm để tạo lịch nhắc
          </AppText>
        </View>
        <AppText variant="label" color="primary">
          Xem ›
        </AppText>
      </Card>
    </Pressable>
  );
}
