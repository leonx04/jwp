import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { createStyles } from '@/theme';

import { AppText, type TextColor } from './AppText';

type Option<T extends string> = { value: T; label: string; color?: TextColor };

type SegmentedControlProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Rãnh kính dạng viên thuốc, "giọt" chỉ báo trượt mượt (Reanimated, luồng UI) */
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

  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(selectedIndex * segmentWidth, { damping: 20, stiffness: 220 });
  }, [selectedIndex, segmentWidth, x]);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width - 8);

  return (
    <View style={styles.container} onLayout={onLayout} accessibilityRole="tablist">
      {width > 0 && (
        <Animated.View style={[styles.indicator, { width: segmentWidth }, indicatorStyle]} />
      )}
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
            <AppText
              variant="label"
              color={selected ? (option.color ?? 'text') : 'textMuted'}
              style={{ fontSize: 13 }}
            >
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
    borderRadius: t.radius.full,
    backgroundColor: t.colors.glassFill,
    borderWidth: 1,
    borderColor: t.colors.glassBorder,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.glassActive,
    boxShadow: t.dark ? 'none' : `0 2px 8px ${t.colors.shadow}`,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
  },
}));
