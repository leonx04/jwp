// Phân tích xu hướng thu chi — hàm thuần trên dữ liệu đã tổng hợp từ SQL (test được, không đụng DB).
import { addDays, diffDays, weekdayOf, type DateString, type Period } from '@/lib/date';

import { periodLength } from './periods';

export type FlowType = 'expense' | 'income';

/** Tổng thu / chi của một ngày (giờ VN) */
export type DailyFlow = { date: DateString; income: number; expense: number; count: number };

/** Tổng của một danh mục trong kỳ */
export type CategoryTotal = {
  /** id danh mục · 'none' = chưa phân loại · '__transfer' = chuyển khoản (khi bật tính chuyển khoản) */
  key: string;
  categoryId: string | null;
  name: string;
  color: string;
  icon: string | null;
  amount: number;
  count: number;
};

export const UNCATEGORIZED_KEY = 'none';
export const TRANSFER_KEY = '__transfer';

// ─── So sánh ────────────────────────────────────────────────────────────────

/** % thay đổi so với kỳ trước; null khi kỳ trước = 0 (không so được) */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type CategoryDelta = CategoryTotal & {
  /** Tỷ trọng trong tổng kỳ này (0–1) */
  share: number;
  /** Số tiền kỳ trước (cùng kỳ) */
  previous: number;
  /** Chênh lệch tuyệt đối */
  delta: number;
  /** % thay đổi; null khi kỳ trước không có */
  change: number | null;
};

/** Ghép tổng danh mục kỳ này với kỳ trước, sắp xếp theo số tiền giảm dần */
export function categoryDeltas(
  current: readonly CategoryTotal[],
  previous: readonly CategoryTotal[],
): CategoryDelta[] {
  const total = current.reduce((sum, c) => sum + c.amount, 0);
  const before = new Map(previous.map((c) => [c.key, c.amount]));
  return current
    .filter((c) => c.amount > 0)
    .map((c) => {
      const prev = before.get(c.key) ?? 0;
      return {
        ...c,
        share: total > 0 ? c.amount / total : 0,
        previous: prev,
        delta: c.amount - prev,
        change: percentChange(c.amount, prev),
      };
    })
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

// ─── Theo ngày ──────────────────────────────────────────────────────────────

export function amountOf(day: DailyFlow, type: FlowType): number {
  return type === 'expense' ? day.expense : day.income;
}

/** Tổng của các ngày trong [from, to] (gồm cả hai đầu) */
export function sumFlows(
  days: readonly DailyFlow[],
  type: FlowType,
  from?: DateString,
  to?: DateString,
): number {
  let total = 0;
  for (const day of days) {
    if (from && day.date < from) continue;
    if (to && day.date > to) continue;
    total += amountOf(day, type);
  }
  return total;
}

/** Trung bình mỗi ngày (hoặc mỗi tháng) trên số đơn vị thời gian đã qua */
export function averagePer(total: number, units: number): number {
  return units > 0 ? total / units : 0;
}

/** Ngày chi (thu) nhiều nhất trong kỳ */
export function topSpendingDay(
  days: readonly DailyFlow[],
  type: FlowType,
  period?: Period,
): { date: DateString; amount: number } | null {
  let best: { date: DateString; amount: number } | null = null;
  for (const day of days) {
    if (period && (day.date < period.start || day.date > period.end)) continue;
    const amount = amountOf(day, type);
    if (amount > 0 && (!best || amount > best.amount)) best = { date: day.date, amount };
  }
  return best;
}

export type WeekdayStat = {
  /** 1 = thứ Hai … 7 = Chủ nhật */
  weekday: number;
  total: number;
  /** Số lần thứ đó xuất hiện trong khoảng (kể cả ngày không chi) */
  days: number;
  average: number;
};

/** Trung bình theo thứ trong tuần trên khoảng [from, to] — tính cả ngày không phát sinh */
export function weekdayPattern(
  days: readonly DailyFlow[],
  type: FlowType,
  from: DateString,
  to: DateString,
): WeekdayStat[] {
  const stats = Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    total: 0,
    days: 0,
    average: 0,
  }));
  if (to < from) return stats;
  const span = diffDays(from, to) + 1;
  // Đếm số lần mỗi thứ xuất hiện mà không cần lặp từng ngày
  const firstWeekday = weekdayOf(from);
  for (let i = 0; i < 7; i++) {
    const weekday = ((firstWeekday - 1 + i) % 7) + 1;
    stats[weekday - 1].days = i < span ? Math.floor((span - 1 - i) / 7) + 1 : 0;
  }
  for (const day of days) {
    if (day.date < from || day.date > to) continue;
    stats[weekdayOf(day.date) - 1].total += amountOf(day, type);
  }
  for (const s of stats) s.average = s.days ? s.total / s.days : 0;
  return stats;
}

/** Thứ có trung bình cao nhất + tỷ lệ so với trung bình chung của 7 thứ */
export function topWeekday(
  pattern: readonly WeekdayStat[],
): { weekday: number; average: number; ratio: number } | null {
  const withDays = pattern.filter((p) => p.days > 0);
  if (!withDays.length) return null;
  const mean = withDays.reduce((sum, p) => sum + p.average, 0) / withDays.length;
  const top = withDays.reduce((best, p) => (p.average > best.average ? p : best));
  if (top.average <= 0 || mean <= 0) return null;
  return { weekday: top.weekday, average: top.average, ratio: top.average / mean };
}

// ─── Dự báo & cộng dồn ─────────────────────────────────────────────────────

/**
 * Dự báo tổng cuối kỳ theo tốc độ hiện tại (tuyến tính).
 * Cần ít nhất `minElapsed` ngày dữ liệu để tránh dự báo vô lý ngay đầu tháng.
 */
export function projectPeriodEnd({
  spent,
  elapsedDays,
  totalDays,
  minElapsed = 3,
}: {
  spent: number;
  elapsedDays: number;
  totalDays: number;
  minElapsed?: number;
}): number | null {
  if (elapsedDays < minElapsed || elapsedDays >= totalDays || totalDays <= 0) return null;
  return Math.round((spent / elapsedDays) * totalDays);
}

/**
 * Tổng cộng dồn theo từng ngày của kỳ (độ dài = số ngày của kỳ).
 * Những ngày sau `upTo` (chưa tới) là null → đường dừng ở hôm nay.
 */
export function cumulativeByDay(
  days: readonly DailyFlow[],
  type: FlowType,
  period: Period,
  upTo?: DateString,
): (number | null)[] {
  const length = periodLength(period);
  const daily = new Array<number>(length).fill(0);
  for (const day of days) {
    if (day.date < period.start || day.date > period.end) continue;
    daily[diffDays(period.start, day.date)] += amountOf(day, type);
  }
  const stop = upTo == null ? length - 1 : Math.min(length - 1, diffDays(period.start, upTo));
  let running = 0;
  return daily.map((amount, i) => {
    if (i > stop) return null;
    running += amount;
    return running;
  });
}

/** Cộng dồn một dãy số; phần tử từ `stopAfter + 1` trở đi là null */
export function cumulative(
  values: readonly number[],
  stopAfter = values.length - 1,
): (number | null)[] {
  let running = 0;
  return values.map((v, i) => {
    if (i > stopAfter) return null;
    running += v;
    return running;
  });
}

// ─── Gom theo kỳ ────────────────────────────────────────────────────────────

export type PeriodFlow = { period: Period; income: number; expense: number; count: number };

/** Gom dữ liệu theo ngày vào các kỳ (tháng). Các kỳ phải liên tiếp, không chồng nhau. */
export function bucketByPeriods(
  days: readonly DailyFlow[],
  periods: readonly Period[],
): PeriodFlow[] {
  const buckets: PeriodFlow[] = periods.map((period) => ({
    period,
    income: 0,
    expense: 0,
    count: 0,
  }));
  for (const day of days) {
    const bucket = buckets.find((b) => day.date >= b.period.start && day.date <= b.period.end);
    if (!bucket) continue;
    bucket.income += day.income;
    bucket.expense += day.expense;
    bucket.count += day.count;
  }
  return buckets;
}

/** Ngày trong khoảng [from, to] (gồm) — dùng để duyệt đủ ngày cả khi không có giao dịch */
export function eachDay(from: DateString, to: DateString): DateString[] {
  const result: DateString[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) result.push(d);
  return result;
}

// ─── Bất thường ─────────────────────────────────────────────────────────────

export type Spike = {
  key: string;
  name: string;
  amount: number;
  /** Trung bình mỗi kỳ của các kỳ tham chiếu */
  baseline: number;
  ratio: number;
};

/**
 * Danh mục tăng đột biến so với trung bình `baselineCount` kỳ trước:
 * gấp ≥ `minRatio` lần VÀ vượt ≥ `minDelta` đồng (bỏ qua danh mục lặt vặt).
 */
export function findSpikes(
  current: readonly CategoryTotal[],
  baselineTotals: readonly CategoryTotal[],
  baselineCount: number,
  { minRatio = 1.5, minDelta = 0 }: { minRatio?: number; minDelta?: number } = {},
): Spike[] {
  if (baselineCount <= 0) return [];
  const base = new Map(baselineTotals.map((c) => [c.key, c.amount / baselineCount]));
  const spikes: Spike[] = [];
  for (const c of current) {
    const baseline = base.get(c.key) ?? 0;
    if (baseline <= 0) continue;
    const ratio = c.amount / baseline;
    if (ratio >= minRatio && c.amount - baseline >= minDelta) {
      spikes.push({ key: c.key, name: c.name, amount: c.amount, baseline, ratio });
    }
  }
  return spikes.sort((a, b) => b.amount - b.baseline - (a.amount - a.baseline));
}

// ─── Gộp phần nhỏ cho biểu đồ ───────────────────────────────────────────────

export const OTHER_KEY = '__other';

/** Giữ `max − 1` phần lớn nhất, gộp phần còn lại thành "Khác" (donut dễ đọc khi ≤ 6 phần) */
export function foldSlices<T extends { key: string; amount: number; color: string; name: string }>(
  items: readonly T[],
  max: number,
  other: { name: string; color: string },
): { key: string; value: number; color: string; label: string; keys: string[] }[] {
  const sorted = [...items].filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount);
  const toSlice = (i: T) => ({
    key: i.key,
    value: i.amount,
    color: i.color,
    label: i.name,
    keys: [i.key],
  });
  if (sorted.length <= max) return sorted.map(toSlice);
  const head = sorted.slice(0, max - 1).map(toSlice);
  const tail = sorted.slice(max - 1);
  head.push({
    key: OTHER_KEY,
    value: tail.reduce((sum, i) => sum + i.amount, 0),
    color: other.color,
    label: other.name,
    keys: tail.map((i) => i.key),
  });
  return head;
}
