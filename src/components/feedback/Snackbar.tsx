import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { TAB_BAR_HEIGHT } from '@/components/ui/Screen';
import { useTheme } from '@/theme';

import { useSnackbar } from './snackbarStore';

const DURATION_MS = 4500;

/** Gắn một lần ở root layout. Nổi phía trên thanh tab. */
export function Snackbar() {
  const { current, hide } = useSnackbar();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(hide, DURATION_MS);
    return () => clearTimeout(timer);
  }, [current, hide]);

  if (!current) return null;
  const icon =
    current.tone === 'error'
      ? 'alert-circle'
      : current.tone === 'success'
        ? 'checkmark-circle'
        : 'information-circle';
  const iconColor =
    current.tone === 'error'
      ? colors.expense
      : current.tone === 'success'
        ? colors.income
        : colors.primary;

  return (
    <Animated.View
      key={current.id}
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: insets.bottom + TAB_BAR_HEIGHT + spacing.xl, paddingHorizontal: spacing.lg },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.dark ? 'rgba(36,38,48,0.96)' : 'rgba(22,24,32,0.94)',
            boxShadow: `0 10px 30px ${colors.shadow}`,
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
        <AppText style={styles.text} numberOfLines={2}>
          {current.text}
        </AppText>
        {current.actionLabel ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              current.onAction?.();
              hide();
            }}
          >
            <AppText
              variant="bodyMedium"
              style={{ color: colors.dark ? colors.primary : '#A5B4FC' }}
            >
              {current.actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
  },
  text: {
    flex: 1,
    color: '#F3F4F8',
  },
});
