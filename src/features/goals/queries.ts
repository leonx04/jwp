import type { AppDatabase } from '@/db/types';
import type { Goal } from '@/db/schema';
import { getAccountBalances } from '@/features/accounts/queries';
import type { DateString } from '@/lib/date';

import { goalProgress, type GoalProgress } from './compute';
import { listGoalRows } from './repository';

export type GoalItem = GoalProgress & {
  goal: Goal;
  /** Tên ví làm quỹ (nếu gắn ví) */
  accountName: string | null;
};

export function listGoals(db: AppDatabase, today: DateString): GoalItem[] {
  const balances = new Map(getAccountBalances(db).map((a) => [a.id, a]));
  return listGoalRows(db).map((goal) => {
    const account = goal.accountId ? balances.get(goal.accountId) : undefined;
    const saved = account ? account.balance : goal.savedAmount;
    return {
      goal,
      accountName: account?.name ?? null,
      ...goalProgress({
        target: goal.targetAmount,
        saved,
        deadline: goal.deadline,
        today,
      }),
    };
  });
}
