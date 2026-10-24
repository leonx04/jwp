// Khoản nợ có lãi theo kỳ: dựng lịch trả từ điều khoản (src/core/loans) và các lần đã trả thật.
// Kỳ đã trả lấy theo bản ghi có `period`; các kỳ còn lại tính từ dư nợ thực tế, nên trả trước hạn
// hay trả lệch số cũng tự điều chỉnh lịch phía sau. Hàm thuần, test được.
import {
  buildSchedule,
  dueDateOf,
  remainingTerms,
  type Installment,
  type LoanMethod,
  type LoanTerms,
  type RateStep,
} from '@/core/loans';
import type { DebtTerms } from '@/db/schema';
import { diffDays, type DateString } from '@/lib/date';

export type PlanRow = Installment & {
  status: 'paid' | 'overdue' | 'due' | 'upcoming';
};

export type InstallmentPlan = {
  months: number;
  /** Số kỳ đã trả (kỳ lớn nhất có bản ghi) */
  paidCount: number;
  /** Mọi kỳ: đã trả trước, rồi các kỳ còn lại theo dư nợ hiện tại */
  rows: PlanRow[];
  /** Kỳ phải trả tiếp theo (null khi đã trả hết) */
  next: PlanRow | null;
  /** Tổng lãi + phí còn phải trả */
  interestLeft: number;
};

/** Số ngày trước hạn coi là "đến kỳ" (hiện nút trả kỳ này nổi bật) */
export const DUE_WINDOW_DAYS = 7;

export function parseRateSteps(json: string | null): RateStep[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((s) => ({ fromPeriod: Number(s?.fromPeriod), annualRate: Number(s?.annualRate) }))
      .filter((s) => Number.isInteger(s.fromPeriod) && s.fromPeriod > 1 && s.annualRate >= 0);
  } catch {
    return [];
  }
}

/** Điều khoản lưu trong DB → đầu vào của core/loans */
export function loanTermsOf(principal: number, terms: DebtTerms): LoanTerms {
  return {
    principal,
    annualRate: terms.annualRate,
    months: terms.months,
    method: terms.method as LoanMethod,
    rateSteps: parseRateSteps(terms.rateSteps),
    graceMonths: terms.graceMonths,
    dayCount: terms.dayCount,
    startDate: terms.startDate,
    monthlyFee: terms.monthlyFee,
  };
}

type RecordLike = {
  type: 'repay' | 'increase' | 'interest';
  amount: number;
  period: number | null;
};

export function installmentPlan(
  terms: LoanTerms,
  records: readonly RecordLike[],
  /** Dư nợ gốc hiện tại (gốc + vay thêm − đã trả) */
  balance: number,
  today: DateString,
): InstallmentPlan {
  const original = buildSchedule(terms);
  const paidByPeriod = new Map<number, number>();
  for (const r of records) {
    if (r.type === 'repay' && r.period != null) {
      paidByPeriod.set(r.period, (paidByPeriod.get(r.period) ?? 0) + r.amount);
    }
  }
  const paidCount = Math.max(0, ...paidByPeriod.keys());

  const paidRows: PlanRow[] = original.rows.slice(0, paidCount).map((row) => ({
    ...row,
    principal: paidByPeriod.get(row.period) ?? 0,
    status: 'paid',
  }));

  let future: Installment[] = [];
  if (balance > 0) {
    const expected =
      paidCount === 0 ? Math.round(terms.principal) : original.rows[paidCount - 1]?.balance;
    if (paidCount < terms.months && expected === balance) {
      future = original.rows.slice(paidCount);
    } else {
      // Đã trả trước / trả lệch / vay thêm: tính lại phần còn lại từ dư nợ thật, giữ hạn cuối
      const left = Math.max(1, terms.months - paidCount);
      future = buildSchedule(remainingTerms(terms, paidCount, balance, left)).rows.map((r) => ({
        ...r,
        period: r.period + paidCount,
        date: terms.startDate ? dueDateOf(terms.startDate, r.period + paidCount) : null,
      }));
    }
  }

  const futureRows: PlanRow[] = future.map((row, i) => {
    const days = row.date ? diffDays(today, row.date) : null;
    const status: PlanRow['status'] =
      i === 0 && days != null && days < 0
        ? 'overdue'
        : i === 0 && (days == null || days <= DUE_WINDOW_DAYS)
          ? 'due'
          : days != null && days < 0
            ? 'overdue'
            : 'upcoming';
    return { ...row, status };
  });

  return {
    months: Math.max(terms.months, paidCount + futureRows.length),
    paidCount,
    rows: [...paidRows, ...futureRows],
    next: futureRows[0] ?? null,
    interestLeft: futureRows.reduce((s, r) => s + r.interest + r.fee, 0),
  };
}
