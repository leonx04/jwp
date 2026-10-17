// Hiện dần từ dưới lên, lần lượt theo thứ tự (index) — các khối của một màn lần lượt "trồi" lên thay vì bật ra cùng lúc.
// Chỉ chạy khi khối mới xuất hiện; bật "giảm chuyển động" của hệ thống thì hiện luôn (Reanimated tự xử lý).
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { revealDelay } from './timing';

type RevealProps = {
  /** Thứ tự khối trong màn; mỗi bậc trễ thêm ~60ms (tối đa 8 bậc để không phải chờ lâu) */
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Reveal({ index = 0, children, style }: RevealProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(revealDelay(index)).springify().damping(20).stiffness(150)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
