// Chữ hiển thị dùng chung cho các màn Sổ nợ.
import type { DebtDirection, DebtRecordType } from '@/db/schema';
import { formatDate } from '@/lib/date';

import type { DebtItem } from '../queries';

export const DIRECTION_LABEL: Record<DebtDirection, string> = {
  lent: 'Tôi cho vay',
  borrowed: 'Tôi đi vay',
};

/** Tên hành động theo chiều nợ: cho vay thì "Nhận trả", đi vay thì "Trả nợ" */
export function recordLabel(direction: DebtDirection, type: DebtRecordType): string {
  const lent = direction === 'lent';
  if (type === 'repay') return lent ? 'Nhận trả' : 'Trả nợ';
  if (type === 'increase') return lent ? 'Cho vay thêm' : 'Vay thêm';
  return 'Tính lãi';
}

export function statusText(item: Pick<DebtItem, 'status' | 'daysToDue' | 'debt'>): string {
  const { status, daysToDue, debt } = item;
  switch (status) {
    case 'closed':
      return 'Đã đóng';
    case 'settled':
      return 'Đã xong';
    case 'overdue':
      return `Quá hạn ${-(daysToDue ?? 0)} ngày`;
    case 'due-soon':
      return daysToDue === 0 ? 'Hạn hôm nay' : `Còn ${daysToDue} ngày`;
    default:
      return debt.dueDate ? `Hạn ${formatDate(debt.dueDate, false)}` : 'Không đặt hạn';
  }
}
