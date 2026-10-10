// Ngày giờ theo giờ Việt Nam (UTC+7, không có giờ mùa hè) — độc lập với múi giờ cài trên máy.
// Hai dạng dữ liệu:
// - Thời điểm (instant): số mili giây UTC, vd thời gian giao dịch.
// - Ngày lịch (DateString): 'YYYY-MM-DD' theo giờ VN, vd ngày đến hạn của một kỳ.

export type DateString = string;

export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number, width = 2) => n.toString().padStart(width, '0');

/** Date "giả UTC" mang giờ VN: dùng getUTC* để đọc ngày/giờ VN */
function vnParts(ms: number) {
  const d = new Date(ms + VN_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: ((d.getUTCDay() + 6) % 7) + 1, // 1 = thứ Hai … 7 = Chủ nhật
  };
}

export function makeDate(year: number, month: number, day: number): DateString {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function parseDate(date: DateString): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

/** Thời điểm → ngày lịch VN */
export function toVnDate(ms: number): DateString {
  const { year, month, day } = vnParts(ms);
  return makeDate(year, month, day);
}

/** Thời điểm → 'HH:mm' giờ VN */
export function toVnTime(ms: number): string {
  const { hour, minute } = vnParts(ms);
  return `${pad(hour)}:${pad(minute)}`;
}

/** Ngày lịch VN + giờ 'HH:mm' → thời điểm (ms UTC) */
export function vnDateToMs(date: DateString, time = '00:00'): number {
  const { year, month, day } = parseDate(date);
  const [hour, minute] = time.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour || 0, minute || 0) - VN_OFFSET_MS;
}

export function todayVn(now: number = Date.now()): DateString {
  return toVnDate(now);
}

function dateToUtcMs(date: DateString): number {
  const { year, month, day } = parseDate(date);
  return Date.UTC(year, month - 1, day);
}

function utcMsToDate(ms: number): DateString {
  const d = new Date(ms);
  return makeDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: DateString, days: number): DateString {
  return utcMsToDate(dateToUtcMs(date) + days * DAY_MS);
}

/** Số ngày từ a đến b (b − a) */
export function diffDays(a: DateString, b: DateString): number {
  return Math.round((dateToUtcMs(b) - dateToUtcMs(a)) / DAY_MS);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Cộng tháng, giữ ngày trong tháng; tháng không đủ ngày → ngày cuối tháng (31/01 + 1 → 28 hoặc 29/02) */
export function addMonths(date: DateString, months: number): DateString {
  const { year, month, day } = parseDate(date);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return makeDate(y, m, Math.min(day, daysInMonth(y, m)));
}

/** 1 = thứ Hai … 7 = Chủ nhật */
export function weekdayOf(date: DateString): number {
  const d = new Date(dateToUtcMs(date));
  return ((d.getUTCDay() + 6) % 7) + 1;
}

export function startOfWeek(date: DateString): DateString {
  return addDays(date, 1 - weekdayOf(date));
}

export function startOfMonth(date: DateString): DateString {
  const { year, month } = parseDate(date);
  return makeDate(year, month, 1);
}

export function endOfMonth(date: DateString): DateString {
  const { year, month } = parseDate(date);
  return makeDate(year, month, daysInMonth(year, month));
}

export function compareDates(a: DateString, b: DateString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export const minDate = (a: DateString, b: DateString) => (a <= b ? a : b);
export const maxDate = (a: DateString, b: DateString) => (a >= b ? a : b);
