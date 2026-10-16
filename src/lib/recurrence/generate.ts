// Sinh các kỳ (ngày đến hạn) từ một quy tắc lặp lại. Hàm thuần, không đụng DB → test kỹ được.
import { t } from '@/lib/i18n';
import {
  addDays,
  addMonths,
  daysInMonth,
  makeDate,
  parseDate,
  startOfWeek,
  weekdayOf,
  type DateString,
} from '@/lib/date';

export type Frequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WeekendRule = 'none' | 'before' | 'after';
export type EndType = 'never' | 'until' | 'count';

export type RecurrenceRule = {
  startDate: DateString;
  frequency: Frequency;
  /** Mỗi N ngày/tuần/tháng/năm */
  interval: number;
  /** Lặp theo tuần: các thứ (1 = thứ Hai … 7 = Chủ nhật). Trống → thứ của ngày bắt đầu */
  weekdays?: readonly number[] | null;
  /** Lặp theo tháng: ngày 1–31, -1 = ngày cuối tháng. Trống → ngày của ngày bắt đầu */
  monthDay?: number | null;
  weekendRule: WeekendRule;
  endType: EndType;
  endDate?: DateString | null;
  endCount?: number | null;
};

/** Rơi vào thứ Bảy / Chủ nhật → lùi về thứ Sáu hoặc dời sang thứ Hai */
export function applyWeekendRule(date: DateString, rule: WeekendRule): DateString {
  if (rule === 'none') return date;
  const wd = weekdayOf(date);
  if (wd < 6) return date;
  if (rule === 'before') return addDays(date, 5 - wd); // T7 → -1, CN → -2
  return addDays(date, 8 - wd); // T7 → +2, CN → +1
}

/** Ngày "gốc" thứ k của quy tắc (chưa áp quy tắc cuối tuần), hoặc null nếu k vượt quá kỳ cuối của tuần */
function* rawDates(rule: RecurrenceRule): Generator<DateString> {
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const start = rule.startDate;

  switch (rule.frequency) {
    case 'once':
      yield start;
      return;

    case 'daily':
      for (let k = 0; ; k++) yield addDays(start, k * interval);

    case 'weekly': {
      const days = [...new Set(rule.weekdays?.length ? rule.weekdays : [weekdayOf(start)])]
        .filter((d) => d >= 1 && d <= 7)
        .sort((a, b) => a - b);
      const firstWeek = startOfWeek(start);
      for (let w = 0; ; w += interval) {
        const weekStart = addDays(firstWeek, w * 7);
        for (const d of days) {
          const date = addDays(weekStart, d - 1);
          if (date >= start) yield date;
        }
      }
    }

    case 'monthly': {
      const { year, month, day } = parseDate(start);
      const anchorDay = rule.monthDay ?? day;
      for (let k = 0; ; k += interval) {
        const first = parseDate(addMonths(makeDate(year, month, 1), k));
        const dim = daysInMonth(first.year, first.month);
        const d = anchorDay === -1 ? dim : Math.min(anchorDay, dim);
        const date = makeDate(first.year, first.month, d);
        if (date >= start) yield date;
      }
    }

    case 'yearly': {
      const { year, month, day } = parseDate(start);
      for (let k = 0; ; k += interval) {
        const y = year + k;
        yield makeDate(y, month, Math.min(day, daysInMonth(y, month)));
      }
    }
  }
}

/** Giới hạn an toàn: tránh vòng lặp vô tận khi quy tắc lỗi */
const MAX_ITERATIONS = 20_000;

/**
 * Các kỳ trong khoảng [from, to] (gồm hai đầu), đã áp quy tắc cuối tuần và điều kiện kết thúc.
 * Điều kiện kết thúc tính theo ngày gốc; số lần ('count') đếm từ kỳ đầu tiên.
 */
export function generateOccurrences(
  rule: RecurrenceRule,
  from: DateString,
  to: DateString,
): DateString[] {
  const result: DateString[] = [];
  let index = 0;
  for (const raw of rawDates(rule)) {
    if (index >= MAX_ITERATIONS) break;
    if (rule.endType === 'count' && index >= (rule.endCount ?? 0)) break;
    if (rule.endType === 'until' && rule.endDate && raw > rule.endDate) break;
    index++;
    const date = applyWeekendRule(raw, rule.weekendRule);
    // Kỳ đã dời về trước có thể vẫn > to trong khi ngày gốc > to → dừng theo ngày gốc trễ hơn một tuần
    if (raw > to && date > to) {
      if (raw > addDays(to, 7)) break;
      continue;
    }
    if (date >= from && date <= to) result.push(date);
  }
  return result;
}

/** Kỳ đầu tiên >= from (hoặc null nếu quy tắc đã kết thúc trước đó) */
export function nextOccurrence(
  rule: RecurrenceRule,
  from: DateString,
  horizonDays = 366 * 5,
): DateString | null {
  return generateOccurrences(rule, from, addDays(from, horizonDays))[0] ?? null;
}

/** Mô tả quy tắc bằng tiếng Việt: 'Hằng tháng, ngày 19' · 'Mỗi 2 tuần vào T2, T6' */
export function describeRule(rule: RecurrenceRule): string {
  const n = Math.max(1, rule.interval);
  const every = (unit: string) =>
    n === 1 ? t('Hằng {unit}', { unit }) : t('Mỗi {n} {unit}', { n, unit });
  const short = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  let text: string;
  switch (rule.frequency) {
    case 'once':
      return 'Một lần';
    case 'daily':
      text = every('ngày');
      break;
    case 'weekly': {
      const days = rule.weekdays?.length ? rule.weekdays : [weekdayOf(rule.startDate)];
      text = `${every('tuần')} vào ${[...days]
        .sort()
        .map((d) => short[d - 1])
        .join(', ')}`;
      break;
    }
    case 'monthly': {
      const day = rule.monthDay ?? parseDate(rule.startDate).day;
      text = `${every('tháng')}, ${day === -1 ? 'ngày cuối tháng' : t('ngày {day}', { day })}`;
      break;
    }
    case 'yearly': {
      const { day, month } = parseDate(rule.startDate);
      text = t('{every}, ngày {day}/{month}', { every: every('năm'), day, month });
      break;
    }
  }
  if (rule.weekendRule === 'before') text += ' (cuối tuần → thứ Sáu)';
  if (rule.weekendRule === 'after') text += ' (cuối tuần → thứ Hai)';
  if (rule.endType === 'count' && rule.endCount)
    text += t(' · {endCount} lần', { endCount: rule.endCount });
  return text;
}
