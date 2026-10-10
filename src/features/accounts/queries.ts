import { sql } from 'drizzle-orm';

import type { Database } from '@/db';
import { accounts, transactions } from '@/db/schema';

export type AccountBalance = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  includeInBalance: boolean;
  balance: number;
};

/**
 * Số dư từng ví = Σ thu − Σ chi − Σ chuyển đi + Σ nhận chuyển đến (giống cách Ivy Wallet tính).
 * Ví không có "số dư ban đầu": muốn đặt số dư thì tạo giao dịch điều chỉnh.
 */
export async function getAccountBalances(db: Database): Promise<AccountBalance[]> {
  const rows = await db.all<{
    id: string;
    name: string;
    color: string;
    icon: string | null;
    include_in_balance: number;
    balance: number;
  }>(sql`
    SELECT a.id, a.name, a.color, a.icon, a.include_in_balance,
      COALESCE((
        SELECT SUM(CASE t.type WHEN 'income' THEN t.amount ELSE -t.amount END)
        FROM ${transactions} t WHERE t.account_id = a.id
      ), 0)
      + COALESCE((
        SELECT SUM(COALESCE(t.to_amount, t.amount))
        FROM ${transactions} t WHERE t.to_account_id = a.id
      ), 0) AS balance
    FROM ${accounts} a
    WHERE a.archived = 0
    ORDER BY a.order_num, a.name
  `);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    includeInBalance: row.include_in_balance === 1,
    balance: row.balance,
  }));
}

/** Tổng số dư các ví được tính vào tổng */
export function totalBalance(balances: readonly AccountBalance[]): number {
  return balances.reduce((sum, a) => (a.includeInBalance ? sum + a.balance : sum), 0);
}
