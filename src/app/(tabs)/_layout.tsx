// Nhóm "(tabs)": không xuất hiện trong URL, chỉ gom các màn dùng chung thanh tab dưới đáy.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={24} color={color} />;
  };
}

/** Nút ＋ tròn ở giữa thanh tab: mở màn thêm giao dịch thay vì chuyển tab */
function AddButton() {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Thêm giao dịch"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        router.push('/transaction/new');
      }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {({ pressed }) => (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            transform: [{ scale: pressed ? 0.92 : 1 }],
            shadowColor: colors.primary,
            shadowOpacity: 0.35,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <Ionicons name="add" size={30} color={colors.onPrimary} />
        </View>
      )}
    </Pressable>
  );
}

export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  // Android vẽ tràn viền (edge-to-edge): phải chừa chỗ cho thanh điều hướng cử chỉ phía dưới
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64 + bottom,
          paddingBottom: bottom,
        },
        tabBarItemStyle: { paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Tổng quan', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="transactions"
        options={{ title: 'Giao dịch', tabBarIcon: tabIcon('receipt', 'receipt-outline') }}
      />
      <Tabs.Screen name="add" options={{ title: 'Thêm', tabBarButton: () => <AddButton /> }} />
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Lịch', tabBarIcon: tabIcon('calendar', 'calendar-outline') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'Thêm', tabBarIcon: tabIcon('grid', 'grid-outline') }}
      />
    </Tabs>
  );
}
