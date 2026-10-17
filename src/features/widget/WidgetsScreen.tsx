// Thêm widget JWP ra màn hình chính bằng một nút (launcher hiện hộp xác nhận); không hỗ trợ thì chỉ cách thêm tay.
import { Platform, View } from 'react-native';
import { requestPinWidget } from 'react-native-android-widget';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { t } from '@/lib/i18n';
import { createStyles } from '@/theme';

const WIDGETS = [
  {
    name: 'JwpToday',
    title: 'Hôm nay được tiêu',
    text: 'Số tiền còn được tiêu hôm nay, thanh tiến độ, nút Chi / Thu / Gõ nhanh. Đổi màu khi sắp hết hoặc vượt.',
  },
  {
    name: 'JwpBudgets',
    title: 'Ngân sách còn lại',
    text: 'Ba ngân sách sát hạn mức nhất, mỗi cái có thanh tiến độ xanh, vàng hoặc đỏ.',
  },
] as const;

export function WidgetsScreen() {
  const styles = useStyles();

  const add = async (widgetName: string) => {
    let ok = false;
    try {
      ok = Platform.OS === 'android' && (await requestPinWidget({ widgetName }));
    } catch {
      ok = false;
    }
    if (!ok) {
      showSnackbar({
        text: t('Máy không hỗ trợ thêm tự động. Giữ lâu màn hình chính → Tiện ích → JWP.'),
        tone: 'error',
      });
    }
  };

  return (
    <Screen title="Widget màn hình chính" scroll>
      <AppText color="textMuted">
        Xem nhanh tiền được tiêu và ngân sách ngay ở màn hình chính, không cần mở app.
      </AppText>
      {WIDGETS.map((w) => (
        <Card key={w.name}>
          <AppText variant="heading">{w.title}</AppText>
          <AppText color="textMuted">{w.text}</AppText>
          <View style={styles.row}>
            <Button title="Thêm ra màn hình chính" icon="add-circle-outline" onPress={() => add(w.name)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const useStyles = createStyles((th) => ({
  row: { marginTop: th.spacing.sm },
}));
