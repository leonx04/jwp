// Ô nhập tiền: bấm mở bảng bàn phím số của app (có sẵn máy tính + − × ÷), KHÔNG mở bàn phím hệ thống.
// Giá trị do màn hình cha quản lý (controlled) nên đổi từ bên ngoài (vd nút "+10%") là hiện ngay.
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMoneyFormat } from '@/features/settings/hooks/useMoneyFormat';
import { createStyles } from '@/theme';

import { AmountKeypad } from './AmountKeypad';
import { AppText } from './AppText';
import { Button } from './Button';
import { KeypadField } from './KeypadField';

type MoneyFieldProps = {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  /** Giữ để tương thích; không còn dùng vì ô dùng bàn phím số của app */
  keyboardType?: 'default' | 'numeric';
};

export function MoneyField({
  label,
  value,
  onChange,
  placeholder = 'vd: 1.500.000',
}: MoneyFieldProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const format = useMoneyFormat();
  const [open, setOpen] = useState(false);
  const title = label ?? 'Số tiền';

  return (
    <View>
      <KeypadField
        icon="cash-outline"
        label={title}
        text={value ? format.money(value) : ''}
        placeholder={placeholder}
        active={open}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.root}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityLabel="Đóng"
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.handle} />
            <AppText variant="label" color="textMuted" style={{ textAlign: 'center' }}>
              {title}
            </AppText>
            <AppText
              variant="display"
              style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {format.money(value)}
            </AppText>
            <AmountKeypad value={value} onChange={onChange} />
            <Button title="Xong" icon="checkmark" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: t.spacing.lg,
    paddingTop: 8,
    gap: t.spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.border,
    marginBottom: 4,
  },
}));
