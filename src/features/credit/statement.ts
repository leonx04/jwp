// Ví trả sau / thẻ tín dụng (SPayLater, MoMo trả sau, thẻ tín dụng) — hàm thuần, test được.
// Quy ước ghi chép: mua hàng = khoản CHI từ ví trả sau (số dư âm = dư nợ);
// trả bill = CHUYỂN KHOẢN từ ngân hàng vào ví trả sau (không tính là chi lần nữa).
// Mua trả góp: ghi CHI toàn bộ giá (gồm phí) + một kế hoạch trả góp để biết phần nào chưa tới hạn.
import {
  addMonths,
  daysInMonth,
  diffDays,
  makeDate,
  parseDate,
  toVnDate,
  type DateString,
} from '@/lib/date';

export type AccountMovement = {
  /** Thời điểm (ms) */
  date: number;
  /** Ảnh hưởng lên số dư ví này: + tiền vào (trả bill, hoàn tiền) · − tiền ra (mua hàng) */
  delta: number;
};

export type InstallmentPlan = {
  /** Ngày mua (giá trị đã nằm trong dư nợ từ ngày này) */
  purchaseDate: DateString;
  /** Số tiền mỗi kỳ */
  amount: number;
  /** Ngày đến hạn của từng kỳ */
  dueDates: readonly DateString[];
};

export type CreditInput = {
  today: DateString;
  creditLimit?: number | null;
  statementDay?: number | null;
  dueDay?: number | null;
  movements: readonly AccountMovement[];
  installments?: readonly InstallmentPlan[];
};

export type Statement = {
  /** Ngày chốt sao kê */
  closeDate: DateString;
  dueDate: DateString;
  /** Dư nợ tại ngày chốt */
  statementBalance: number;
  /** Đã trả từ sau ngày chốt */
  paid: number;
  /** Còn phải trả của kỳ này (đã trừ phần trả góp chưa tới hạn) */
  dueAmount: number;
  daysUntilDue: number;
  overdue: boolean;
};

export type CreditStatus = {
  owed: number;
  available: number | null;
  /** 0–1 */
  utilization: number | null;
  /** Gốc trả góp chưa tới hạn (đã nằm trong dư nợ) */
  installmentRemaining: number;
  current: Statement | null;
  next: { closeDate: DateString; dueDate: DateString; estimatedAmount: number } | null;
};

/** Ngày thứ `day` của tháng chứa `date` (ngày 31 ở tháng thiếu → ngày cuối tháng) */
function dayOfMonth(date: DateString, day: number): DateString {
  const { year, month } = parseDate(date);
  return makeDate(year, month, Math.min(day, daysInMonth(year, month)));
}

/** Ngày chốt gần nhất ≤ today */
export function lastCloseDate(today: DateString, statementDay: number): DateString {
  const thisMonth = dayOfMonth(today, statementDay);
  return thisMonth <= today
    ? thisMonth
    : dayOfMonth(addMonths(dayOfMonth(today, 1), -1), statementDay);
}

/** Ngày đến hạn đầu tiên SAU ngày chốt */
export function dueDateAfter(closeDate: DateString, dueDay: number): DateString {
  const sameMonth = dayOfMonth(closeDate, dueDay);
  return sameMonth > closeDate
    ? sameMonth
    : dayOfMonth(addMonths(dayOfMonth(closeDate, 1), 1), dueDay);
}

/**
 * Số dư TRƯỚC ngày `date`. Giao dịch đúng ngày chốt thuộc kỳ SAU (SPayLater: đơn hoàn thành
 * 24/05 nằm trong hóa đơn phát hành 24/06, chỉ đơn trước ngày phát hành mới vào hóa đơn đó). Khoản trả nợ đúng ngày chốt thì tính vào hóa đơn cũ.
 */
function balanceBefore(movements: readonly AccountMovement[], date: DateString): number {
  // Tiền TRẢ NỢ (delta > 0) đúng ngày chốt vẫn tính cho hóa đơn cũ (trả cùng ngày hóa đơn phát hành)
  return movements.reduce((sum, m) => {
    const day = toVnDate(m.date);
    return day < date || (day === date && m.delta > 0) ? sum + m.delta : sum;
  }, 0);
}

/** Phần trả góp chưa tới hạn (sau `after`) của các khoản mua trước / trong ngày `purchasedBy` */
function installmentsNotDue(
  plans: readonly InstallmentPlan[],
  after: DateString,
  purchasedBy: DateString,
) {
  return plans
    .filter((p) => p.purchaseDate <= purchasedBy)
    .reduce((sum, p) => sum + p.amount * p.dueDates.filter((d) => d > after).length, 0);
}

export function computeCreditStatus({
  today,
  creditLimit,
  statementDay,
  dueDay,
  movements,
  installments = [],
}: CreditInput): CreditStatus {
  const balance = movements.reduce((sum, m) => sum + m.delta, 0);
  const owed = Math.max(0, -balance);
  const available = creditLimit ? creditLimit - owed : null;
  const utilization = creditLimit ? Math.min(1, owed / creditLimit) : null;
  const installmentRemaining = installmentsNotDue(installments, today, today);

  if (!statementDay || !dueDay) {
    return { owed, available, utilization, installmentRemaining, current: null, next: null };
  }

  const closeDate = lastCloseDate(today, statementDay);
  const dueDate = dueDateAfter(closeDate, dueDay);
  const statementBalance = Math.max(0, -balanceBefore(movements, closeDate));
  const paid = movements
    .filter((m) => toVnDate(m.date) > closeDate && m.delta > 0)
    .reduce((sum, m) => sum + m.delta, 0);
  const notDue = installmentsNotDue(installments, dueDate, closeDate);
  const dueAmount = Math.max(0, statementBalance - notDue - paid);

  const nextClose = dayOfMonth(addMonths(dayOfMonth(closeDate, 1), 1), statementDay);
  const nextDue = dueDateAfter(nextClose, dueDay);
  const estimatedAmount = Math.max(
    0,
    owed - dueAmount - installmentsNotDue(installments, nextDue, today),
  );

  return {
    owed,
    available,
    utilization,
    installmentRemaining,
    current: {
      closeDate,
      dueDate,
      statementBalance,
      paid,
      dueAmount,
      daysUntilDue: diffDays(today, dueDate),
      overdue: today > dueDate && dueAmount > 0,
    },
    next: { closeDate: nextClose, dueDate: nextDue, estimatedAmount },
  };
}

/** Tính số tiền mỗi kỳ trả góp: (giá + phí mỗi tháng × số kỳ) / số kỳ, làm tròn lên đồng */
export function installmentAmounts(price: number, months: number, monthlyFee: number) {
  const total = price + monthlyFee * months;
  return { total, perMonth: Math.ceil(total / months), fee: monthlyFee * months };
}

/** Ngày chốt của kỳ chứa `date`: ngày chốt đầu tiên SAU `date` (mua đúng ngày chốt → kỳ sau) */
export function closeDateOnOrAfter(date: DateString, statementDay: number): DateString {
  const thisMonth = dayOfMonth(date, statementDay);
  return thisMonth > date ? thisMonth : dayOfMonth(addMonths(dayOfMonth(date, 1), 1), statementDay);
}

/**
 * Hạn trả kỳ góp đầu tiên của khoản mua ngày `purchaseDate`: hạn thanh toán của kỳ sao kê chứa
 * ngày mua. Ví chưa cài ngày chốt / hạn → một tháng sau ngày mua.
 */
export function firstInstallmentDue(
  purchaseDate: DateString,
  statementDay?: number | null,
  dueDay?: number | null,
): DateString {
  if (!statementDay || !dueDay) return addMonths(purchaseDate, 1);
  return dueDateAfter(closeDateOnOrAfter(purchaseDate, statementDay), dueDay);
}
