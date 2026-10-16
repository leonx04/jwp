// Phân bổ lương: tổng hạn mức các ngân sách chiếm bao nhiêu phần thu nhập, còn bao nhiêu chưa phân bổ.
export type Allocation = {
  /** Tổng hạn mức các ngân sách (đồng / tháng) */
  total: number;
  income: number;
  /** total / income (có thể > 1 khi hứa chi nhiều hơn thu) */
  ratio: number;
  /** Phần thu nhập chưa gán cho ngân sách nào (âm khi phân bổ vượt thu nhập) */
  free: number;
  over: boolean;
};

/** Thu nhập chưa biết (≤ 0) → null: không đủ dữ liệu để so */
export function allocationSummary(total: number, income: number | null): Allocation | null {
  if (!income || income <= 0) return null;
  return { total, income, ratio: total / income, free: income - total, over: total > income };
}
