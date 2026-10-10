// Tính số dư bằng TypeScript thuần (dùng cho màn xem trước import, và để đối chiếu với SQL).
// Công thức PHẢI giống getAccountBalances (SQL): thu + nhận chuyển − chi − chuyển đi.
import type { TransactionType } from '@/db/schema';

type BalanceTx = {
  type: TransactionType;
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  toAmount?: number | null;
};

export function computeBalances(
  accountIds: readonly string[],
  transactions: readonly BalanceTx[],
): Map<string, number> {
  const balances = new Map(accountIds.map((id) => [id, 0]));
  const add = (id: string, delta: number) => balances.set(id, (balances.get(id) ?? 0) + delta);
  for (const tx of transactions) {
    if (tx.type === 'income') add(tx.accountId, tx.amount);
    else add(tx.accountId, -tx.amount);
    if (tx.type === 'transfer' && tx.toAccountId) add(tx.toAccountId, tx.toAmount ?? tx.amount);
  }
  return balances;
}
