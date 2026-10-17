// Pháo giấy ăn mừng (khi đạt mục tiêu tiết kiệm…): các mảnh bắn lên từ giữa màn rồi rơi xuống và mờ dần.
// Phủ toàn màn, không chặn cảm ứng; tự gọi onDone khi xong. Dùng một giá trị thời gian chung nên nhẹ.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { confettiPieces, type Piece } from './confettiPieces';

const DURATION = 1700;

const PIECES = confettiPieces();

function Particle({ piece, t }: { piece: Piece; t: { get: () => number } }) {
  const style = useAnimatedStyle(() => {
    const p = t.get();
    const time = p * 1.6; // giây quy ước để áp trọng lực
    return {
      opacity: p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3,
      transform: [
        { translateX: piece.vx * time },
        { translateY: piece.vy * time + 520 * time * time },
        { rotate: `${piece.spin * p}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: piece.size,
          height: piece.round ? piece.size : piece.size * 0.55,
          borderRadius: piece.round ? piece.size : 2,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

export function Confetti({ onDone }: { onDone?: () => void }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(
      withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View pointerEvents="none" style={styles.layer}>
      {PIECES.map((piece, i) => (
        <Particle key={i} piece={piece} t={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  piece: { position: 'absolute', top: '45%' },
});
