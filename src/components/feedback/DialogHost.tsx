// Hiện hộp thoại trong hàng đợi (dialogStore) dạng bảng trượt từ dưới lên, theo màu của app.
// Gắn một lần ở root layout. Không dùng Reanimated trong Modal (Android hay kẹt).
import { useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { createStyles } from '@/theme';

import { dismissDialog, pressDialogButton, useDialogs, type DialogButton } from './dialogStore';

const VARIANT = { default: 'primary', cancel: 'secondary', destructive: 'danger' } as const;

/** Hai nút ngắn → nằm cạnh nhau; nhiều nút / nhãn dài → xếp dọc, nút huỷ xuống cuối */
function layoutOf(buttons: readonly DialogButton[]) {
  const row = buttons.length <= 2 && buttons.every((b) => t(b.text).length <= 14);
  const order = buttons.map((button, index) => ({ button, index }));
  if (!row)
    order.sort((a, b) => Number(a.button.style === 'cancel') - Number(b.button.style === 'cancel'));
  return { row, order };
}

export function DialogHost() {
  const dialog = useDialogs((s) => s.queue[0]);
  const setHostMounted = useDialogs((s) => s.setHostMounted);
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setHostMounted(true);
    return () => setHostMounted(false);
  }, [setHostMounted]);

  const { row, order } = dialog ? layoutOf(dialog.buttons) : { row: true, order: [] };

  return (
    <Modal
      visible={!!dialog}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => dialog && dismissDialog(dialog.id)}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={() => dialog && dismissDialog(dialog.id)}
          accessibilityLabel={t('Đóng')}
        />
        {dialog ? (
          <View
            key={dialog.id}
            accessibilityRole="alert"
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
          >
            <View style={styles.handle} />
            <AppText variant="heading">{dialog.title}</AppText>
            {dialog.message ? (
              <AppText color="textMuted" style={styles.message}>
                {dialog.message}
              </AppText>
            ) : null}
            <View style={row ? styles.row : styles.column}>
              {order.map(({ button, index }) => (
                <Button
                  key={index}
                  title={button.text}
                  variant={VARIANT[button.style ?? 'default']}
                  haptic={button.style === 'destructive' || undefined}
                  style={row ? styles.flex : undefined}
                  onPress={() => pressDialogButton(dialog.id, index)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const useStyles = createStyles((t) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radius.xl,
    borderTopRightRadius: t.radius.xl,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.sm,
    gap: t.spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.border,
  },
  message: { marginTop: -4 },
  row: { flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.xs },
  column: { gap: t.spacing.sm, marginTop: t.spacing.xs },
  flex: { flex: 1 },
}));
