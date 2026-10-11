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

export function scheduleRule(s: ScheduleLike): RecurrenceRule {
  return {
    startDate: s.startDate,
    frequency: s.frequency,
    interval: s.interval,
    weekdays: s.weekdays ? s.weekdays.split(',').map(Number) : null,
    monthDay: s.monthDay,
    weekendRule: s.weekendRule,
    endType: s.endType,
    endDate: s.endDate,
    endCount: s.endCount,
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
      const o = byKey.get(`${s.id}|${dueDate}`);
      const date = o?.status === 'rescheduled' && o.newDate ? o.newDate : dueDate;
      let status: OccurrenceStatus;
      if (o?.status === 'paid') status = 'paid';
      else if (o?.status === 'skipped') status = 'skipped';
      else status = date < today ? 'overdue' : date === today ? 'due' : 'upcoming';

      const resolved = status === 'paid' || status === 'skipped';
      const inRange = date >= from && date <= to;
      if (resolved ? !(includeResolved && inRange) : !(inRange || status === 'overdue')) continue;

      result.push({
        scheduleId: s.id,
        dueDate,
        date,
        amount: o?.amount ?? s.amount,
        type: s.type,
        status,
        transactionId: o?.transactionId ?? null,
        schedule: s,
      });
    }
  }
  return result.sort(
    (a, b) => a.date.localeCompare(b.date) || a.scheduleId.localeCompare(b.scheduleId),
  );
}
