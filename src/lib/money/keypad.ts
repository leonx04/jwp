// Logic bàn phím số nhập tiền (giao diện làm ở Giai đoạn 2). Tách riêng để test được.
import { MAX_AMOUNT, type Money } from './constants';

export type KeypadKey =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'backspace';

/**
 * Áp một phím vào số đang nhập. Không cho số 0 ở đầu, chặn khi vượt MAX_AMOUNT
 * (phím bị bỏ qua, giữ nguyên giá trị cũ).
 */
export function applyKeypadKey(raw: Money, key: KeypadKey): Money {
  const current = Number.isFinite(raw) ? raw : 0; // giá trị hỏng (NaN) coi như 0 để gõ lại được
  if (key === 'backspace') return Math.floor(current / 10);
  const next = key === '000' ? current * 1000 : current * 10 + Number(key);
  return next > MAX_AMOUNT ? current : next;
}

export type CalcOp = '+' | '-' | '×' | '÷';

/**
 * Máy tính bấm nhanh: a op b. Trả null nếu kết quả không hợp lệ làm số tiền —
 * âm, vượt MAX_AMOUNT, chia cho 0, hoặc chia không hết (KHÔNG làm tròn).
 */
export function calcMoney(a: Money, op: CalcOp, b: Money): Money | null {
  let result: number;
  switch (op) {
    case '+':
      result = a + b;
      break;
    case '-':
      result = a - b;
      break;
    case '×':
      result = a * b;
      break;
    case '÷':
      if (b === 0 || a % b !== 0) return null;
      result = a / b;
      break;
  }
  return Number.isSafeInteger(result) && result >= 0 && result <= MAX_AMOUNT ? result : null;
}
