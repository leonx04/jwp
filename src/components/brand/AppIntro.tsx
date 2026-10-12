// Hiệu ứng mở app (~0,6 giây): logo nối tiếp màn chờ native → phóng nhẹ → mờ dần để lộ app.
// Chỉ chạy một lần mỗi lần mở lạnh; app bên dưới vẫn tải song song nên không làm chậm.
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BrandLogo } from './BrandLogo';

// Trùng màu nền màn chờ native (app.json → expo-splash-screen)
const BACKGROUND = { light: '#F4F6FA', dark: '#060A12' } as const;
const LOGO_SIZE = 128;

export function AppIntro({ onShown }: { onShown?: () => void }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [done, setDone] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Đã vẽ khung đầu tiên → có thể ẩn màn chờ native mà không nháy
    onShown?.();
    scale.set(
      withSequence(
        withTiming(1.06, { duration: 260, easing: Easing.out(Easing.cubic) }),
        withTiming(0.9, { duration: 220, easing: Easing.in(Easing.cubic) }),
      ),
    );
    opacity.set(
      withDelay(
        300,
        withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) }, (finished) => {
          if (finished) runOnJS(setDone)(true);
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlay = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const logo = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  if (done) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { backgroundColor: BACKGROUND[scheme] }, overlay]}
    >
      <Animated.View style={logo}>
        <BrandLogo size={LOGO_SIZE} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
