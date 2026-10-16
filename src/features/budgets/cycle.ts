// Chu kỳ riêng của ngân sách: bắt đầu từ ngày `startDay` mỗi tháng; nếu ngày đó rơi vào cuối tuần thì dời theo quy tắc
// (vd lương về ngày 17, trúng thứ Bảy / Chủ nhật thì nhận thứ Hai → kỳ bắt đầu từ thứ Hai đó).
import { addDays, addMonths, daysInMonth, makeDate, parseDate, type DateString } from '@/lib/date';
import { applyWeekendRule, type WeekendRule } from '@/lib/recurrence';

export type CyclePeriod = { start: DateString; end: DateString };

/** Ngày bắt đầu kỳ của tháng chứa `monthOf` (đã áp quy tắc cuối tuần). Ngày 31 ở tháng ngắn → cuối tháng. */
function cycleStart(monthOf: DateString, startDay: number, rule: WeekendRule): DateString {
  const { year, month } = parseDate(monthOf);
  const raw = makeDate(year, month, Math.min(startDay, daysInMonth(year, month)));
  return applyWeekendRule(raw, rule);
}

/** Kỳ chứa `date`: từ ngày bắt đầu (đã dời) tới trước ngày bắt đầu của kỳ kế tiếp */
export function cyclePeriodContaining(
  date: DateString,
  startDay: number,
  rule: WeekendRule = 'none',
): CyclePeriod {
  const first = makeDate(parseDate(date).year, parseDate(date).month, 1);
  // Xét các tháng lân cận: ngày bắt đầu bị dời cuối tuần có thể lệch sang tháng bên cạnh
  const starts = [-2, -1, 0, 1, 2].map((offset) =>
    cycleStart(addMonths(first, offset), startDay, rule),
  );
  let index = 0;
  starts.forEach((start, i) => {
    if (start <= date) index = i;
  });
  return { start: starts[index], end: addDays(starts[index + 1], -1) };
}
