// Quỹ dự phòng: số dư hiện có đủ sống bao nhiêu tháng theo chi tiêu trung bình.
export type Runway = {
  /** Số tháng (làm tròn xuống 1 số lẻ) */
  months: number;
  level: 'low' | 'ok' | 'good';
};

/** < 3 tháng: thấp · 3–6 tháng: tạm ổn · ≥ 6 tháng: tốt (khuyến nghị phổ biến 3–6 tháng chi tiêu) */
export function runwayMonths(balance: number, monthlyExpense: number): Runway | null {
  if (monthlyExpense <= 0) return null;
  const months = Math.max(0, Math.floor((balance / monthlyExpense) * 10) / 10);
  return { months, level: months < 3 ? 'low' : months < 6 ? 'ok' : 'good' };
}
