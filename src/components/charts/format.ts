// Định dạng số trên trục biểu đồ: dùng dạng rút gọn chung của app, bỏ ký hiệu tiền cho gọn.
import { useMemo } from 'react';

// Import thẳng hook (không qua index của feature) để tránh vòng lặp import components ↔ features
import { useMoneyFormat } from '@/features/settings/hooks/useMoneyFormat';
import { CURRENCY_SYMBOLS } from '@/lib/money';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TRAILING_SYMBOL = new RegExp(`\\s*(?:${CURRENCY_SYMBOLS.map(escape).join('|')})$`, 'u');

/** '1,5 Tr' giữ nguyên · '850 ₫' → '850' */
export function stripCurrency(text: string): string {
  return text.replace(TRAILING_SYMBOL, '');
}

/** Hàm định dạng cho nhãn trục / chú thích biểu đồ (rút gọn, không ký hiệu tiền) */
export function useAxisMoney(): (value: number) => string {
  const { compact } = useMoneyFormat();
  return useMemo(() => (value: number) => stripCurrency(compact(value)), [compact]);
}
