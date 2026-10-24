// Dock nổi "Bento Float": viên thuốc màu mực đậm (đảo màu so với nền — sáng ↔ tối) tách khỏi mép màn hình.
// Mục đang chọn mở rộng thành viên màu chủ đạo kèm nhãn; mục khác chỉ còn icon. Nút ＋ tròn gradient ở giữa dock.
import { t } from '@/lib/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname, type Href } from 'expo-router';
import type { RefObject } from 'react';
import { StyleSheet, View, type View as RNView } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressScale } from '@/components/motion/PressScale';
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
  /** Giữ để tương thích; dock đặc nên không làm mờ */
  blurTarget?: RefObject<RNView | null>;
  onAdd: () => void;
};

export function GlassTabBar({ items, onAdd }: GlassTabBarProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  // Dấu ＋ xoay khi bấm giữ
  const spin = useSharedValue(0);
  const plusStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 90}deg` }] }));

  // Dock đảo màu: nền sáng → dock tối; nền tối → dock sáng
  const dockBg = colors.inverseSurface;
  const idle = colors.inverseMuted;

  // Nút ＋ nằm giữa dock: ngón cái với tới dễ nhất
  const half = Math.ceil(items.length / 2);
  const renderTab = (item: TabItem) => {
    const selected = item.path === pathname;
    return (
      // Bọc ngoài để dock tự trượt mượt khi mục chọn đổi (rộng ra / thu gọn) thay vì nhảy
      <Animated.View
        key={item.path}
        layout={LinearTransition.springify().damping(17).stiffness(190)}
      >
        <PressScale
          accessibilityRole="tab"
          accessibilityState={{ selected }}
          accessibilityLabel={t(item.label)}
          scaleTo={0.9}
          style={[
            styles.item,
            selected
              ? { backgroundColor: colors.primary, paddingHorizontal: 12 }
              : { width: 40 },
          ]}
          onPress={() => {
            if (selected) return;
            Haptics.selectionAsync().catch(() => {});
            router.navigate(item.href);
          }}
        >
          <Ionicons
            name={selected ? item.iconActive : item.icon}
            size={21}
            color={selected ? colors.onPrimary : idle}
          />
          {selected ? (
            <Animated.View
              entering={FadeIn.duration(180).delay(70)}
              exiting={FadeOut.duration(80)}
            >
              <AppText
                variant="label"
                style={{ color: colors.onPrimary, fontSize: 12 }}
                numberOfLines={1}
              >
                {item.label}
              </AppText>
            </Animated.View>
          ) : null}
        </PressScale>
      </Animated.View>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + spacing.md, paddingHorizontal: spacing.lg }]}
    >
      <View
        style={[
          styles.dock,
          { backgroundColor: dockBg, boxShadow: `0 10px 30px rgba(0,0,0,0.28)` },
        ]}
      >
        {items.slice(0, half).map(renderTab)}
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={t('Thêm giao dịch')}
          scaleTo={0.9}
          onPressIn={() => spin.set(withSpring(1, { damping: 14, stiffness: 260 }))}
          onPressOut={() => spin.set(withSpring(0, { damping: 9, stiffness: 180 }))}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onAdd();
          }}
          style={[
            styles.fab,
            { boxShadow: `0 6px 16px ${rgba(colors.gradient[0], colors.dark ? 0.55 : 0.45)}` },
          ]}
        >
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={plusStyle}>
            <Ionicons name="add" size={32} color={colors.onGradient} />
          </Animated.View>
        </PressScale>
        {items.slice(half).map(renderTab)}
      </View>
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
    gap: 10,
  },
  dock: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 2,
    justifyContent: 'space-between',
  },
  item: {
    height: TAB_BAR_HEIGHT - 16,
    borderRadius: (TAB_BAR_HEIGHT - 16) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fab: {
    width: TAB_BAR_HEIGHT - 12,
    height: TAB_BAR_HEIGHT - 12,
    borderRadius: (TAB_BAR_HEIGHT - 12) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
