// Hiệu ứng mở app (~1 giây): khung đầu GIỐNG HỆT màn chờ native (ô logo + chấm vàng) → chữ J chảy ra từ chấm vàng,
// uốn thành móc, tan thành ba giọt → cả màn mờ dần và phóng nhẹ để lộ app. Chỉ chạy một lần mỗi lần mở lạnh;
// app bên dưới vẫn tải song song nên không làm chậm. Tắt hiệu ứng hệ thống ("giảm chuyển động") thì nhảy thẳng tới cuối.
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Circle, Path } from 'react-native-svg';

import { LogoSvg, LogoTile } from './BrandLogo';
import { LOGO } from './logoGeometry';

// Trùng màu nền màn chờ native (app.json → expo-splash-screen)
const BACKGROUND = { light: '#F4F6FA', dark: '#060A12' } as const;
const LOGO_SIZE = 128;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Drop = (typeof LOGO.drops)[number];

function DropDot({ drop, progress }: { drop: Drop; progress: { get: () => number } }) {
  const props = useAnimatedProps(() => ({
    r: drop.r * progress.get(),
    fillOpacity: drop.opacity * Math.min(1, progress.get() * 1.4),
  }));
  return <AnimatedCircle cx={drop.cx} cy={drop.cy} fill="#FFFFFF" animatedProps={props} />;
}

export function AppIntro({ onShown }: { onShown?: () => void }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [done, setDone] = useState(false);

  const draw = useSharedValue(0); // 0 → 1: chữ J chảy ra
  const pulse = useSharedValue(1); // chấm vàng nảy khi dòng bắt đầu chảy
  const d0 = useSharedValue(0);
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);
  const fade = useSharedValue(1);
  const zoom = useSharedValue(1);

  useEffect(() => {
    // Đã vẽ khung đầu tiên → có thể ẩn màn chờ native mà không nháy
    onShown?.();
    pulse.set(withSequence(withTiming(1.22, { duration: 110 }), withTiming(1, { duration: 150 })));
    draw.set(withDelay(90, withTiming(1, { duration: 470, easing: Easing.inOut(Easing.cubic) })));
    [d0, d1, d2].forEach((value, i) =>
      value.set(
        withDelay(
          450 + i * 85,
          withTiming(1, { duration: 240, easing: Easing.out(Easing.back(2.2)) }),
        ),
      ),
    );
    zoom.set(withDelay(800, withTiming(1.12, { duration: 280, easing: Easing.in(Easing.quad) })));
    fade.set(
      withDelay(
        800,
        withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) }, (finished) => {
          if (finished) runOnJS(setDone)(true);
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlay = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const logo = useAnimatedStyle(() => ({ transform: [{ scale: zoom.get() }] }));
  const jProps = useAnimatedProps(() => ({ strokeDashoffset: LOGO.j.length * (1 - draw.get()) }));
  const headProps = useAnimatedProps(() => ({ r: LOGO.head.r * pulse.get() }));

  if (done) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { backgroundColor: BACKGROUND[scheme] }, overlay]}
    >
      <Animated.View style={logo}>
        <LogoSvg size={LOGO_SIZE}>
          <LogoTile />
          <AnimatedPath
            d={LOGO.j.d}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={LOGO.j.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[LOGO.j.length, LOGO.j.length]}
            animatedProps={jProps}
          />
          <DropDot drop={LOGO.drops[0]} progress={d0} />
          <DropDot drop={LOGO.drops[1]} progress={d1} />
          <DropDot drop={LOGO.drops[2]} progress={d2} />
          <AnimatedCircle
            cx={LOGO.head.cx}
            cy={LOGO.head.cy}
            fill={LOGO.amber}
            animatedProps={headProps}
          />
        </LogoSvg>
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
