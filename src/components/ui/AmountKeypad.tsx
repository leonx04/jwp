import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { applyKeypadKey, type KeypadKey, type Money } from '@/lib/money';
import { createStyles, useTheme } from '@/theme';

import { AppText } from './AppText';

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['000', '0', 'backspace'],
];

type AmountKeypadProps = {
  value: Money;
  onChange: (value: Money) => void;
};

/** Bàn phím số nhập tiền: phím 000, không cho số 0 ở đầu, chặn số quá lớn, giữ ⌫ để xoá hết */
export function AmountKeypad({ value, onChange }: AmountKeypadProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const press = (key: KeypadKey) => {
    const next = applyKeypadKey(value, key);
    if (next === value && key !== 'backspace') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  return (
    <View style={styles.grid}>
      {ROWS.map((row) => (
        <View key={row.join()} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="keyboardkey"
              accessibilityLabel={key === 'backspace' ? 'Xoá' : key}
              onPress={() => press(key)}
              onLongPress={
                key === 'backspace'
                  ? () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      onChange(0);
                    }
                  : undefined
              }
              style={({ pressed }) => [styles.key, pressed && styles.pressed]}
            >
              {key === 'backspace' ? (
                <Ionicons name="backspace-outline" size={24} color={colors.text} />
              ) : (
                <AppText variant="title" style={styles.keyText}>
                  {key}
                </AppText>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    height: 52,
    borderRadius: t.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.glassFill,
    borderWidth: 1,
    borderColor: t.colors.glassBorder,
  },
  pressed: {
    backgroundColor: t.colors.glassActive,
    transform: [{ scale: 0.96 }],
  },
  keyText: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: t.fonts.medium,
  },
}));
