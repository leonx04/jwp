import { useMemo } from 'react';

import { formatCompact, formatFlow, formatMoney, type Money, type MoneyFlow } from '@/lib/money';

import { useSettings } from '../store';

/** Các hàm định dạng tiền đã gắn sẵn ký hiệu người dùng chọn (₫ / đ / VND). */
export function useMoneyFormat() {
  const symbol = useSettings((s) => s.currencySymbol);
  return useMemo(
    () => ({
      symbol,
      money: (amount: Money) => formatMoney(amount, { symbol }),
      compact: (amount: Money) => formatCompact(amount, { symbol }),
      flow: (amount: Money, flow: MoneyFlow) => formatFlow(amount, flow, { symbol }),
    }),
    [symbol],
  );
}
