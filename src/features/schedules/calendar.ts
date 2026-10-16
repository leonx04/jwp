// Lịch tháng: lưới 6×7 (tuần bắt đầu thứ Hai, gồm cả ngày tháng trước/sau) + số liệu từng ngày.
// Hàm thuần / nhận db làm tham số → test được trên Node.
import { sql } from 'drizzle-orm';

import { transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { isCreditBill } from '@/features/credit/bills';
import {
  addDays,
  addMonths,
  lunarLabel,
  parseDate,
  startOfMonth,
  startOfWeek,
  toLunar,
  VN_OFFSET_MS,
  vnDateToMs,
  weekdayOf,
  type DateString,
} from '@/lib/date';

import type { Occurrence } from './occurrences';
import { loadPlanned } from './planned';

export const GRID_WEEKS = 6;
export const GRID_DAYS = GRID_WEEKS * 7;

export type MonthGrid = {
  /** Ngày 1 của tháng đang xem */
  month: DateString;
  /** Ô đầu tiên (thứ Hai) và ô cuối cùng (Chủ nhật) của lưới */
  start: DateString;
  end: DateString;
  days: DateString[];
};

/** Lưới 6 tuần chứa tháng của `date`, bắt đầu từ thứ Hai */
export function monthGrid(date: DateString): MonthGrid {
  const month = startOfMonth(date);
  const start = startOfWeek(month);
  const days = Array.from({ length: GRID_DAYS }, (_, i) => addDays(start, i));
  return { month, start, end: days[GRID_DAYS - 1], days };
}

/** Ngày 1 của tháng cách `month` `offset` tháng */
export const shiftMonth = (month: DateString, offset: number): DateString =>
  addMonths(startOfMonth(month), offset);

/** '2026-10-01' → 'Tháng 10, 2026' */
export function formatMonthTitle(month: DateString): string {
  const { year, month: m } = parseDate(month);
  return `Tháng ${m}, ${year}`;
}

export type DayTotals = { income: number; expense: number; count: number };

/**
 * Tổng thu / chi thực tế theo từng ngày (giờ VN) trong [from, to] — MỘT truy vấn gom nhóm.
 * Cùng quy tắc với getPeriodSummary: bỏ điều chỉnh số dư và sổ nợ; chuyển khoản chỉ tính khi bật
 * "tính chuyển khoản là thu/chi" (khi đó vừa là chi của ví nguồn vừa là thu của ví nhận).
 */
export function getDailyTotals(
  db: AppDatabase,
  {
    from,
    to,
    transfersAsIncomeExpense = false,
  }: { from: DateString; to: DateString; transfersAsIncomeExpense?: boolean },
): Map<DateString, DayTotals> {
  const transfers = transfersAsIncomeExpense ? 1 : 0;
  const rows = db.all<{ day: string; income: number; expense: number; count: number }>(sql`
    select
      date((t.date + ${VN_OFFSET_MS}) / 1000, 'unixepoch') as day,
      coalesce(sum(case
        when t.type = 'income' then t.amount
        when t.type = 'transfer' and ${transfers} = 1 then coalesce(t.to_amount, t.amount)
        else 0 end), 0) as income,
      coalesce(sum(case
        when t.type = 'expense' then t.amount
        when t.type = 'transfer' and ${transfers} = 1 then t.amount
        else 0 end), 0) as expense,
      count(*) as count
    from ${transactions} t
    where t.date >= ${vnDateToMs(from)} and t.date < ${vnDateToMs(addDays(to, 1))}
      and t.is_adjustment = 0 and t.debt_id is null
    group by day
  `);
  return new Map(
    rows.map((r) => [r.day, { income: r.income, expense: r.expense, count: r.count }]),
  );
}

/** Chấm khoản dự kiến: chưa xử lý (đậm) / đã trả (mờ) */
export type PlannedMark = 'none' | 'pending' | 'done';

export type CalendarDay = {
  date: DateString;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSunday: boolean;
  /** Nhãn âm lịch gọn: '1/9' (mùng 1) hoặc '15' */
  lunar: string;
  lunarFirst: boolean;
  /** Thu / chi thực tế (null nếu không có giao dịch) */
  totals: DayTotals | null;
  /** Các kỳ dự kiến của ngày (gồm kỳ đã trả / bỏ qua) */
  planned: Occurrence[];
  income: PlannedMark;
  expense: PlannedMark;
  /** Chuyển khoản theo lịch (không gồm bill ví trả sau) */
  transfer: PlannedMark;
  /** Có kỳ quá hạn chưa xử lý */
  overdue: boolean;
  /** Hạn trả bill ví trả sau (chưa trả) */
  billDue: boolean;
  /** Ngày có khoản thu theo lịch (lương...) */
  payday: boolean;
};

const stronger = (a: PlannedMark, b: PlannedMark): PlannedMark =>
  a === 'pending' || b === 'pending' ? 'pending' : a === 'done' || b === 'done' ? 'done' : 'none';

/** Gom số liệu vào từng ô của lưới */
export function buildCalendarDays({
  grid,
  today,
  totals,
  occurrences,
}: {
  grid: MonthGrid;
  today: DateString;
  totals: ReadonlyMap<DateString, DayTotals>;
  occurrences: readonly Occurrence[];
}): CalendarDay[] {
  const byDate = new Map<DateString, Occurrence[]>();
  for (const o of occurrences) {
    if (o.date < grid.start || o.date > grid.end) continue;
    const list = byDate.get(o.date);
    if (list) list.push(o);
    else byDate.set(o.date, [o]);
  }
  const { month } = parseDate(grid.month);

  return grid.days.map((date) => {
    const planned = byDate.get(date) ?? [];
    let income: PlannedMark = 'none';
    let expense: PlannedMark = 'none';
    let transfer: PlannedMark = 'none';
    let overdue = false;
    let billDue = false;
    for (const o of planned) {
      if (o.status === 'skipped') continue;
      const mark: PlannedMark = o.status === 'paid' ? 'done' : 'pending';
      if (o.status === 'overdue') overdue = true;
      if (isCreditBill(o.scheduleId)) {
        if (mark === 'pending') billDue = true;
      } else if (o.type === 'income') income = stronger(income, mark);
      else if (o.type === 'expense') expense = stronger(expense, mark);
      else transfer = stronger(transfer, mark);
    }
    const parts = parseDate(date);
    return {
      date,
      day: parts.day,
      inMonth: parts.month === month,
      isToday: date === today,
      isSunday: weekdayOf(date) === 7,
      lunar: lunarLabel(date),
      lunarFirst: toLunar(date).day === 1,
      totals: totals.get(date) ?? null,
      planned,
      income,
      expense,
      transfer,
      overdue,
      billDue,
      payday: income !== 'none',
    };
  });
}

export type MonthSummary = {
  /** Thực tế trong tháng */
  income: number;
  expense: number;
  /** Dự kiến còn phải xử lý trong tháng (gồm quá hạn) */
  plannedIncome: number;
  plannedExpense: number;
};

/** Tổng của các ngày thuộc tháng đang xem */
export function summarizeMonth(days: readonly CalendarDay[]): MonthSummary {
  const summary: MonthSummary = { income: 0, expense: 0, plannedIncome: 0, plannedExpense: 0 };
  for (const d of days) {
    if (!d.inMonth) continue;
    summary.income += d.totals?.income ?? 0;
    summary.expense += d.totals?.expense ?? 0;
    for (const o of d.planned) {
      if (o.status === 'paid' || o.status === 'skipped') continue;
      if (o.type === 'income') summary.plannedIncome += o.amount;
      else if (o.type === 'expense') summary.plannedExpense += o.amount;
    }
  }
  return summary;
}

export type CalendarMonthData = {
  grid: MonthGrid;
  today: DateString;
  days: CalendarDay[];
  summary: MonthSummary;
};

/** Toàn bộ số liệu của một tháng trên lịch (giao dịch thực tế + kỳ dự kiến + bill) */
export function loadCalendarMonth(
  db: AppDatabase,
  month: DateString,
  {
    today,
    transfersAsIncomeExpense = false,
  }: { today: DateString; transfersAsIncomeExpense?: boolean },
): CalendarMonthData {
  const grid = monthGrid(month);
  const totals = getDailyTotals(db, { from: grid.start, to: grid.end, transfersAsIncomeExpense });
  const { occurrences } = loadPlanned(db, {
    from: grid.start,
    to: grid.end,
    today,
    includeResolved: true,
  });
  const days = buildCalendarDays({ grid, today, totals, occurrences });
  return { grid, today, days, summary: summarizeMonth(days) };
}
