import { useMemo } from 'react';

import { formatCompact, formatFlow, formatMoney, type Money, type MoneyFlow } from '@/lib/money';

import { useSettings } from '../store';

/** Các hàm định dạng tiền đã gắn sẵn ký hiệu người dùng chọn (₫ / đ / VND). */
export function useMoneyFormat() {
  const symbol = useSettings((s) => s.currencySymbol);
  return useMemo(
    () => ({
      symbol,
      /** '1.500.000 ₫' */
      money: (amount: Money) => formatMoney(amount, { symbol }),
      /** Rút gọn: '850 ₫' · '150k' · '1,5Tr' · '2,35 Tỷ' (chỉ dưới 1.000 mới kèm ký hiệu) */
      compact: (amount: Money) => formatCompact(amount, { symbol }),
      flow: (amount: Money, flow: MoneyFlow) => formatFlow(amount, flow, { symbol }),
    }),
    [symbol],
  );
}
