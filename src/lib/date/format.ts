// Hiển thị ngày giờ kiểu Việt Nam. Tự viết (không dùng Intl) để mọi máy ra kết quả giống nhau.
import { diffDays, parseDate, toVnDate, toVnTime, todayVn, weekdayOf, type DateString } from './vn';

export const WEEKDAY_NAMES = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ nhật',
];
export const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const pad = (n: number) => n.toString().padStart(2, '0');

/** '2026-10-05' → '05/10/2026' (bỏ năm nếu withYear = false) */
export function formatDate(date: DateString, withYear = true): string {
  const { year, month, day } = parseDate(date);
  return withYear ? `${pad(day)}/${pad(month)}/${year}` : `${pad(day)}/${pad(month)}`;
}

/** 'tháng 10/2026' */
export function formatMonth(date: DateString): string {
  const { year, month } = parseDate(date);
  return `tháng ${month}/${year}`;
}

/** Tiêu đề nhóm ngày: 'Hôm nay' · 'Hôm qua' · 'Ngày mai' · 'Thứ Hai, 05/10' (thêm năm nếu khác năm nay) */
export function formatDayHeader(date: DateString, now: number = Date.now()): string {
  const today = todayVn(now);
  const diff = diffDays(today, date);
  if (diff === 0) return 'Hôm nay';
  if (diff === -1) return 'Hôm qua';
  if (diff === 1) return 'Ngày mai';
  const sameYear = parseDate(date).year === parseDate(today).year;
  return `${WEEKDAY_NAMES[weekdayOf(date) - 1]}, ${formatDate(date, !sameYear)}`;
}

/** Khoảng cách tương đối: 'hôm nay' · 'ngày mai' · 'còn 3 ngày' · 'quá hạn 2 ngày' */
export function formatRelativeDue(date: DateString, now: number = Date.now()): string {
  const diff = diffDays(todayVn(now), date);
  if (diff === 0) return 'hôm nay';
  if (diff === 1) return 'ngày mai';
  if (diff > 1) return `còn ${diff} ngày`;
  return `quá hạn ${-diff} ngày`;
}

/** Thời điểm → '05/10/2026 08:30' theo giờ VN */
export function formatDateTime(ms: number): string {
  return `${formatDate(toVnDate(ms))} ${toVnTime(ms)}`;
}

/** Thời điểm → 'cách đây 3 ngày' kiểu ngắn gọn cho lịch sử giá */
export function formatAgo(ms: number, now: number = Date.now()): string {
  const days = diffDays(toVnDate(ms), todayVn(now));
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'hôm qua';
  if (days < 30) return `${days} ngày trước`;
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
  return `${Math.floor(days / 365)} năm trước`;
}
