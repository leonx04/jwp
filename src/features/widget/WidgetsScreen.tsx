// Thêm widget JWP ra màn hình chính bằng một nút (launcher hiện hộp xác nhận); không hỗ trợ thì chỉ cách thêm tay.
import { Platform, View } from 'react-native';
import { requestPinWidget } from 'react-native-android-widget';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { t } from '@/lib/i18n';
import { createStyles } from '@/theme';

const WIDGETS = [
  {
    name: 'JwpCustom',
    title: 'Tùy chỉnh (khuyên dùng)',
    text: 'Bạn chọn hiện gì: số dư, thu chi theo kỳ, ngân sách, quỹ tiết kiệm, dư nợ trả sau, khoản sắp tới, sổ nợ; chọn ví / ngân sách / quỹ cụ thể, màu và có ẩn số tiền hay không. Thêm nhiều widget, mỗi cái một kiểu.',
  },
  {
    name: 'JwpToday',
    title: 'Còn hôm nay',
    text: 'Cỡ 2×1: số tiền còn tiêu được hôm nay + thanh tiến độ + nút + ghi nhanh. Kéo to hơn để có thêm nút Chi / Thu.',
  },
  {
    name: 'JwpBudgets',
    title: 'Ngân sách',
    text: 'Cỡ 2×1: ngân sách sát hạn mức nhất. Kéo cao hơn để thấy thêm các ngân sách khác.',
  },
  {
    name: 'JwpQuick',
    title: 'Ghi nhanh',
    text: 'Cỡ 1×1: chỉ một nút + để mở Gõ nhanh. Nhỏ nhất, hợp khi màn hình chính hết chỗ.',
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
