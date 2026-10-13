// Quỹ / mục tiêu tiết kiệm — hàm thuần: tiến độ, còn thiếu, cần góp mỗi tháng đến hạn.
import { diffDays, type DateString } from '@/lib/date';

export type GoalProgress = {
  target: number;
  /** Số đã có (không âm) */
  saved: number;
  /** Còn thiếu (0 khi đã đạt) */
  remaining: number;
  /** 0..1 */
  ratio: number;
  done: boolean;
  /** Số ngày tới hạn (âm = đã quá hạn), null nếu không đặt hạn */
  daysLeft: number | null;
  /** Số tháng còn lại để chia đều (≥ 1), null nếu không đặt hạn hoặc đã xong */
  monthsLeft: number | null;
  /** Cần góp mỗi tháng để kịp hạn (làm tròn lên để không thiếu), null nếu không áp dụng */
  perMonth: number | null;
  /** Quá hạn mà chưa đạt */
  overdue: boolean;
};

export function goalProgress(args: {
  target: number;
  saved: number;
  deadline: DateString | null;
  today: DateString;
}): GoalProgress {
  const { target, deadline, today } = args;
  const saved = Math.max(0, args.saved);
  const remaining = Math.max(0, target - saved);
  const done = saved >= target;
  const daysLeft = deadline ? diffDays(today, deadline) : null;
  const overdue = !done && daysLeft != null && daysLeft < 0;
  const monthsLeft =
    done || daysLeft == null ? null : Math.max(1, Math.ceil(Math.max(daysLeft, 0) / 30));
  return {
    target,
    saved,
    remaining,
    ratio: target > 0 ? Math.min(1, saved / target) : 0,
    done,
    daysLeft,
    monthsLeft,
    perMonth: monthsLeft && !overdue ? Math.ceil(remaining / monthsLeft) : null,
    overdue,
  };
}
