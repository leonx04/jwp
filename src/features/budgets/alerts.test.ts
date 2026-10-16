import { budgetAlert } from './alerts';
import { budgetProgress } from './compute';
import type { BudgetItem } from './queries';

const item = (id: string, spent: number, amount = 1000): BudgetItem => ({
  id,
  name: `NS ${id}`,
  categoryIds: [],
  accountIds: [],
  startDay: null,
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  ...budgetProgress({
    amount,
    spent,
    today: '2026-10-10',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
  }),
});

describe('budgetAlert', () => {
  it('không cảnh báo khi vẫn trong mức an toàn', () => {
    expect(budgetAlert([item('a', 100)], [item('a', 300)])).toBeNull();
  });

  it('báo khi vừa chạm 80%', () => {
    const alert = budgetAlert([item('a', 700)], [item('a', 850)]);
    expect(alert?.over).toBe(false);
    expect(alert?.text).toContain('85%');
  });

  it('báo vượt và ưu tiên hơn cảnh báo sắp hết', () => {
    const alert = budgetAlert([item('a', 700), item('b', 900)], [item('a', 850), item('b', 1200)]);
    expect(alert?.over).toBe(true);
    expect(alert?.text).toContain('NS b');
  });

  it('đã ở trạng thái đó từ trước thì không báo lại', () => {
    expect(budgetAlert([item('a', 900)], [item('a', 950)])).toBeNull();
    expect(budgetAlert([item('a', 1100)], [item('a', 1200)])).toBeNull();
  });

  it('ngân sách mới tạo (chưa có bản trước) mà đã vượt thì báo', () => {
    expect(budgetAlert([], [item('a', 1500)])?.over).toBe(true);
  });
});
