// Nhóm "(tabs)": không xuất hiện trong URL, gom các màn dùng chung thanh tab.
// Thanh tab mặc định bị ẩn; thanh tab kính nổi (GlassTabBar) vẽ BÊN NGOÀI vùng nội dung
// để làm mờ được nội dung đang cuộn phía sau nó (BlurTargetView).
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useRef } from 'react';
import { StyleSheet, View, type View as RNView } from 'react-native';

import { BlurTarget } from '@/components/glass/BlurTarget';
import { GlassTabBar, type TabItem } from '@/components/glass/GlassTabBar';

const TABS: TabItem[] = [
  { href: '/', path: '/', label: 'Tổng quan', icon: 'home-outline', iconActive: 'home' },
  {
    href: '/transactions',
    path: '/transactions',
    label: 'Giao dịch',
    icon: 'receipt-outline',
    iconActive: 'receipt',
  },
  {
    href: '/schedule',
    path: '/schedule',
    label: 'Lịch',
    icon: 'calendar-outline',
    iconActive: 'calendar',
  },
  { href: '/more', path: '/more', label: 'Thêm', icon: 'grid-outline', iconActive: 'grid' },
];

export default function TabsLayout() {
  const blurTarget = useRef<RNView>(null);

  return (
    <View style={styles.root}>
      <BlurTarget ref={blurTarget} style={styles.root}>
        <Tabs
          tabBar={() => null}
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            sceneStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="transactions" />
          <Tabs.Screen name="schedule" />
          <Tabs.Screen name="more" />
        </Tabs>
      </BlurTarget>
      <GlassTabBar
        items={TABS}
        blurTarget={blurTarget}
        onAdd={() => router.push('/transaction/new')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
