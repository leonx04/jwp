// Thanh điều hướng phẳng, đặc, full-width (khuyến nghị cho app tài chính: dễ đọc, không che nội dung).
// Mục đang chọn: viên thuốc nhạt sau icon (kiểu Material 3) + nhãn đậm. Nút ＋ nằm giữa thanh.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname, type Href } from 'expo-router';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, View, type View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { TAB_BAR_HEIGHT } from '@/components/ui/Screen';
import type { IconName } from '@/lib/icons';
import { rgba, useTheme } from '@/theme';

export type TabItem = {
  href: Href;
  path: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
};

type GlassTabBarProps = {
  items: TabItem[];
  /** Giữ để tương thích; thanh phẳng không làm mờ nên không dùng */
  blurTarget?: RefObject<RNView | null>;
  onAdd: () => void;
};

export function GlassTabBar({ items, onAdd }: GlassTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const half = Math.ceil(items.length / 2);

  const renderItem = (item: TabItem) => {
    const selected = item.path === pathname;
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
        <View style={[styles.pill, selected && { backgroundColor: colors.primarySoft }]}>
          <Ionicons
            name={selected ? item.iconActive : item.icon}
            size={22}
            color={selected ? colors.primary : colors.textMuted}
          />
        </View>
        <AppText
          variant="label"
          style={{ fontSize: 11, lineHeight: 14 }}
          color={selected ? 'primary' : 'textMuted'}
          numberOfLines={1}
        >
          {item.label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: insets.bottom,
          height: TAB_BAR_HEIGHT + insets.bottom,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      {items.slice(0, half).map(renderItem)}
      <View style={styles.item}>
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
              boxShadow: `0 6px 16px ${rgba(colors.gradient[0], colors.dark ? 0.5 : 0.35)}`,
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
          <Ionicons name="add" size={30} color={colors.onGradient} />
        </Pressable>
      </View>
      {items.slice(half).map(renderItem)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: TAB_BAR_HEIGHT,
  },
  pill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
