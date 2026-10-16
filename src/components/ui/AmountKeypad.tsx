import { t } from '@/lib/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from '@/lib/haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  applyKeypadKey,
  calcMoney,
  groupThousands,
  type CalcOp,
  type KeypadKey,
  type Money,
} from '@/lib/money';
import { createStyles, useTheme } from '@/theme';

import { AppText } from './AppText';

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['000', '0', 'backspace'],
];
const OPS: CalcOp[] = ['÷', '×', '-', '+'];

type AmountKeypadProps = {
  value: Money;
  onChange: (value: Money) => void;
};

const warn = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
const tick = () => Haptics.selectionAsync().catch(() => {});

/**
 * Bàn phím số nhập tiền: phím 000, không cho số 0 ở đầu, chặn số quá lớn, giữ ⌫ để xoá hết.
 * Bật "máy tính" để cộng / trừ / nhân / chia nhanh — kết quả cập nhật ngay vào ô tiền, không làm tròn.
 */
export function AmountKeypad({ value, onChange }: AmountKeypadProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [calc, setCalc] = useState(false);
  // Phép tính đang dở: acc op operand (operand = số đang gõ)
  const [pending, setPending] = useState<{ acc: Money; op: CalcOp } | null>(null);
  const [operand, setOperand] = useState<Money>(value);
  const lastEmitted = useRef(value);

  // Giá trị bị đổi từ bên ngoài (chuyển ô nhập, xoá…) → bỏ phép tính đang dở
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setPending(null);
      setOperand(value);
    }
  }, [value]);

  const emit = (next: Money) => {
    lastEmitted.current = next;
    onChange(next);
  };

  const result = (p: { acc: Money; op: CalcOp } | null, b: Money): Money | null =>
    p ? calcMoney(p.acc, p.op, b) : b;

  const press = (key: KeypadKey) => {
    if (key === 'backspace') {
      tick();
      const next = applyKeypadKey(operand, key);
      setOperand(next);
      const r = result(pending, next);
      emit(r ?? next);
      return;
    }
    const next = applyKeypadKey(operand, key);
    if (next === operand) return warn();
    const r = result(pending, next);
    if (r === null) return warn();
    tick();
    setOperand(next);
    emit(r);
  };

  const pressOp = (op: CalcOp) => {
    const current = result(pending, operand);
    if (current === null) return warn();
    tick();
    setPending({ acc: current, op });
    setOperand(0);
    emit(current);
  };

  const equals = () => {
    if (!pending) return;
    const r = result(pending, operand);
    if (r === null) return warn();
    tick();
    setPending(null);
    setOperand(r);
    emit(r);
  };

  const clear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPending(null);
    setOperand(0);
    emit(0);
  };

  const toggle = () => {
    tick();
    if (calc) {
      // Tắt máy tính: chốt kết quả hiện có
      const r = result(pending, operand);
      setPending(null);
      setOperand(r ?? operand);
    }
    setCalc(!calc);
  };

  return (
    <View style={styles.grid}>
      <View style={styles.exprRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(calc ? 'Tắt máy tính' : 'Bật máy tính')}
          onPress={toggle}
          style={[styles.calcToggle, calc && { backgroundColor: colors.primary }]}
        >
          <Ionicons
            name="calculator-outline"
            size={16}
            color={calc ? colors.onPrimary : colors.textMuted}
          />
          <AppText variant="caption" style={{ color: calc ? colors.onPrimary : colors.textMuted }}>
            Máy tính
          </AppText>
        </Pressable>
        {calc && pending ? (
          <>
            <AppText variant="bodyMedium" color="textMuted" style={styles.expr} numberOfLines={1}>
              {groupThousands(pending.acc)} {pending.op === '-' ? '−' : pending.op}
              {operand ? ` ${groupThousands(operand)}` : ''}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Bằng')}
              onPress={equals}
              style={[styles.equals, { backgroundColor: colors.primary }]}
            >
              <AppText variant="bodyMedium" style={{ color: colors.onPrimary }}>
                =
              </AppText>
            </Pressable>
          </>
        ) : null}
      </View>
      {ROWS.map((row, r) => (
        <View key={row.join()} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="keyboardkey"
              accessibilityLabel={t(key === 'backspace' ? 'Xoá' : key)}
              onPress={() => press(key)}
              onLongPress={key === 'backspace' ? clear : undefined}
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
          {calc ? (
            <Pressable
              accessibilityRole="keyboardkey"
              accessibilityLabel={t('Phép {OPS}', { OPS: OPS[r] })}
              onPress={() => pressOp(OPS[r])}
              style={({ pressed }) => [
                styles.key,
                styles.opKey,
                pending?.op === OPS[r] && !operand && { borderColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="title" style={[styles.keyText, { color: colors.primary }]}>
                {OPS[r] === '-' ? '−' : OPS[r]}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  grid: {
    gap: 8,
  },
  exprRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 32,
  },
  calcToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.colors.glassFill,
    borderWidth: 1,
    borderColor: t.colors.glassBorder,
  },
  expr: {
    flex: 1,
    textAlign: 'right',
  },
  equals: {
    minWidth: 52,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    height: 42,
    borderRadius: t.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.glassFill,
    borderWidth: 1,
    borderColor: t.colors.glassBorder,
  },
  opKey: {
    flex: 0.8,
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
