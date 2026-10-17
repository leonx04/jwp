// Tổng kết kỳ (kiểu "Wrapped"): ngày chi nhiều nhất, nơi hay ghé, danh mục số một, tỷ lệ tiết kiệm…
// Hàm thuần trên danh sách giao dịch của kỳ — không đụng DB, test được.
import { diffDays, toVnDate, weekdayOf } from '@/lib/date';
import { normalizeForSearch } from '@/lib/text';

export type WrappedTx = {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  date: number;
  title: string;
  categoryName: string | null;
  isAdjustment: boolean;
  debtId: string | null;
};

export type Wrapped = {
  income: number;
  expense: number;
  saved: number;
  /** (thu − chi) / thu; null khi chưa có thu nhập */
  savingRate: number | null;
  txCount: number;
  topCategories: { name: string; amount: number; share: number }[];
  priciestDay: { date: string; amount: number; count: number } | null;
  favorite: { title: string; count: number; total: number } | null;
  biggest: { title: string; amount: number; date: string } | null;
  busiestWeekday: { weekday: number; amount: number } | null;
  /** Số ngày không chi đồng nào, tính từ đầu kỳ tới min(cuối kỳ, hôm nay) */
  noSpendDays: number;
  verdict: 'great' | 'good' | 'tight' | 'over' | 'none';
};

export function buildWrapped(
  items: readonly WrappedTx[],
  period: { start: string; end: string; today: string },
): Wrapped {
  const real = items.filter((t) => !t.isAdjustment && !t.debtId && t.type !== 'transfer');
  const expenses = real.filter((t) => t.type === 'expense');
  const income = real.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = expenses.reduce((s, t) => s + t.amount, 0);

  const byCategory = new Map<string, number>();
  const byDay = new Map<string, { amount: number; count: number }>();
  const byTitle = new Map<string, { title: string; count: number; total: number }>();
  const byWeekday = new Map<number, number>();
  for (const t of expenses) {
    const cat = t.categoryName ?? 'Chưa phân loại';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + t.amount);
    const day = toVnDate(t.date);
    const d = byDay.get(day) ?? { amount: 0, count: 0 };
    byDay.set(day, { amount: d.amount + t.amount, count: d.count + 1 });
    byWeekday.set(weekdayOf(day), (byWeekday.get(weekdayOf(day)) ?? 0) + t.amount);
    const key = normalizeForSearch(t.title);
    if (key) {
      const e = byTitle.get(key) ?? { title: t.title, count: 0, total: 0 };
      byTitle.set(key, { title: e.title, count: e.count + 1, total: e.total + t.amount });
    }
  }

  const topCategories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount, share: expense > 0 ? amount / expense : 0 }));

  const dayEntry = [...byDay.entries()].sort((a, b) => b[1].amount - a[1].amount)[0];
  const fav = [...byTitle.values()]
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count || b.total - a.total)[0];
  const big = [...expenses].sort((a, b) => b.amount - a.amount)[0];
  const wd = [...byWeekday.entries()].sort((a, b) => b[1] - a[1])[0];

  const last = period.today < period.end ? period.today : period.end;
  const elapsed = Math.max(0, diffDays(period.start, last) + 1);
  const noSpendDays = Math.max(0, elapsed - byDay.size);

  const saved = income - expense;
  const savingRate = income > 0 ? saved / income : null;
  const verdict: Wrapped['verdict'] =
    savingRate === null
      ? 'none'
      : savingRate >= 0.3
        ? 'great'
        : savingRate >= 0.1
          ? 'good'
          : savingRate >= 0
            ? 'tight'
            : 'over';

  return {
    income,
    expense,
    saved,
    savingRate,
    txCount: real.length,
    topCategories,
    priciestDay: dayEntry ? { date: dayEntry[0], ...dayEntry[1] } : null,
    favorite: fav ? { title: fav.title, count: fav.count, total: fav.total } : null,
    biggest: big ? { title: big.title || big.categoryName || '', amount: big.amount, date: toVnDate(big.date) } : null,
    busiestWeekday: wd ? { weekday: wd[0], amount: wd[1] } : null,
    noSpendDays,
    verdict,
  };
}
