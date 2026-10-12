// Đọc "đã tiêu hôm nay" từ DB cho thẻ Hôm nay / báo cáo buổi sáng.
import { sql } from 'drizzle-orm';

import { accounts, schedules, transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { addDays, vnDateToMs, type DateString } from '@/lib/date';

import type { TodaySpending } from './compute';

/**
 * Khoản chi trong ngày `day` (giờ VN), KHÔNG tính:
 * - khoản trả theo lịch (đã nằm trong các khoản phải trả của dự báo),
 * - điều chỉnh số dư, sổ nợ, chuyển khoản,
 * - chi từ ví không tính vào tổng mà cũng không phải ví trả sau (quỹ riêng).
 * Mua trả góp chỉ tính số tiền một kỳ.
 */
export function getDaySpending(db: AppDatabase, day: DateString): TodaySpending {
  const from = vnDateToMs(day);
  const to = vnDateToMs(addDays(day, 1));
  const row = db.get<{ spent: number | null; balanceEffect: number | null }>(sql`
    select
      sum(case when a.include_in_balance = 1 or a.is_credit = 1
        then coalesce((
          select s.amount from ${schedules} s
          where s.kind = 'installment' and s.link_transaction_id = t.id
          limit 1
        ), t.amount)
        else 0 end) as spent,
      sum(case when a.include_in_balance = 1 then t.amount else 0 end) as balanceEffect
    from ${transactions} t
    join ${accounts} a on a.id = t.account_id
    where t.type = 'expense'
      and t.date >= ${from} and t.date < ${to}
      and t.schedule_id is null
      and t.is_adjustment = 0
      and t.debt_id is null
  `);
  return { spent: row?.spent ?? 0, balanceEffect: row?.balanceEffect ?? 0 };
}
