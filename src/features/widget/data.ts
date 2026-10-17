// Dữ liệu cho widget màn hình chính: "Hôm nay được tiêu" + các ngân sách sát hạn mức nhất.
// Chạy được cả khi app đang đóng (tác vụ nền của widget) nên không dùng hook / React.
import type { AppDatabase } from '@/db/types';
import { totalBalance } from '@/features/accounts/queries';
import { listBudgets } from '@/features/budgets/queries';
import { computeForecast } from '@/features/forecast/forecast';
import { loadPlanned } from '@/features/schedules/planned';
import { getSettings } from '@/features/settings/store';
import { computeToday, incomeLabel } from '@/features/today/compute';
import { getDaySpending } from '@/features/today/queries';
import { addDays, todayVn } from '@/lib/date';
import { formatCompact, formatMoney } from '@/lib/money';

export type WidgetToday = {
  /** Còn được tiêu hôm nay (đã định dạng) */
  leftText: string;
  /** Bản rút gọn cho widget nhỏ: '245k', '1,5Tr' */
  leftCompact: string;
  /** Vượt hạn mức hôm nay (đã định dạng), '' nếu chưa vượt */
  overText: string;
  overCompact: string;
  spentText: string;
  /** 0–1: đã dùng bao nhiêu hạn mức hôm nay */
  progress: number;
  state: 'ok' | 'low' | 'over';
  /** "Còn 9 ngày tới lương" */
  incomeText: string;
};

export type WidgetBudget = {
  name: string;
  remainingText: string;
  /** 0–1 */
  ratio: number;
  state: 'ok' | 'warning' | 'over';
};

export type WidgetData = { today: WidgetToday | null; budgets: WidgetBudget[] };

const FORECAST_DAYS = 30;

export function loadWidgetData(db: AppDatabase, now: number = Date.now()): WidgetData {
  const settings = getSettings();
  const symbol = settings.currencySymbol;
  const today = todayVn(now);

  // ── Hôm nay được tiêu ─────────────────────────────────────────────────────
  let todayData: WidgetToday | null = null;
  try {
    const { balances, occurrences } = loadPlanned(db, {
      from: today,
      to: addDays(today, FORECAST_DAYS),
      today,
    });
    const forecast = computeForecast({
      today,
      days: FORECAST_DAYS,
      startBalance: totalBalance(balances),
      accountBalances: new Map(balances.map((b) => [b.id, b.balance])),
      includedAccounts: new Set(balances.filter((b) => b.includeInBalance).map((b) => b.id)),
      occurrences,
      safetyThreshold: settings.safetyThreshold,
    });
    const status = computeToday({
      today,
      forecast,
      spending: getDaySpending(db, today),
      safetyThreshold: settings.safetyThreshold,
    });
    todayData = {
      leftText: formatMoney(status.left, { symbol }),
      leftCompact: formatCompact(status.left, { symbol }),
      overText: status.over > 0 ? formatMoney(status.over, { symbol }) : '',
      overCompact: status.over > 0 ? formatCompact(status.over, { symbol }) : '',
      spentText: formatCompact(status.spent, { symbol }),
      progress: status.progress,
      // Hết sạch hoặc còn dưới 20% hạn mức hôm nay → cam; vượt → đỏ
      state: status.over > 0 ? 'over' : status.left <= 0 || status.left / status.budget < 0.2 ? 'low' : 'ok',
      incomeText: status.nextIncome ? incomeLabel(status.nextIncome) : '',
    };
  } catch {
    todayData = null;
  }

  // ── Ngân sách sát hạn mức nhất ────────────────────────────────────────────
  let budgets: WidgetBudget[] = [];
  try {
    budgets = listBudgets(db, { today, startDayOfMonth: settings.startDayOfMonth })
      .map((b) => ({
        name: b.name,
        remainingText:
          b.remaining >= 0
            ? formatCompact(b.remaining, { symbol })
            : `−${formatCompact(-b.remaining, { symbol })}`,
        ratio: b.amount > 0 ? Math.min(1, b.spent / b.amount) : b.spent > 0 ? 1 : 0,
        state: b.state,
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 4);
  } catch {
    budgets = [];
  }

  return { today: todayData, budgets };
}
