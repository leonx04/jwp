// Kỳ thống kê: tháng (theo "ngày bắt đầu tháng" trong cài đặt) hoặc năm (12 tháng liên tiếp).
// Hàm thuần — test được, không phụ thuộc giờ máy (truyền `today` vào).
import {
  addDays,
  diffDays,
  makeDate,
  parseDate,
  periodContaining,
  shiftPeriod,
  vnDateToMs,
  type DateString,
  type Period,
} from '@/lib/date';

export type StatsMode = 'month' | 'year';

/** Năm của kỳ: tháng bắt đầu từ ngày 10 → kỳ 10/12/2025 – 09/01/2026 thuộc năm 2025 */
export function statsYearOf(date: DateString, startDay = 1): number {
  return parseDate(periodContaining(date, startDay).start).year;
}

/** 12 tháng của năm `year`: từ kỳ bắt đầu trong tháng 1 đến hết kỳ bắt đầu trong tháng 12 */
export function yearPeriod(year: number, startDay = 1): Period {
  const first = periodContaining(makeDate(year, 1, Math.min(startDay, 31)), startDay);
  return { start: first.start, end: shiftPeriod(first, 11, startDay).end };
}

/** Kỳ đang xem: `offset` = 0 là kỳ hiện tại, −1 là kỳ trước… */
export function statsPeriod(
  mode: StatsMode,
  offset: number,
  today: DateString,
  startDay = 1,
): Period {
  if (mode === 'year') return yearPeriod(statsYearOf(today, startDay) + offset, startDay);
  return shiftPeriod(periodContaining(today, startDay), offset, startDay);
}

export function previousPeriod(mode: StatsMode, period: Period, startDay = 1): Period {
  if (mode === 'year') return yearPeriod(statsYearOf(period.start, startDay) - 1, startDay);
  return shiftPeriod(period, -1, startDay);
}

/** `count` tháng liên tiếp, tháng cuối là kỳ chứa `period.start` */
export function monthsEnding(period: Period, count: number, startDay = 1): Period[] {
  const base = periodContaining(period.start, startDay);
  return Array.from({ length: count }, (_, i) => shiftPeriod(base, i - count + 1, startDay));
}

/** 12 tháng của một kỳ năm */
export function monthsOfYear(year: Period, startDay = 1): Period[] {
  const first = periodContaining(year.start, startDay);
  return Array.from({ length: 12 }, (_, i) => shiftPeriod(first, i, startDay));
}

export function periodLength(period: Period): number {
  return diffDays(period.start, period.end) + 1;
}

/** Số ngày đã trôi qua của kỳ tính đến hết `today` (0 nếu kỳ chưa bắt đầu) */
export function elapsedDays(period: Period, today: DateString): number {
  if (today < period.start) return 0;
  if (today > period.end) return periodLength(period);
  return diffDays(period.start, today) + 1;
}

export function isInProgress(period: Period, today: DateString): boolean {
  return today >= period.start && today <= period.end;
}

/**
 * Đoạn đầu của kỳ trước dài bằng phần đã qua của kỳ này → so sánh "cùng kỳ" công bằng
 * (vd ngày 11/10 thì so 1–11/10 với 1–11/9, không so với cả tháng 9).
 */
export function comparablePeriod(previous: Period, elapsed: number): Period {
  const length = periodLength(previous);
  if (elapsed >= length) return previous;
  return { start: previous.start, end: addDays(previous.start, Math.max(0, elapsed - 1)) };
}

/** Kỳ → khoảng thời điểm [from, to) (ms) để truy vấn */
export function periodRange(period: Period): { from: number; to: number } {
  return { from: vnDateToMs(period.start), to: vnDateToMs(addDays(period.end, 1)) };
}

/** Tên kỳ: 'Tháng 10/2026' · 'Năm 2026' (đặt theo tháng / năm bắt đầu kỳ) */
export function periodTitle(mode: StatsMode, period: Period): string {
  const { year, month } = parseDate(period.start);
  return mode === 'year' ? `Năm ${year}` : `Tháng ${month}/${year}`;
}

/** Nhãn ngắn trên cột: 'T10' */
export function monthShortLabel(period: Period): string {
  return `T${parseDate(period.start).month}`;
}

/** '01/10 – 31/10' hoặc '10/12/2025 – 09/12/2026' (thêm năm nếu kỳ dài / khác năm) */
export function periodRangeLabel(period: Period): string {
  const s = parseDate(period.start);
  const e = parseDate(period.end);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const withYear = s.year !== e.year || periodLength(period) > 62;
  const fmt = (d: { year: number; month: number; day: number }) =>
    withYear ? `${pad(d.day)}/${pad(d.month)}/${d.year}` : `${pad(d.day)}/${pad(d.month)}`;
  return `${fmt(s)} – ${fmt(e)}`;
}
