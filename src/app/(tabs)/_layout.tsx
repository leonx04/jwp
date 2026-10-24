// Nhóm "(tabs)": không xuất hiện trong URL, gom các màn dùng chung thanh tab.
// Thanh tab mặc định bị ẩn; thanh tab kính nổi (GlassTabBar) vẽ BÊN NGOÀI vùng nội dung
// để làm mờ được nội dung đang cuộn phía sau nó (BlurTargetView).
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useRef } from 'react';
import { StyleSheet, View, type View as RNView } from 'react-native';

import { BlurTarget } from '@/components/glass/BlurTarget';
import { GlassTabBar, type TabItem } from '@/components/glass/GlassTabBar';

// Hôm nay · Sổ · ＋ (giữa dock) · Kế hoạch · Phân tích. Cài đặt mở từ nút bánh răng ở Hôm nay.
const TABS: TabItem[] = [
  { href: '/', path: '/', label: 'Hôm nay', icon: 'sunny-outline', iconActive: 'sunny' },
  {
    href: '/transactions',
    path: '/transactions',
    label: 'Sổ',
    icon: 'receipt-outline',
    iconActive: 'receipt',
  },
  {
    href: '/plan',
    path: '/plan',
    label: 'Kế hoạch',
    icon: 'calendar-outline',
    iconActive: 'calendar',
  },
  {
    href: '/insights',
    path: '/insights',
    label: 'Phân tích',
    icon: 'pie-chart-outline',
    iconActive: 'pie-chart',
  },
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
          <Tabs.Screen name="plan" />
          <Tabs.Screen name="insights" />
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
