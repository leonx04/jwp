// Thanh tab nổi kiểu Liquid Glass: viên thuốc kính (làm mờ nội dung phía sau) + "giọt" chỉ báo trượt,
// và nút ＋ tròn gradient tách riêng bên phải.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useState, type RefObject } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type View as RNView,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { TAB_BAR_HEIGHT } from '@/components/ui/Screen';
import type { IconName } from '@/lib/icons';
import { rgba, useTheme } from '@/theme';

import { GlassSurface } from './GlassSurface';

export type TabItem = {
  href: Href;
  path: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
};

type GlassTabBarProps = {
  items: TabItem[];
  blurTarget: RefObject<RNView | null>;
  onAdd: () => void;
};

export function GlassTabBar({ items, blurTarget, onAdd }: GlassTabBarProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const active = Math.max(
    0,
    items.findIndex((item) => item.path === pathname),
  );
  const itemWidth = items.length ? width / items.length : 0;

  // Chỉ hoạt ảnh vị trí (shared value); chiều rộng đặt bằng style thường sau khi đo layout
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(active * itemWidth, { damping: 18, stiffness: 200 });
  }, [active, itemWidth, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + spacing.md, paddingHorizontal: spacing.lg }]}
    >
      <GlassSurface
        variant="chrome"
        blurTarget={blurTarget}
        radius={TAB_BAR_HEIGHT / 2}
        shadow
        style={styles.bar}
        contentStyle={styles.barContent}
      >
        <View
          style={styles.items}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        >
          {width > 0 && (
            <Animated.View
              style={[
                styles.indicator,
                {
                  width: itemWidth,
                  backgroundColor: colors.glassActive,
                  borderColor: colors.glassBorder,
                },
                indicator,
              ]}
            />
          )}
          {items.map((item, index) => {
            const selected = index === active;
            return (
              <Pressable
                key={item.path}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={item.label}
                style={styles.item}
                onPress={() => {
                  if (selected) return;
                  Haptics.selectionAsync().catch(() => {});
                  router.navigate(item.href);
                }}
              >
                <Ionicons
                  name={selected ? item.iconActive : item.icon}
                  size={22}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <AppText
                  variant="label"
                  style={{ fontSize: 10.5, lineHeight: 14 }}
                  color={selected ? 'primary' : 'textMuted'}
                  numberOfLines={1}
                >
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thêm giao dịch"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onAdd();
        }}
        style={({ pressed }) => [
          styles.fab,
          {
            boxShadow: `0 10px 28px ${rgba(colors.gradient[0], colors.dark ? 0.55 : 0.45)}`,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.fabRim, { borderColor: 'rgba(255,255,255,0.35)' }]} />
        <Ionicons name="add" size={32} color={colors.onGradient} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bar: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
  },
  barContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  items: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT - 10,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    borderWidth: 1,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  fab: {
    width: TAB_BAR_HEIGHT,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fabRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 1,
  },
});
