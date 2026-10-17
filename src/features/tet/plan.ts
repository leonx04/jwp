// Quỹ Tết & thưởng cuối năm: ngày Tết sắp tới, Tết năm ngoái bạn chi thêm bao nhiêu, và mỗi tháng cần để dành bao nhiêu
// cho kịp. Hàm thuần — test được.
import { addDays, diffDays, makeDate, toLunar, toVnDate, type DateString } from '@/lib/date';

/** Mùng 1 Tết (dương lịch) của năm dương lịch `year`, ví dụ 2027 → '2027-02-06' */
export function tetDateOfYear(year: number): DateString {
  // Mùng 1 Tết luôn rơi trong khoảng 21/1 – 21/2 dương lịch
  let day = makeDate(year, 1, 21);
  for (let i = 0; i <= 32; i++, day = addDays(day, 1)) {
    const l = toLunar(day);
    if (l.month === 1 && l.day === 1 && !l.leap) return day;
  }
  throw new Error(`Không tìm thấy Tết năm ${year}`);
}

/** Tết gần nhất chưa qua quá 7 ngày (qua rồi thì tính Tết năm sau) */
export function nextTet(today: DateString): DateString {
  const year = Number(today.slice(0, 4));
  const thisYear = tetDateOfYear(year);
  return diffDays(thisYear, today) <= 7 ? thisYear : tetDateOfYear(year + 1);
}

/** Các khoảng chi quanh Tết: 3 tuần trước đến 1 tuần sau */
const BEFORE_DAYS = 21;
const AFTER_DAYS = 7;
/** Cần ít nhất ngần này ngày lịch sử trước kỳ Tết để so với mức chi thường ngày */
const MIN_BASELINE_DAYS = 30;
const BASELINE_DAYS = 60;

export type DatedAmount = { date: number; amount: number };

/**
 * Tết trước bạn chi THÊM bao nhiêu so với ngày thường: tổng chi trong [Tết−21, Tết+7] trừ mức chi trung bình
 * mỗi ngày của 60 ngày trước đó nhân số ngày của kỳ Tết. Không đủ lịch sử → null.
 * `expenses`: các khoản chi thật (đã bỏ chuyển khoản, điều chỉnh số dư).
 */
export function estimateTetExtraSpend(
  expenses: readonly DatedAmount[],
  previousTet: DateString,
): { extra: number; total: number } | null {
  const start = addDays(previousTet, -BEFORE_DAYS);
  const end = addDays(previousTet, AFTER_DAYS);
  const baseEnd = addDays(start, -1);
  const baseStart = addDays(baseEnd, -(BASELINE_DAYS - 1));

  const inRange = (ms: number, from: DateString, to: DateString) => {
    const d = toVnDate(ms);
    return d >= from && d <= to;
  };
  const days = expenses.map((e) => toVnDate(e.date));
  if (!days.length || days.reduce((a, b) => (a < b ? a : b)) > addDays(baseEnd, -MIN_BASELINE_DAYS)) {
    return null;
  }
  const total = expenses.filter((e) => inRange(e.date, start, end)).reduce((s, e) => s + e.amount, 0);
  const baseline = expenses.filter((e) => inRange(e.date, baseStart, baseEnd)).reduce((s, e) => s + e.amount, 0);
  const perDay = baseline / BASELINE_DAYS;
  const windowDays = BEFORE_DAYS + AFTER_DAYS + 1;
  return { extra: Math.max(0, Math.round(total - perDay * windowDays)), total };
}

export type TetPlan = {
  /** Hạn có đủ tiền: 7 ngày trước Tết (để kịp mua sắm) */
  deadline: DateString;
  daysToTet: number;
  /** Số tháng chia đều (≥ 1) */
  monthsLeft: number;
  /** Cần có trong quỹ: chi dự kiến, trừ thưởng nếu tính thưởng */
  target: number;
  /** Còn thiếu so với phần đã có trong quỹ */
  remaining: number;
  /** Cần để dành mỗi tháng (làm tròn lên) */
  perMonth: number;
  /** Thưởng đủ trang trải hết chi phí */
  covered: boolean;
};

export function planTet(args: {
  today: DateString;
  tet: DateString;
  expectedSpend: number;
  expectedBonus: number;
  /** Có tính thưởng vào quỹ không (thưởng thường về sát Tết, nên có thể chọn không dựa vào) */
  countBonus: boolean;
  saved: number;
}): TetPlan {
  const deadline = addDays(args.tet, -7);
  const daysToTet = diffDays(args.today, args.tet);
  const daysToDeadline = Math.max(0, diffDays(args.today, deadline));
  const monthsLeft = Math.max(1, Math.ceil(daysToDeadline / 30));
  const target = Math.max(0, args.expectedSpend - (args.countBonus ? args.expectedBonus : 0));
  const remaining = Math.max(0, target - Math.max(0, args.saved));
  return {
    deadline,
    daysToTet,
    monthsLeft,
    target,
    remaining,
    perMonth: Math.ceil(remaining / monthsLeft),
    covered: args.countBonus && args.expectedBonus >= args.expectedSpend,
  };
}
