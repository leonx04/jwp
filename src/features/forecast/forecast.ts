// Dự trù dòng tiền (hàm thuần): số dư hôm nay + các khoản thu/chi theo lịch → số dư từng ngày,
// cảnh báo âm tiền / dưới ngưỡng an toàn, mức chi an toàn mỗi ngày đến kỳ nhận tiền tiếp theo.
import type { Occurrence } from '@/features/schedules/occurrences';
import { addDays, diffDays, type DateString } from '@/lib/date';

export type ForecastEvent = {
  occurrence: Occurrence;
  /** Ngày áp dụng (kỳ quá hạn tính vào hôm nay) */
  date: DateString;
  /** + thu / − chi trên tổng số dư */
  delta: number;
  balanceAfter: number;
};

export type ForecastPoint = { date: DateString; balance: number };

export type WalletWarning = {
  occurrence: Occurrence;
  accountId: string;
  /** Số dư dự kiến của ví sau khoản này */
  balanceAfter: number;
};

export type Forecast = {
  startBalance: number;
  /** Số dư cuối mỗi ngày, từ hôm nay đến hết khoảng */
  points: ForecastPoint[];
  events: ForecastEvent[];
  lowest: ForecastPoint;
  endBalance: number;
  firstNegative: ForecastPoint | null;
  firstBelowSafety: ForecastPoint | null;
  nextIncome: { date: DateString; amount: number } | null;
  /** Mức chi an toàn mỗi ngày đến kỳ thu tiếp theo (hoặc hết khoảng), không âm */
  safeDailySpend: number;
  /** Số ngày tính mức chi an toàn */
  safeDays: number;
  totalIncome: number;
  totalExpense: number;
  walletWarnings: WalletWarning[];
};

type ForecastInput = {
  today: DateString;
  days: number;
  /** Tổng số dư các ví tính vào tổng */
  startBalance: number;
  /** Số dư từng ví (để cảnh báo ví không đủ tiền) */
  accountBalances?: ReadonlyMap<string, number>;
  /** Ví được tính vào tổng (chuyển khoản giữa hai ví này không đổi tổng) */
  includedAccounts?: ReadonlySet<string>;
  occurrences: readonly Occurrence[];
  safetyThreshold?: number;
};

export function computeForecast({
  today,
  days,
  startBalance,
  accountBalances,
  includedAccounts,
  occurrences,
  safetyThreshold = 0,
}: ForecastInput): Forecast {
  const end = addDays(today, days);
  const included = (id: string | null | undefined) =>
    !includedAccounts || (!!id && includedAccounts.has(id));

  // Kỳ còn phải xử lý trong khoảng; kỳ quá hạn coi như phải trả ngay hôm nay
  const pending = occurrences
    .filter(
      (o) =>
        (o.status === 'upcoming' || o.status === 'due' || o.status === 'overdue') && o.date <= end,
    )
    .map((o) => ({ o, date: o.date < today ? today : o.date }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const deltaOf = (o: Occurrence): number => {
    const from = o.schedule.accountId;
    const to = o.schedule.toAccountId;
    if (o.type === 'income') return included(from) ? o.amount : 0;
    if (o.type === 'expense') return included(from) ? -o.amount : 0;
    // Chuyển khoản: chỉ đổi tổng khi chuyển giữa ví tính vào tổng và ví không tính
    return (included(to) ? o.amount : 0) - (included(from) ? o.amount : 0);
  };

  const events: ForecastEvent[] = [];
  let running = startBalance;
  let totalIncome = 0;
  let totalExpense = 0;
  for (const { o, date } of pending) {
    const delta = deltaOf(o);
    running += delta;
    if (o.type === 'income') totalIncome += o.amount;
    if (o.type === 'expense') totalExpense += o.amount;
    events.push({ occurrence: o, date, delta, balanceAfter: running });
  }

  // Số dư cuối mỗi ngày
  const points: ForecastPoint[] = [];
  let balance = startBalance;
  let i = 0;
  for (let d = 0; d <= days; d++) {
    const date = addDays(today, d);
    while (i < events.length && events[i].date === date) balance = events[i++].balanceAfter;
    points.push({ date, balance });
  }

  const lowest = points.reduce((min, p) => (p.balance < min.balance ? p : min), points[0]);
  const firstNegative = points.find((p) => p.balance < 0) ?? null;
  const firstBelowSafety =
    safetyThreshold > 0 ? (points.find((p) => p.balance < safetyThreshold) ?? null) : null;

  // Mức chi an toàn: (số dư − các khoản chi trước kỳ thu tiếp theo − ngưỡng an toàn) ÷ số ngày
  const incomeEvent = events.find((e) => e.occurrence.type === 'income' && e.date > today);
  const horizon = incomeEvent ? incomeEvent.date : end;
  const safeDays = Math.max(1, diffDays(today, horizon));
  const obligations = events
    .filter((e) => e.date < horizon && e.delta < 0)
    .reduce((sum, e) => sum - e.delta, 0);
  const incomeBefore = events
    .filter((e) => e.date < horizon && e.delta > 0)
    .reduce((sum, e) => sum + e.delta, 0);
  const available = startBalance + incomeBefore - obligations - safetyThreshold;
  const safeDailySpend = Math.max(0, Math.floor(available / safeDays));

  // Cảnh báo theo ví: khoản chi trừ vào ví không đủ tiền
  const walletWarnings: WalletWarning[] = [];
  if (accountBalances) {
    const wallet = new Map(accountBalances);
    for (const e of events) {
      const s = e.occurrence.schedule;
      const amount = e.occurrence.amount;
      if (e.occurrence.type === 'income') {
        wallet.set(s.accountId, (wallet.get(s.accountId) ?? 0) + amount);
        continue;
      }
      wallet.set(s.accountId, (wallet.get(s.accountId) ?? 0) - amount);
      if (e.occurrence.type === 'transfer' && s.toAccountId) {
        wallet.set(s.toAccountId, (wallet.get(s.toAccountId) ?? 0) + amount);
      }
      const after = wallet.get(s.accountId) ?? 0;
      if (after < 0)
        walletWarnings.push({
          occurrence: e.occurrence,
          accountId: s.accountId,
          balanceAfter: after,
        });
    }
  }

  return {
    startBalance,
    points,
    events,
    lowest,
    endBalance: points[points.length - 1].balance,
    firstNegative,
    firstBelowSafety,
    nextIncome: incomeEvent
      ? { date: incomeEvent.date, amount: incomeEvent.occurrence.amount }
      : null,
    safeDailySpend,
    safeDays,
    totalIncome,
    totalExpense,
    walletWarnings,
  };
}
