// Ô hiển thị số tiền nhập bằng bàn phím số có sẵn của màn hình (không mở bàn phím hệ thống).
import { t } from '@/lib/i18n';
import { Pressable, View } from 'react-native';

import type { AppIcon } from '@/lib/icons';
import { rgba, useTheme } from '@/theme';

import { AppIconGlyph } from './AppIconGlyph';
import { AppText } from './AppText';

type KeypadFieldProps = {
  icon: AppIcon;
  /** Nhãn nhỏ phía trên giá trị */
  label: string;
  /** Chuỗi đã định dạng; rỗng = hiện placeholder */
  text: string;
  placeholder?: string;
  /** Đang được bàn phím số điều khiển */
  active: boolean;
  onPress: () => void;
};

export function KeypadField({ icon, label, text, placeholder, active, onPress }: KeypadFieldProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.glassBorder,
        backgroundColor: active ? rgba(colors.primary, 0.1) : colors.glassFill,
      }}
    >
      <AppIconGlyph icon={icon} size={20} color={active ? colors.primary : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <AppText variant="caption" color="textMuted">
          {label}
        </AppText>
        <AppText variant="bodyMedium" color={text ? 'text' : 'textMuted'}>
          {text || placeholder || '0'}
        </AppText>
      </View>
    </Pressable>
  );
}
