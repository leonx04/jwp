// Mô phỏng tăng lương (hàm thuần): thu / chi / tiền dư từng tháng khi lương đổi, so với khi giữ nguyên,
// và các quỹ tiết kiệm đạt mục tiêu sớm hơn bao lâu. Mọi giả định đều là tham số để người dùng chỉnh.
import { addMonths, makeDate, parseDate, type DateString } from '@/lib/date';

export type ProjectionInput = {
  today: DateString;
  /** Thu nhập trung bình mỗi tháng hiện tại (đồng) */
  currentIncome: number;
  /** Lương / thu nhập mới mỗi tháng sau khi tăng */
  newIncome: number;
  /** Tháng bắt đầu nhận mức mới (mọi ngày trong tháng đều được, chỉ lấy tháng) */
  effectiveFrom: DateString;
  /** Chi tiêu trung bình mỗi tháng hiện tại */
  currentExpense: number;
  /** 0–1: phần tiền tăng thêm bạn sẽ tiêu thêm ("lối sống nâng cấp"); phần còn lại để dành */
  extraSpendRatio: number;
  /** % tăng thêm mỗi năm sau mốc tăng đầu tiên (0 = không tăng nữa) */
  yearlyRaisePct?: number;
  /** Lạm phát chi tiêu % mỗi năm áp cho cả hai kịch bản (mặc định 0) */
  yearlyInflationPct?: number;
  /** Số tháng mô phỏng (mặc định 12) */
  months?: number;
  /** Quỹ tiết kiệm còn thiếu bao nhiêu để đạt mục tiêu */
  goals?: readonly { id: string; name: string; remaining: number }[];
};

export type ProjectionMonth = {
  /** 'YYYY-MM' */
  month: string;
  baseIncome: number;
  income: number;
  baseExpense: number;
  expense: number;
  baseSurplus: number;
  surplus: number;
  /** Tiền dư cộng dồn từ tháng đầu đến hết tháng này */
  baseSaved: number;
  saved: number;
};

export type GoalEta = {
  id: string;
  name: string;
  remaining: number;
  /** Số tháng để đủ tiền nếu dồn toàn bộ tiền dư vào quỹ này; null = không bao giờ (tiền dư ≤ 0) hoặc quá 10 năm */
  baseMonths: number | null;
  months: number | null;
  /** Sớm hơn bao nhiêu tháng (null nếu một trong hai không xác định) */
  monthsEarlier: number | null;
};

export type Projection = {
  months: ProjectionMonth[];
  /** Lương mới hơn lương cũ bao nhiêu mỗi tháng */
  monthlyRaise: number;
  /** Tiền dư tăng thêm mỗi tháng so với không tăng lương (từ tháng có hiệu lực, đã trừ phần chi thêm) */
  extraSurplusPerMonth: number;
  /** Tổng tiền để dành thêm trong cả giai đoạn */
  totalExtraSaved: number;
  /** Tỷ lệ tiết kiệm (tiền dư / thu nhập), tháng cuối */
  baseSavingRate: number;
  savingRate: number;
  goals: GoalEta[];
};

const MAX_GOAL_MONTHS = 120;

const monthKey = (date: DateString) => date.slice(0, 7);

/** Số tháng từ 'YYYY-MM' a tới b (b ≥ a) */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

/** Bao nhiêu tháng để cộng dồn đủ `remaining`; tháng ngoài khoảng mô phỏng lấy theo tháng cuối */
function monthsUntil(remaining: number, surplusAt: (index: number) => number): number | null {
  if (remaining <= 0) return 0;
  let saved = 0;
  for (let i = 0; i < MAX_GOAL_MONTHS; i++) {
    saved += Math.max(0, surplusAt(i));
    if (saved >= remaining) return i + 1;
  }
  return null;
}

export function projectSalary(input: ProjectionInput): Projection {
  const horizon = input.months ?? 12;
  const growth = 1 + (input.yearlyRaisePct ?? 0) / 100;
  const inflation = 1 + (input.yearlyInflationPct ?? 0) / 100;
  const ratio = Math.min(1, Math.max(0, input.extraSpendRatio));
  const effective = monthKey(input.effectiveFrom);

  const start = parseDate(input.today);
  const firstOfMonth = makeDate(start.year, start.month, 1);
  const rows: ProjectionMonth[] = [];
  let baseSaved = 0;
  let saved = 0;

  for (let i = 0; i < horizon; i++) {
    const key = monthKey(addMonths(firstOfMonth, i));
    const baseExpense = Math.round(input.currentExpense * inflation ** Math.floor(i / 12));
    const baseIncome = input.currentIncome;
    // Mỗi năm sau mốc tăng đầu tiên, thu nhập tăng thêm yearlyRaisePct%
    const income =
      key < effective
        ? baseIncome
        : Math.round(input.newIncome * growth ** Math.floor(monthsBetween(effective, key) / 12));
    const extraIncome = Math.max(0, income - baseIncome);
    const expense = baseExpense + Math.round(extraIncome * ratio);
    const baseSurplus = baseIncome - baseExpense;
    const surplus = income - expense;
    baseSaved += baseSurplus;
    saved += surplus;
    rows.push({
      month: key,
      baseIncome,
      income,
      baseExpense,
      expense,
      baseSurplus,
      surplus,
      baseSaved,
      saved,
    });
  }

  const last = rows[rows.length - 1];
  const firstRaised = rows.find((r) => r.month >= effective) ?? last;
  const at = (i: number) => rows[Math.min(i, rows.length - 1)];
  const goals: GoalEta[] = (input.goals ?? [])
    .filter((g) => g.remaining > 0)
    .map((g) => {
      const baseMonths = monthsUntil(g.remaining, (i) => at(i).baseSurplus);
      const months = monthsUntil(g.remaining, (i) => at(i).surplus);
      return {
        id: g.id,
        name: g.name,
        remaining: g.remaining,
        baseMonths,
        months,
        monthsEarlier: baseMonths != null && months != null ? baseMonths - months : null,
      };
    });

  return {
    months: rows,
    monthlyRaise: Math.max(0, input.newIncome - input.currentIncome),
    extraSurplusPerMonth: firstRaised ? firstRaised.surplus - firstRaised.baseSurplus : 0,
    totalExtraSaved: last ? last.saved - last.baseSaved : 0,
    baseSavingRate: last && last.baseIncome > 0 ? last.baseSurplus / last.baseIncome : 0,
    savingRate: last && last.income > 0 ? last.surplus / last.income : 0,
    goals,
  };
}
