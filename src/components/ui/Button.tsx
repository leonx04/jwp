import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { rgba, useTheme } from '@/theme';

import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: ButtonVariant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  size?: 'md' | 'sm';
  /** Rung nhẹ khi bấm (mặc định bật cho nút primary) */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Nút dạng viên thuốc (capsule). Primary: gradient màu chủ đạo + quầng sáng. Secondary: kính. */
export function Button({
  title,
  variant = 'primary',
  icon,
  size = 'md',
  haptic = variant === 'primary',
  disabled,
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const { colors, spacing } = useTheme();
  const height = size === 'md' ? 52 : 38;

  const foreground = {
    primary: colors.onGradient,
    secondary: colors.text,
    danger: '#FFFFFF',
    ghost: colors.primary,
  }[variant];

  const handlePress = (event: GestureResponderEvent) => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.(event);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: size === 'md' ? spacing.xl : spacing.lg,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        variant === 'primary' && {
          boxShadow: `0 8px 24px ${rgba(colors.gradient[0], colors.dark ? 0.45 : 0.35)}`,
        },
        variant === 'secondary' && {
          backgroundColor: colors.glassFill,
          borderWidth: 1,
          borderColor: colors.glassBorder,
        },
        variant === 'danger' && { backgroundColor: colors.expense },
        style,
      ]}
      {...rest}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.capsule]}
        />
      ) : null}
      {icon && <Ionicons name={icon} size={size === 'md' ? 20 : 16} color={foreground} />}
      <AppText
        variant={size === 'md' ? 'bodyMedium' : 'label'}
        style={{ color: foreground, fontSize: size === 'md' ? 16 : 13 }}
        numberOfLines={1}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  capsule: {
    borderRadius: 999,
  },
});
