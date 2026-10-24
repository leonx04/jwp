// Lịch trả khoản vay: hàm thuần, không phụ thuộc React hay SQLite.
// Lãi suất năm danh nghĩa (12%/năm = 1%/tháng, cách ngân hàng Việt Nam niêm yết).
// Tiền làm tròn đến đồng ở từng kỳ; kỳ cuối nhận phần chênh để dư nợ về đúng 0.
import { addMonths, diffDays, type DateString } from '@/lib/date';

export const LOAN_METHODS = ['annuity', 'equal_principal', 'flat', 'interest_only'] as const;
/**
 * annuity: dư nợ giảm dần, trả đều mỗi kỳ (niên kim) · equal_principal: dư nợ giảm dần, gốc đều
 * flat: lãi phẳng trên gốc ban đầu · interest_only: trả lãi hằng kỳ, gốc trả kỳ cuối
 */
export type LoanMethod = (typeof LOAN_METHODS)[number];

/** monthly: lãi = dư nợ × lãi năm / 12 · actual_365: lãi = dư nợ × lãi năm × số ngày thực / 365 */
export type DayCount = 'monthly' | 'actual_365';

/** Lãi suất áp dụng từ kỳ `fromPeriod` (tính từ 1) trở đi; dùng cho ưu đãi rồi thả nổi */
export type RateStep = { fromPeriod: number; annualRate: number };

export type LoanTerms = {
  principal: number;
  /** %/năm, vd 12 */
  annualRate: number;
  months: number;
  method: LoanMethod;
  /** Các mức lãi sau mức đầu (ưu đãi → thả nổi). Không bắt buộc. */
  rateSteps?: readonly RateStep[];
  /** Số kỳ đầu chỉ trả lãi (ân hạn gốc). Không áp dụng cho lãi phẳng và trả lãi cuối kỳ. */
  graceMonths?: number;
  dayCount?: DayCount;
  /** Ngày giải ngân; cần cho ngày từng kỳ và cách tính actual_365 */
  startDate?: DateString;
  /** Phí cộng vào mỗi kỳ (bảo hiểm, phí quản lý) */
  monthlyFee?: number;
};

export type Installment = {
  period: number;
  /** Ngày đến hạn (khi có startDate) */
  date: DateString | null;
  principal: number;
  interest: number;
  fee: number;
  /** gốc + lãi + phí */
  payment: number;
  /** Dư nợ sau kỳ này */
  balance: number;
  /** Lãi suất năm áp dụng ở kỳ này */
  annualRate: number;
};

export type Schedule = {
  rows: Installment[];
  totalInterest: number;
  totalFee: number;
  totalPaid: number;
  firstPayment: number;
  lastPayment: number;
  maxPayment: number;
};

export class LoanInputError extends Error {}

export function validateTerms(t: LoanTerms): void {
  if (!Number.isFinite(t.principal) || t.principal <= 0) {
    throw new LoanInputError('Số tiền vay phải lớn hơn 0.');
  }
  if (!Number.isInteger(t.months) || t.months < 1 || t.months > 600) {
    throw new LoanInputError('Số kỳ phải từ 1 đến 600.');
  }
  const rates = [t.annualRate, ...(t.rateSteps ?? []).map((s) => s.annualRate)];
  if (rates.some((r) => !Number.isFinite(r) || r < 0 || r > 200)) {
    throw new LoanInputError('Lãi suất phải từ 0 đến 200%/năm.');
  }
  const grace = t.graceMonths ?? 0;
  if (!Number.isInteger(grace) || grace < 0 || grace >= t.months) {
    throw new LoanInputError('Số tháng ân hạn phải nhỏ hơn số kỳ.');
  }
}

/** Lãi suất năm áp dụng ở kỳ `period` */
export function rateAt(t: Pick<LoanTerms, 'annualRate' | 'rateSteps'>, period: number): number {
  let rate = t.annualRate;
  for (const s of [...(t.rateSteps ?? [])].sort((a, b) => a.fromPeriod - b.fromPeriod)) {
    if (s.fromPeriod <= period) rate = s.annualRate;
  }
  return rate;
}

/** Số trả đều mỗi kỳ (chưa làm tròn) cho dư nợ `balance` trong `n` kỳ với lãi tháng `r` */
export function annuityPayment(balance: number, monthlyRate: number, n: number): number {
  if (n <= 0) return balance;
  if (monthlyRate === 0) return balance / n;
  const f = Math.pow(1 + monthlyRate, n);
  return (balance * monthlyRate * f) / (f - 1);
}

/** Ngày đến hạn kỳ `period`: cùng ngày trong tháng với ngày giải ngân (tháng ngắn thì lùi về cuối tháng) */
export function dueDateOf(startDate: DateString, period: number): DateString {
  return addMonths(startDate, period);
}

export function buildSchedule(t: LoanTerms): Schedule {
  validateTerms(t);
  const n = t.months;
  const grace = t.method === 'annuity' || t.method === 'equal_principal' ? (t.graceMonths ?? 0) : 0;
  const fee = Math.round(t.monthlyFee ?? 0);
  const P = Math.round(t.principal);
  const rows: Installment[] = [];
  let balance = P;
  let payment = 0; // số trả đều của niên kim, tính lại khi lãi đổi
  let paymentRate = -1;
  const flatPrincipal = Math.round(P / n);
  let equalPrincipal = 0;

  for (let k = 1; k <= n; k++) {
    const annual = rateAt(t, k);
    const r = annual / 100 / 12;
    const date = t.startDate ? dueDateOf(t.startDate, k) : null;
    const prevDate = t.startDate ? dueDateOf(t.startDate, k - 1) : null;
    const periodRate =
      t.dayCount === 'actual_365' && date && prevDate
        ? (annual / 100) * (diffDays(prevDate, date) / 365)
        : r;
    const last = k === n;

    let interest: number;
    let principal: number;
    if (t.method === 'flat') {
      interest = Math.round(P * r);
      principal = last ? balance : flatPrincipal;
    } else {
      interest = Math.round(balance * periodRate);
      if (t.method === 'interest_only' || k <= grace) {
        principal = last ? balance : 0;
      } else if (t.method === 'equal_principal') {
        if (!equalPrincipal) equalPrincipal = Math.round(balance / (n - k + 1));
        principal = last ? balance : Math.min(balance, equalPrincipal);
      } else {
        // Niên kim: tính lại số trả đều ở kỳ đầu sau ân hạn và mỗi khi lãi suất đổi
        if (paymentRate !== annual || payment === 0) {
          payment = Math.round(annuityPayment(balance, r, n - k + 1));
          paymentRate = annual;
        }
        principal = last ? balance : Math.max(0, Math.min(balance, payment - interest));
      }
    }
    balance -= principal;
    rows.push({
      period: k,
      date,
      principal,
      interest,
      fee,
      payment: principal + interest + fee,
      balance,
      annualRate: annual,
    });
  }
  return summarize(rows);
}

function summarize(rows: Installment[]): Schedule {
  let totalInterest = 0;
  let totalFee = 0;
  let totalPaid = 0;
  let maxPayment = 0;
  for (const r of rows) {
    totalInterest += r.interest;
    totalFee += r.fee;
    totalPaid += r.payment;
    maxPayment = Math.max(maxPayment, r.payment);
  }
  return {
    rows,
    totalInterest,
    totalFee,
    totalPaid,
    firstPayment: rows[0]?.payment ?? 0,
    lastPayment: rows.at(-1)?.payment ?? 0,
    maxPayment,
  };
}

/**
 * Lãi suất thực tương đương (%/năm danh nghĩa, = lãi tháng × 12): giải i trong
 * tiền thực nhận = Σ payment_k / (1+i)^k. Dùng để so lãi phẳng, phí trả trước với dư nợ giảm dần.
 */
export function effectiveAnnualRate(received: number, payments: readonly number[]): number | null {
  if (received <= 0 || !payments.length) return null;
  const pv = (i: number) => payments.reduce((s, p, k) => s + p / Math.pow(1 + i, k + 1), 0);
  const total = payments.reduce((s, p) => s + p, 0);
  if (total < received) return null; // trả ít hơn nhận: lãi âm, không có nghĩa ở đây
  let lo = 0;
  let hi = 1; // 100%/tháng
  if (pv(hi) > received) return null;
  for (let step = 0; step < 100; step++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > received) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

export type LoanSummary = Schedule & {
  /** Lãi thực tương đương có tính phí trả trước và phí hằng kỳ */
  effectiveRate: number | null;
};

/** Lịch trả + lãi thực. `upfrontFee`: phí trừ ngay khi giải ngân (bảo hiểm, phí hồ sơ). */
export function summarizeLoan(t: LoanTerms, upfrontFee = 0): LoanSummary {
  const schedule = buildSchedule(t);
  return {
    ...schedule,
    effectiveRate: effectiveAnnualRate(
      t.principal - upfrontFee,
      schedule.rows.map((r) => r.payment),
    ),
  };
}

// ── Trả trước hạn ──────────────────────────────────────────────────────────────

export type PrepayInput = {
  terms: LoanTerms;
  /** Trả thêm ngay sau khi trả xong kỳ này */
  afterPeriod: number;
  amount: number;
  /** shorten: giữ số trả mỗi kỳ, bớt số kỳ · reduce: giữ số kỳ, bớt số trả mỗi kỳ */
  mode: 'shorten' | 'reduce';
  /** Phí trả trước, % trên số trả trước */
  feePercent?: number;
};

export type PrepayResult = {
  before: Schedule;
  after: Schedule;
  /** Lãi tiết kiệm được so với không trả trước */
  interestSaved: number;
  fee: number;
  /** Lãi tiết kiệm − phí: âm là không có lợi */
  netSaving: number;
  /** Số kỳ còn lại sau khi trả trước (shorten) */
  monthsLeft: number;
  /** Số trả kỳ kế tiếp sau khi trả trước */
  nextPayment: number;
};

/**
 * Mô phỏng trả trước một phần. Các kỳ đến `afterPeriod` giữ nguyên; phần còn lại tính lại
 * từ dư nợ mới với cùng cách tính lãi. Trả hết dư nợ = tất toán.
 */
export function simulatePrepayment(input: PrepayInput): PrepayResult {
  const { terms, afterPeriod, mode } = input;
  const before = buildSchedule(terms);
  const k = Math.max(0, Math.min(afterPeriod, terms.months - 1));
  const paid = before.rows.slice(0, k);
  const balanceAt = k === 0 ? Math.round(terms.principal) : before.rows[k - 1].balance;
  const amount = Math.min(Math.max(0, Math.round(input.amount)), balanceAt);
  const fee = Math.round((amount * (input.feePercent ?? 0)) / 100);
  const left = balanceAt - amount;
  const remaining = terms.months - k;

  let tail: Installment[] = [];
  if (left > 0) {
    let months = remaining;
    if (mode === 'shorten') {
      // Giữ gần đúng số trả mỗi kỳ cũ: số kỳ nhỏ nhất mà số trả mới không vượt số trả cũ
      const oldNext = before.rows[k].payment - before.rows[k].fee;
      months = 1;
      while (months < remaining) {
        const trial = buildSchedule(remainingTerms(terms, k, left, months));
        if (trial.rows[0].payment - trial.rows[0].fee <= oldNext) break;
        months++;
      }
    }
    tail = buildSchedule(remainingTerms(terms, k, left, months)).rows.map((r) => ({
      ...r,
      period: r.period + k,
      date: terms.startDate ? dueDateOf(terms.startDate, r.period + k) : null,
    }));
  }
  const after = summarize([...paid, ...tail]);
  const interestSaved = before.totalInterest - after.totalInterest;
  return {
    before,
    after,
    interestSaved,
    fee,
    netSaving: interestSaved - fee,
    monthsLeft: tail.length,
    nextPayment: tail[0]?.payment ?? 0,
  };
}

/** Điều khoản cho phần còn lại sau kỳ `k` với dư nợ `balance` và còn `months` kỳ (kỳ đánh số lại từ 1) */
export function remainingTerms(
  t: LoanTerms,
  k: number,
  balance: number,
  months: number,
): LoanTerms {
  const rate = rateAt(t, k + 1);
  const steps = (t.rateSteps ?? [])
    .filter((s) => s.fromPeriod > k + 1)
    .map((s) => ({ fromPeriod: s.fromPeriod - k, annualRate: s.annualRate }));
  // Lãi phẳng sau trả trước: lãi tính trên dư nợ mới như một khoản phẳng mới (cách các công ty tài chính làm)
  return {
    ...t,
    principal: balance,
    annualRate: rate,
    months,
    rateSteps: steps,
    graceMonths: Math.min(months - 1, Math.max(0, (t.graceMonths ?? 0) - k)),
    startDate: t.startDate ? dueDateOf(t.startDate, k) : undefined,
  };
}
