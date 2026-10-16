// Gợi ý tag từ lịch sử: các cụm hay lặp trong tiêu đề giao dịch. Xem lại rồi tạo tag và gắn vào giao dịch cũ.
import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, EmptyState, Screen } from '@/components/ui';
import { db } from '@/db';
import { useMoneyFormat } from '@/features/settings';

import { useTagProposals } from '../hooks';
import type { TagProposal } from '../suggest';
import { applyTagProposal } from '../suggestRepository';

export function TagSuggestScreen() {
  useMoneyFormat();
  const { data: proposals } = useTagProposals();

  const apply = (items: TagProposal[]) => {
    try {
      let linked = 0;
      for (const p of items) linked += applyTagProposal(db, p);
      showSnackbar({
        text: `Đã tạo ${items.length} tag, gắn vào ${linked} giao dịch`,
        tone: 'success',
      });
      if (items.length === proposals?.length) router.back();
    } catch (error) {
      Alert.alert('Chưa tạo được', error instanceof Error ? error.message : String(error));
    }
  };

  const confirmAll = () =>
    Alert.alert(
      `Tạo ${proposals?.length} tag?`,
      'Mỗi tag được gắn vào các giao dịch cũ có tiêu đề chứa cụm đó. Số tiền và danh mục không đổi.',
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Tạo tất cả', onPress: () => apply(proposals ?? []) },
      ],
    );

  return (
    <Screen title="Gợi ý tag từ lịch sử">
      <AppText color="textMuted">
        App tìm các cụm hay lặp trong tiêu đề giao dịch (vd “Ăn sáng”, “Cà phê”, “Sửa xe”). Tạo tag
        để lọc và thống kê theo chủ đề, bất kể danh mục. Không làm đổi số tiền hay danh mục.
      </AppText>

      {proposals && proposals.length === 0 ? (
        <Card>
          <EmptyState
            icon="checkmark-done-outline"
            title="Không còn gợi ý nào"
            description="Cần một cụm lặp lại từ 3 giao dịch trở lên mới được gợi ý."
          />
        </Card>
      ) : null}

      {proposals && proposals.length > 1 ? (
        <Button
          title={`Tạo tất cả (${proposals.length} tag)`}
          icon="checkmark-done"
          onPress={confirmAll}
        />
      ) : null}

      {proposals?.map((p) => (
        <Card key={p.key} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" numberOfLines={1}>
                #{p.name}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={2}>
                {p.samples.join(' · ')}
              </AppText>
            </View>
            <AppText variant="bodyMedium" color="textMuted">
              {p.count} giao dịch
            </AppText>
          </View>
          <Button title="Tạo và gắn tag" size="sm" variant="secondary" onPress={() => apply([p])} />
        </Card>
      ))}
    </Screen>
  );
}
