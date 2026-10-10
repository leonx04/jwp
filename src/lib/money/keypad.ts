// Logic bàn phím số nhập tiền (giao diện làm ở Giai đoạn 2). Tách riêng để test được.
import { MAX_AMOUNT, type Money } from './constants';

export type KeypadKey =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'backspace';

/**
 * Áp một phím vào số đang nhập. Không cho số 0 ở đầu, chặn khi vượt MAX_AMOUNT
 * (phím bị bỏ qua, giữ nguyên giá trị cũ).
 */
export function applyKeypadKey(current: Money, key: KeypadKey): Money {
  if (key === 'backspace') return Math.floor(current / 10);
  const next = key === '000' ? current * 1000 : current * 10 + Number(key);
  return next > MAX_AMOUNT ? current : next;
}
