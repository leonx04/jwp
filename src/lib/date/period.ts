// Kỳ thống kê theo "ngày bắt đầu tháng" (vd tháng tính từ ngày 10 — ngày nhận lương).
import { addDays, addMonths, daysInMonth, makeDate, parseDate, type DateString } from './vn';

export type Period = {
  /** Ngày đầu kỳ (gồm) */
  start: DateString;
  /** Ngày cuối kỳ (gồm) */
  end: DateString;
};

/** Ngày bắt đầu thực tế trong một tháng: ngày 31 ở tháng 2 → ngày cuối tháng 2 */
function anchor(year: number, month: number, startDay: number): DateString {
  return makeDate(year, month, Math.min(startDay, daysInMonth(year, month)));
}

/** Kỳ chứa ngày `date`, với tháng bắt đầu từ ngày `startDay` (1–31) */
export function periodContaining(date: DateString, startDay = 1): Period {
  const { year, month } = parseDate(date);
  const thisStart = anchor(year, month, startDay);
  const start =
    date >= thisStart
      ? thisStart
      : (() => {
          const prev = addMonths(makeDate(year, month, 1), -1);
          const p = parseDate(prev);
          return anchor(p.year, p.month, startDay);
        })();
  const nextMonth = parseDate(
    addMonths(makeDate(parseDate(start).year, parseDate(start).month, 1), 1),
  );
  const end = addDays(anchor(nextMonth.year, nextMonth.month, startDay), -1);
  return { start, end };
}

/** Kỳ dịch đi `offset` kỳ (−1 = kỳ trước) */
export function shiftPeriod(period: Period, offset: number, startDay = 1): Period {
  const { year, month } = parseDate(period.start);
  const shifted = parseDate(addMonths(makeDate(year, month, 1), offset));
  return periodContaining(anchor(shifted.year, shifted.month, startDay), startDay);
}
