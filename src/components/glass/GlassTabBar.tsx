// Dock nổi "Bento Float": viên thuốc màu mực đậm (đảo màu so với nền — sáng ↔ tối) tách khỏi mép màn hình.
// Mục đang chọn mở rộng thành viên màu chủ đạo kèm nhãn; mục khác chỉ còn icon. Nút ＋ tròn gradient bên phải.
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
  /** Giữ để tương thích; dock đặc nên không làm mờ */
  blurTarget?: RefObject<RNView | null>;
  onAdd: () => void;
};

export function GlassTabBar({ items, onAdd }: GlassTabBarProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Dock đảo màu: nền sáng → dock tối; nền tối → dock sáng
  const dockBg = colors.dark ? '#E9EDF5' : '#0E1320';
  const idle = colors.dark ? '#5F687C' : '#8C97AD';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + spacing.md, paddingHorizontal: spacing.lg }]}
    >
      <View
        style={[
          styles.dock,
          { backgroundColor: dockBg, boxShadow: `0 10px 30px ${rgba('#000000', 0.28)}` },
        ]}
      >
        {items.map((item) => {
          const selected = item.path === pathname;
          return (
            <Pressable
              key={item.path}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={item.label}
              style={[
                styles.item,
                selected
                  ? { backgroundColor: colors.primary, paddingHorizontal: 16 }
                  : { width: 44 },
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
                <AppText
                  variant="label"
                  style={{ color: colors.onPrimary, fontSize: 12.5 }}
                  numberOfLines={1}
                >
                  {item.label}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>

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
            boxShadow: `0 10px 26px ${rgba(colors.gradient[0], colors.dark ? 0.55 : 0.45)}`,
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
    width: TAB_BAR_HEIGHT,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
