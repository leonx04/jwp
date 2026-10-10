import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { createStyles, mix } from '@/theme';

import { AppText } from './AppText';

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Nhóm nút chọn một, ô được chọn trượt mượt bằng Reanimated (chạy trên luồng UI). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const segmentWidth = options.length > 0 ? width / options.length : 0;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [
      { translateX: withSpring(selectedIndex * segmentWidth, { damping: 18, stiffness: 180 }) },
    ],
  }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width - 8);

  return (
    <View style={styles.container} onLayout={onLayout} accessibilityRole="tablist">
      {width > 0 && <Animated.View style={[styles.indicator, indicatorStyle]} />}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
          >
            <AppText variant="label" color={selected ? 'text' : 'textMuted'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceAlt,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: t.radius.sm,
    // Ô được chọn phải nổi rõ trên nền rãnh: sáng → trắng có viền + bóng; tối → sáng hơn rãnh
    backgroundColor: t.dark ? mix(t.colors.surfaceAlt, '#FFFFFF', 0.1) : '#FFFFFF',
    borderWidth: t.dark ? 0 : 1,
    borderColor: t.colors.border,
    shadowColor: '#000',
    shadowOpacity: t.dark ? 0 : 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: t.dark ? 0 : 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.spacing.sm,
  },
}));
