// Trạng thái "trả góp" trong màn thêm / sửa giao dịch + hàm lưu kèm giao dịch.
import { and, eq } from 'drizzle-orm';

import { schedules } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { toVnDate } from '@/lib/date';

import { removeInstallmentPlans, saveInstallmentPlan } from '../repository';
import { installmentAmounts } from '../statement';

export type InstallmentValue = {
  months: number;
  /** Phí chuyển đổi trả góp mỗi tháng (đồng) */
  monthlyFee: number;
};

export const INSTALLMENT_MONTHS = [3, 6, 9, 12, 24] as const;

export const DEFAULT_INSTALLMENT: InstallmentValue = { months: 6, monthlyFee: 0 };

/**
 * Số tiền ghi cho khoản chi: không trả góp → đúng giá nhập; có trả góp → tổng (giá + phí × số kỳ).
 */
export function installmentToSave(
  value: InstallmentValue | null,
  price: number,
): { amount: number; perMonth: number | null } {
  if (!value) return { amount: price, perMonth: null };
  const { total, perMonth } = installmentAmounts(price, value.months, value.monthlyFee);
  return { amount: total, perMonth };
}

/**
 * Khi mở lại giao dịch đã có kế hoạch trả góp: số kỳ lấy từ lịch, phí coi như 0 (tổng đã gồm phí
 * nằm trong số tiền giao dịch → số tiền mỗi kỳ giữ nguyên).
 */
export function loadInstallmentDraft(
  db: AppDatabase,
  transactionId: string,
): InstallmentValue | null {
  const plan = db
    .select({ months: schedules.endCount })
    .from(schedules)
    .where(and(eq(schedules.kind, 'installment'), eq(schedules.linkTransactionId, transactionId)))
    .get();
  return plan ? { months: plan.months ?? DEFAULT_INSTALLMENT.months, monthlyFee: 0 } : null;
}

/**
 * Gọi NGAY SAU saveTransaction: tạo / thay kế hoạch trả góp, hoặc xoá kế hoạch cũ khi đã tắt trả góp.
 * `value` phải là null nếu giao dịch không phải khoản chi từ ví trả sau.
 */
export function applyInstallment(
  db: AppDatabase,
  {
    transactionId,
    accountId,
    title,
    date,
    price,
    value,
  }: {
    transactionId: string;
    accountId: string;
    title: string;
    /** Thời điểm mua (ms) */
    date: number;
    /** Giá nhập trong editor (chưa gồm phí) */
    price: number;
    value: InstallmentValue | null;
  },
): void {
  const { perMonth } = installmentToSave(value, price);
  if (!value || perMonth == null) {
    removeInstallmentPlans(db, transactionId);
    return;
  }
  saveInstallmentPlan(db, {
    transactionId,
    accountId,
    title: title.trim() || 'Trả góp',
    purchaseDate: toVnDate(date),
    months: value.months,
    perMonth,
  });
}
