import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStyles } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  /** true: nội dung cuộn được. Đặt false khi màn hình tự dùng danh sách (FlashList). */
  scroll?: boolean;
  /** true khi màn hình không có header → chừa chỗ cho thanh trạng thái / tai thỏ */
  safeTop?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Khung chung cho mọi màn hình: nền theo theme + padding chuẩn. */
export function Screen({ children, scroll = true, safeTop = false, contentStyle }: ScreenProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const topPadding = safeTop ? { paddingTop: insets.top + 8 } : null;

  if (!scroll) {
    return <View style={[styles.root, styles.content, topPadding, contentStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, topPadding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  content: {
    flexGrow: 1,
    padding: t.spacing.lg,
    paddingBottom: t.spacing.xxl * 2,
    gap: t.spacing.lg,
  },
}));
