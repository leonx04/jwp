// "Việc cần làm" ở Hôm nay: chọn những thứ cần người dùng bấm, gấp nhất trước. Hàm thuần, test được.
import type { DebtItem } from '@/features/debts/queries';
import type { Occurrence } from '@/features/schedules/occurrences';
import { addDays, type DateString } from '@/lib/date';

/** Kỳ thu chi hiện trong danh sách: quá hạn hoặc trong ngần này ngày tới */
export const TODO_DAYS = 7;
export const MAX_OCCURRENCES = 5;
export const MAX_DEBTS = 3;

type TodoDebt = Pick<DebtItem, 'status' | 'daysToDue' | 'terms' | 'remaining'> & {
  debt: Pick<DebtItem['debt'], 'id'>;
};

export function pickTodos<O extends Pick<Occurrence, 'status' | 'date'>, D extends TodoDebt>({
  today,
  occurrences,
  debts,
}: {
  today: DateString;
  occurrences: readonly O[];
  debts: readonly D[];
}): { occurrences: O[]; moreOccurrences: number; debts: D[] } {
  const until = addDays(today, TODO_DAYS);
  const soon = occurrences
    .filter((o) => o.status === 'overdue' || o.date <= until)
    .sort(
      (a, b) =>
        Number(b.status === 'overdue') - Number(a.status === 'overdue') ||
        (a.date < b.date ? -1 : a.date > b.date ? 1 : 0),
    );
  // Khoản vay có lãi theo kỳ đã hiện thành kỳ trả trong danh sách lịch → không lặp lại ở đây
  const dueDebts = debts
    .filter((d) => !d.terms && (d.status === 'overdue' || d.status === 'due-soon'))
    .sort(
      (a, b) =>
        Number(b.status === 'overdue') - Number(a.status === 'overdue') ||
        (a.daysToDue ?? 9999) - (b.daysToDue ?? 9999) ||
        b.remaining - a.remaining,
    );
  return {
    occurrences: soon.slice(0, MAX_OCCURRENCES),
    moreOccurrences: Math.max(0, soon.length - MAX_OCCURRENCES),
    debts: dueDebts.slice(0, MAX_DEBTS),
  };
}
