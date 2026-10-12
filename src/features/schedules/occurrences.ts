// Mở rộng quy tắc lịch thành các kỳ cụ thể (hàm thuần → test được).
// Kỳ tương lai KHÔNG lưu trong DB; chỉ các kỳ đã xử lý (đã trả / bỏ qua / dời ngày) mới có bản ghi.
import type { Schedule, ScheduleOccurrence, TransactionType } from '@/db/schema';
import { addDays, type DateString } from '@/lib/date';
import { generateOccurrences, type RecurrenceRule } from '@/lib/recurrence';

export type OccurrenceStatus = 'upcoming' | 'due' | 'overdue' | 'paid' | 'skipped';

export type ScheduleLike = Pick<
  Schedule,
  | 'id'
  | 'type'
  | 'amount'
  | 'accountId'
  | 'toAccountId'
  | 'categoryId'
  | 'title'
  | 'startDate'
  | 'frequency'
  | 'interval'
  | 'weekdays'
  | 'monthDay'
  | 'weekendRule'
  | 'endType'
  | 'endDate'
  | 'endCount'
  | 'active'
  | 'isEstimate'
  | 'autoPost'
  | 'remindDaysBefore'
  | 'remindTime'
>;

export type Occurrence = {
  scheduleId: string;
  /** Ngày gốc của kỳ theo quy tắc (khoá để lưu trạng thái) */
  dueDate: DateString;
  /** Ngày thực tế (khác dueDate nếu đã dời) */
  date: DateString;
  amount: number;
  type: TransactionType;
  status: OccurrenceStatus;
  transactionId: string | null;
  schedule: ScheduleLike;
};

/**
 * Quy tắc lặp của một lịch. Làm sạch dữ liệu (vd lịch nhập từ Ivy): thứ ngoài 1–7 hoặc ngày trong
 * tháng ngoài 1–31 / -1 khiến bộ sinh kỳ không bao giờ ra kỳ nào → lặp vô tận, treo app.
 */
export function scheduleRule(s: ScheduleLike): RecurrenceRule {
  const weekdays = (s.weekdays ?? '')
    .split(',')
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  const monthDay =
    s.monthDay != null && (s.monthDay === -1 || (s.monthDay >= 1 && s.monthDay <= 31))
      ? Math.trunc(s.monthDay)
      : null;
  return {
    startDate: s.startDate,
    frequency: s.frequency,
    interval: s.interval,
    weekdays: weekdays.length ? weekdays : null,
    monthDay,
    weekendRule: s.weekendRule,
    endType: s.endType,
    endDate: s.endDate,
    endCount: s.endCount,
  };
}

/** Một kỳ (theo ngày gốc) + bản ghi trạng thái đã lưu (nếu có) → trạng thái hiện tại */
function buildOccurrence(
  s: ScheduleLike,
  o: ScheduleOccurrence | undefined,
  dueDate: DateString,
  today: DateString,
): Occurrence {
  const date = o?.status === 'rescheduled' && o.newDate ? o.newDate : dueDate;
  let status: OccurrenceStatus;
  if (o?.status === 'paid') status = 'paid';
  else if (o?.status === 'skipped') status = 'skipped';
  else status = date < today ? 'overdue' : date === today ? 'due' : 'upcoming';
  return {
    scheduleId: s.id,
    dueDate,
    date,
    amount: o?.amount ?? s.amount,
    type: s.type,
    status,
    transactionId: o?.transactionId ?? null,
    schedule: s,
  };
}

/** Kỳ quá hạn chưa xử lý được tìm lùi tối đa bao nhiêu ngày */
export const OVERDUE_LOOKBACK_DAYS = 120;

type ExpandOptions = {
  /** Ngày đầu khoảng xem (gồm). Kỳ quá hạn chưa xử lý luôn được trả về dù trước ngày này. */
  from: DateString;
  /** Ngày cuối khoảng xem (gồm) */
  to: DateString;
  today: DateString;
  /** Trả cả kỳ đã trả / bỏ qua trong khoảng (mặc định chỉ kỳ còn phải xử lý) */
  includeResolved?: boolean;
};

export function expandOccurrences(
  schedules: readonly ScheduleLike[],
  overrides: readonly ScheduleOccurrence[],
  { from, to, today, includeResolved = false }: ExpandOptions,
): Occurrence[] {
  const byKey = new Map(overrides.map((o) => [`${o.scheduleId}|${o.dueDate}`, o]));
  const lookback = addDays(today, -OVERDUE_LOOKBACK_DAYS);
  const result: Occurrence[] = [];

  for (const s of schedules) {
    if (!s.active) continue;
    // Tìm từ sớm hơn để bắt kỳ quá hạn và kỳ dời từ trước sang khoảng xem
    const scanFrom = [from, lookback].sort()[0];
    const scanTo = addDays(to, 62);
    for (const dueDate of generateOccurrences(scheduleRule(s), scanFrom, scanTo)) {
      const occurrence = buildOccurrence(s, byKey.get(`${s.id}|${dueDate}`), dueDate, today);
      const { date, status } = occurrence;
      const resolved = status === 'paid' || status === 'skipped';
      const inRange = date >= from && date <= to;
      if (resolved ? !(includeResolved && inRange) : !(inRange || status === 'overdue')) continue;
      result.push(occurrence);
    }
  }
  return result.sort(
    (a, b) => a.date.localeCompare(b.date) || a.scheduleId.localeCompare(b.scheduleId),
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Tìm một kỳ theo ngày gốc (khoá lưu trạng thái), bất kể đã dời sang ngày nào.
 * Trả null nếu ngày gốc không hợp lệ, hoặc không thuộc quy tắc (vd lịch đã bị sửa) mà cũng không có
 * bản ghi trạng thái.
 */
export function findOccurrence(
  schedule: ScheduleLike,
  overrides: readonly ScheduleOccurrence[],
  dueDate: string | undefined,
  today: DateString,
): Occurrence | null {
  if (!dueDate || !DATE_RE.test(dueDate)) return null;
  const override = overrides.find((o) => o.scheduleId === schedule.id && o.dueDate === dueDate);
  const inRule = generateOccurrences(scheduleRule(schedule), dueDate, dueDate).includes(dueDate);
  if (!inRule && !override) return null;
  return buildOccurrence(schedule, override, dueDate, today);
}
