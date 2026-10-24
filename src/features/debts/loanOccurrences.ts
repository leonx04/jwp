// Kỳ trả của khoản nợ có lãi theo kỳ → các "kỳ" ảo dạng Occurrence để hiện trong Lịch, "Sắp tới"
// và tính vào dự trù dòng tiền (giống bill ví trả sau). Hàm thuần, test được.
import type { Occurrence, OccurrenceStatus, ScheduleLike } from '@/features/schedules/occurrences';
import { t } from '@/lib/i18n';
import type { DateString } from '@/lib/date';

import type { DebtItem } from './queries';

/** scheduleId của kỳ vay ảo: 'loan:<debtId>~<kỳ>' — không có bản ghi lịch thật trong DB */
export const LOAN_PREFIX = 'loan:';

export const isLoanInstallment = (scheduleId: string) => scheduleId.startsWith(LOAN_PREFIX);

export function loanOfOccurrence(scheduleId: string): { debtId: string; period: number } | null {
  if (!isLoanInstallment(scheduleId)) return null;
  const rest = scheduleId.slice(LOAN_PREFIX.length);
  const at = rest.lastIndexOf('~');
  if (at <= 0) return null;
  const period = Number(rest.slice(at + 1));
  return Number.isInteger(period) ? { debtId: rest.slice(0, at), period } : null;
}

export type LoanSource = Pick<DebtItem, 'debt' | 'person' | 'direction' | 'status' | 'plan'>;

function loanSchedule(
  source: LoanSource,
  id: string,
  accountId: string,
  amount: number,
  date: DateString,
  title: string,
): ScheduleLike {
  return {
    id,
    type: source.direction === 'lent' ? 'income' : 'expense',
    amount,
    accountId,
    toAccountId: null,
    categoryId: null,
    title,
    startDate: date,
    frequency: 'once',
    interval: 1,
    weekdays: null,
    monthDay: null,
    weekendRule: 'none',
    endType: 'never',
    endDate: null,
    endCount: null,
    active: true,
    isEstimate: false,
    autoPost: false,
    remindDaysBefore: 0,
    remindTime: '09:00',
  };
}

/**
 * Các kỳ trả trong [from, to] của mọi khoản có lãi theo kỳ còn mở. Kỳ quá hạn chưa trả luôn kèm theo
 * (kể cả trước `from`). `includeResolved`: kèm kỳ đã trả trong khoảng (cho Lịch).
 * `fallbackPayer`: ví tạm tính khi khoản nợ chưa gắn ví.
 */
export function loanInstallmentOccurrences(
  sources: readonly LoanSource[],
  {
    from,
    to,
    today,
    fallbackPayer,
    includeResolved = false,
  }: {
    from: DateString;
    to: DateString;
    today: DateString;
    fallbackPayer: string | null;
    includeResolved?: boolean;
  },
): Occurrence[] {
  const out: Occurrence[] = [];
  for (const source of sources) {
    const { plan, debt } = source;
    if (!plan) continue;
    const accountId = debt.accountId ?? fallbackPayer;
    if (!accountId) continue;
    const closed = source.status === 'closed';
    const who = source.person.name;
    for (const row of plan.rows) {
      if (!row.date || row.date > to || row.payment <= 0) continue;
      const paid = row.status === 'paid';
      if (paid ? !includeResolved || row.date < from : closed) continue;
      const status: OccurrenceStatus = paid
        ? 'paid'
        : row.date < today
          ? 'overdue'
          : row.date === today
            ? 'due'
            : 'upcoming';
      if (!paid && status !== 'overdue' && row.date < from) continue;
      const id = `${LOAN_PREFIX}${debt.id}~${row.period}`;
      const title =
        source.direction === 'lent'
          ? t('{name} trả kỳ {period}', { name: who, period: row.period })
          : t('Trả kỳ {period} · {name}', { period: row.period, name: who });
      out.push({
        scheduleId: id,
        dueDate: row.date,
        date: row.date,
        amount: row.payment,
        type: source.direction === 'lent' ? 'income' : 'expense',
        status,
        transactionId: null,
        schedule: loanSchedule(source, id, accountId, row.payment, row.date, title),
      });
    }
  }
  return out;
}
