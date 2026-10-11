import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { AppIcon } from '@/lib/icons';
import { createStyles, useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconBadge } from './IconBadge';

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: AppIcon;
  iconColor?: string;
  /** Nội dung bên phải (số tiền, switch...). Không truyền + có onPress → hiện mũi tên */
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
};

export function ListRow({
  title,
  subtitle,
  icon,
  iconColor,
  right,
  onPress,
  disabled,
}: ListRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {icon && <IconBadge icon={icon} color={iconColor} size={38} />}
      <View style={styles.texts}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ??
        (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.45,
  },
}));
