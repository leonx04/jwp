// Định dạng tiền Việt — tự viết thay vì dùng Intl để mọi máy (Hermes, Android cũ, Huawei) ra kết quả y hệt.
import { t } from '@/lib/i18n';

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

// Cách viết quen thuộc của người Việt: '150k', '1,5Tr' viết liền; 'Tỷ' là chữ trọn vẹn nên cách một khoảng
// (không ngắt dòng) → '2,35 Tỷ'.
const COMPACT_UNITS = [
  { value: 1_000_000_000, label: `${NBSP}Tỷ` },
  { value: 1_000_000, label: 'Tr' },
  { value: 1_000, label: 'k' },
] as const;

/** Chữ đơn vị theo ngôn ngữ: Tr → M, Tỷ → B (chữ 'k' giữ nguyên) */
function unitLabel(label: string): string {
  const core = label.trim();
  const translated = t(core);
  return label.startsWith(NBSP) ? `${NBSP}${translated}` : translated;
}

/** 150 (phần trăm của đơn vị) → '1,5' · 235 → '2,35' · 100 → '1' */
function formatHundredths(hundredths: number): string {
  const intPart = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  if (frac === 0) return groupThousands(intPart);
  const fracText = frac.toString().padStart(2, '0').replace(/0$/, '');
  return `${groupThousands(intPart)},${fracText}`;
}

/**
 * Dạng rút gọn cho biểu đồ / chỗ hẹp, KHÔNG BAO GIỜ làm tròn: chỉ rút gọn khi đúng tuyệt đối với ≤ 2 số lẻ,
 * còn lại hiện đủ số (vd 1.487.759 ₫ chứ không phải '1,49Tr').
 * 850 → '850 ₫' · 1000 → '1k' · 1500 → '1,5k' · 150000 → '150k' · 1500000 → '1,5Tr' · 2350000000 → '2,35 Tỷ'
 * 1234 → '1.234 ₫' · 1487759 → '1.487.759 ₫'
 */
export function formatCompact(
  amount: Money,
  { symbol = '₫', sign = 'auto' }: FormatMoneyOptions = {},
): string {
  const abs = Math.round(Math.abs(amount));
  const signed = amount < 0 ? -abs : abs;
  for (const [i, unit] of COMPACT_UNITS.entries()) {
    if (abs < unit.value) continue;
    // k chỉ dùng dưới 1Tr, Tr chỉ dùng dưới 1 Tỷ (tránh "1.005k")
    if (i > 0 && abs >= COMPACT_UNITS[i - 1].value) continue;
    const hundredths = (abs * 100) / unit.value;
    if (Number.isInteger(hundredths)) {
      return applySign(`${formatHundredths(hundredths)}${unitLabel(unit.label)}`, signed, sign);
    }
  }
  return applySign(`${groupThousands(abs)}${NBSP}${symbol}`, signed, sign);
}
