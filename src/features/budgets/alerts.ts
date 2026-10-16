// Cảnh báo ngân sách ngay sau khi lưu một khoản chi: so trạng thái trước / sau.
import { t } from '@/lib/i18n';
import type { AppDatabase } from '@/db/types';
import { getSettings } from '@/features/settings/store';
import { todayVn } from '@/lib/date';
import { formatMoney } from '@/lib/money';

import { listBudgets, type BudgetItem } from './queries';

/** Ảnh chụp tiến độ mọi ngân sách ở thời điểm hiện tại (dùng trước và sau khi lưu giao dịch) */
export function budgetSnapshot(db: AppDatabase): BudgetItem[] {
  return listBudgets(db, { today: todayVn(), startDayOfMonth: getSettings().startDayOfMonth });
}

export type BudgetAlert = { text: string; over: boolean };

/** Ngân sách vừa chuyển sang "sắp hết" (≥ 80%) hoặc "vượt" nhờ khoản chi vừa lưu. Vượt được ưu tiên. */
export function budgetAlert(
  before: readonly BudgetItem[],
  after: readonly BudgetItem[],
): BudgetAlert | null {
  const prev = new Map(before.map((b) => [b.id, b.state]));
  let warning: BudgetAlert | null = null;
  for (const b of after) {
    const was = prev.get(b.id) ?? 'ok';
    if (b.state === 'over' && was !== 'over') {
      return {
        over: true,
        text: t('Vượt ngân sách “{name}” {remaining}', {
          name: b.name,
          remaining: formatMoney(-b.remaining),
        }),
      };
    }
    if (b.state === 'warning' && was === 'ok') {
      warning = {
        over: false,
        text: t('Ngân sách “{name}” đã dùng {ratio}%, còn {remaining}', {
          name: b.name,
          ratio: Math.floor(b.ratio * 100),
          remaining: formatMoney(b.remaining),
        }),
      };
    }
  }
  return warning;
}
