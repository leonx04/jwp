// Ngân sách — hàm thuần: % đã dùng, trạng thái, còn được tiêu mỗi ngày, dự báo vượt theo tốc độ chi.
import { diffDays, type DateString } from '@/lib/date';

/** Từ mức này trở lên thì cảnh báo "sắp hết" */
export const WARN_RATIO = 0.8;

export type BudgetState = 'ok' | 'warning' | 'over';

export type BudgetProgress = {
  amount: number;
  spent: number;
  /** Còn lại (có thể âm khi vượt) */
  remaining: number;
  /** 0..n (có thể > 1 khi vượt) */
  ratio: number;
  state: BudgetState;
  /** Số ngày còn lại của kỳ, tính cả hôm nay (≥ 1) */
  daysLeft: number;
  /** Mỗi ngày còn được tiêu tối đa bao nhiêu để không vượt (0 nếu đã vượt) */
  perDay: number;
  /** Dự báo tổng chi cuối kỳ nếu giữ nguyên tốc độ chi từ đầu kỳ */
  projected: number;
  /** Với tốc độ hiện tại sẽ vượt hạn mức trước khi hết kỳ */
  willExceed: boolean;
};

export function budgetProgress(args: {
  amount: number;
  spent: number;
  today: DateString;
  periodStart: DateString;
  periodEnd: DateString;
}): BudgetProgress {
  const { amount, spent, today, periodStart, periodEnd } = args;
  const totalDays = Math.max(1, diffDays(periodStart, periodEnd) + 1);
  const elapsed = Math.min(totalDays, Math.max(1, diffDays(periodStart, today) + 1));
  const daysLeft = Math.max(1, diffDays(today, periodEnd) + 1);
  const remaining = amount - spent;
  const ratio = amount > 0 ? spent / amount : spent > 0 ? Infinity : 0;
  const state: BudgetState = spent > amount ? 'over' : ratio >= WARN_RATIO ? 'warning' : 'ok';
  // Chỉ nhân lên theo tốc độ chi khi đã qua ít nhất 3 ngày (đầu kỳ số liệu quá ít, dự báo vô nghĩa)
  const projected = elapsed >= 3 ? Math.floor((spent * totalDays) / elapsed) : spent;
  return {
    amount,
    spent,
    remaining,
    ratio,
    state,
    daysLeft,
    perDay: remaining > 0 ? Math.floor(remaining / daysLeft) : 0,
    projected,
    willExceed: state !== 'over' && projected > amount,
  };
}

/** Danh sách id lưu dạng "a,b,c" → mảng (trống = không lọc) */
export function parseIdList(serialized: string | null | undefined): string[] {
  return (serialized ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const serializeIdList = (ids: readonly string[]): string | null =>
  ids.length ? [...new Set(ids)].join(',') : null;
