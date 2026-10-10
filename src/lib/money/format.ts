// Định dạng tiền Việt — tự viết thay vì dùng Intl để mọi máy (Hermes, Android cũ, Huawei) ra kết quả y hệt.
import { MINUS, NBSP, type CurrencySymbol, type Money, type MoneyFlow } from './constants';

type SignMode = 'auto' | 'always' | 'never';

export type FormatMoneyOptions = {
  symbol?: CurrencySymbol;
  /** auto: chỉ hiện "−" khi âm · always: thêm "+" khi dương · never: không dấu */
  sign?: SignMode;
};

/** 1500000 → '1.500.000' (chỉ phần số, dùng cho ô nhập tiền) */
export function groupThousands(value: number): string {
  return Math.trunc(Math.abs(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function applySign(body: string, value: number, sign: SignMode): string {
  if (sign === 'never' || value === 0) return body;
  if (value < 0) return MINUS + body;
  return sign === 'always' ? `+${body}` : body;
}

/** 1500000 → '1.500.000 ₫' · -50000 → '−50.000 ₫' */
export function formatMoney(
  amount: Money,
  { symbol = '₫', sign = 'auto' }: FormatMoneyOptions = {},
): string {
  const value = Math.round(amount);
  return applySign(`${groupThousands(value)}${NBSP}${symbol}`, value, sign);
}

/**
 * Hiển thị số tiền theo loại giao dịch (số tiền lưu luôn dương):
 * chi → '−50.000 ₫' · thu → '+50.000 ₫' · chuyển → '50.000 ₫'
 */
export function formatFlow(
  amount: Money,
  flow: MoneyFlow,
  { symbol = '₫' }: Pick<FormatMoneyOptions, 'symbol'> = {},
): string {
  const abs = Math.abs(amount);
  if (flow === 'expense') return formatMoney(-abs, { symbol });
  if (flow === 'income') return formatMoney(abs, { symbol, sign: 'always' });
  return formatMoney(abs, { symbol });
}

const COMPACT_UNITS = [
  { value: 1_000_000_000, label: 'Tỷ' },
  { value: 1_000_000, label: 'Tr' },
  { value: 1_000, label: 'N' },
] as const;

/** 150 (phần trăm của đơn vị) → '1,5' · 235 → '2,35' · 100 → '1' */
function formatHundredths(hundredths: number): string {
  const intPart = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  if (frac === 0) return groupThousands(intPart);
  const fracText = frac.toString().padStart(2, '0').replace(/0$/, '');
  return `${groupThousands(intPart)},${fracText}`;
}

/**
 * Dạng rút gọn cho biểu đồ / chỗ hẹp:
 * 850 → '850 ₫' · 150000 → '150 N' · 1500000 → '1,5 Tr' · 2350000000 → '2,35 Tỷ'
 */
export function formatCompact(
  amount: Money,
  { symbol = '₫', sign = 'auto' }: FormatMoneyOptions = {},
): string {
  const abs = Math.round(Math.abs(amount));
  const signed = amount < 0 ? -abs : abs;
  if (abs < 1_000) return applySign(`${abs}${NBSP}${symbol}`, signed, sign);

  let index = COMPACT_UNITS.findIndex((unit) => abs >= unit.value);
  let hundredths = Math.round((abs * 100) / COMPACT_UNITS[index].value);
  // Làm tròn có thể đẩy lên 1.000 của đơn vị hiện tại (999.999 → "1.000 N") → chuyển lên đơn vị lớn hơn ("1 Tr")
  if (hundredths >= 100_000 && index > 0) {
    index -= 1;
    hundredths = Math.round((abs * 100) / COMPACT_UNITS[index].value);
  }
  return applySign(
    `${formatHundredths(hundredths)}${NBSP}${COMPACT_UNITS[index].label}`,
    signed,
    sign,
  );
}
