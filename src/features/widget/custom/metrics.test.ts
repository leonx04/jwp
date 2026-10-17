import { saveAccount } from '@/features/accounts/repository';
import { saveBudget } from '@/features/budgets/repository';
import { saveCategory } from '@/features/categories/repository';
import { saveGoal } from '@/features/goals/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { DEFAULT_CONFIG, sanitizeConfig, type WidgetConfig } from './config';
import { rangeOf, resolveCard as resolveRaw } from './metrics';
import type { AppDatabase } from '@/db/types';

const NOW = vnDateToMs('2026-10-16', '10:00');
// Định dạng tiền dùng dấu cách không ngắt trước ký hiệu ₫ — so sánh sau khi đưa về dấu cách thường
const norm = (text: string) => text.replace(/\s/g, ' ');
const cfg = (patch: Partial<WidgetConfig>): WidgetConfig => ({ ...DEFAULT_CONFIG, ...patch });
function resolveCard(db: AppDatabase, config: WidgetConfig, now: number) {
  const c = resolveRaw(db, config, now);
  return { ...c, value: norm(c.value), short: norm(c.short), sub: norm(c.sub), rows: c.rows.map((r) => ({ ...r, value: norm(r.value) })) };
}

function setup() {
  const db = createTestDb();
  const cash = saveAccount(db, { name: 'Tiền mặt', color: '#000', icon: 'wallet', includeInBalance: true });
  const momo = saveAccount(db, { name: 'MoMo', color: '#000', icon: 'wallet', includeInBalance: true });
  const food = saveCategory(db, { name: 'Ăn uống', color: '#f00', icon: 'x' });
  const tx = (accountId: string, type: 'income' | 'expense', amount: number, day: string, title = 'x') =>
    saveTransaction(db, { type, amount, accountId, categoryId: type === 'expense' ? food : null, title, date: vnDateToMs(day, '12:00') });
  tx(cash, 'income', 10_000_000, '2026-10-01', 'Lương');
  tx(cash, 'expense', 200_000, '2026-10-10', 'Cafe');
  tx(momo, 'income', 500_000, '2026-10-05');
  tx(momo, 'expense', 100_000, '2026-10-15');
  return { db, cash, momo };
}

describe('sanitizeConfig', () => {
  it('thiếu / sai kiểu → dùng mặc định', () => {
    expect(sanitizeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(sanitizeConfig({ metric: 'bogus', palette: 5, accountIds: ['a', 7] }).metric).toBe('safe_today');
    expect(sanitizeConfig({ accountIds: ['a', 7, 'b'] }).accountIds).toEqual(['a', 'b']);
    expect(sanitizeConfig({ title: 'x'.repeat(50) }).title).toHaveLength(24);
  });
});

describe('resolveCard', () => {
  it('số dư: mọi ví hoặc đúng các ví đã chọn', () => {
    const { db, momo } = setup();
    expect(resolveCard(db, cfg({ metric: 'balance' }), NOW)).toMatchObject({ label: 'Tổng số dư', value: '10.200.000 ₫' });
    const one = resolveCard(db, cfg({ metric: 'balance', accountIds: [momo] }), NOW);
    expect(one).toMatchObject({ label: 'MoMo', value: '400.000 ₫' });
  });

  it('thu chi: kỳ tháng, chọn chi / thu / còn lại, lọc theo ví', () => {
    const { db, momo } = setup();
    expect(resolveCard(db, cfg({ metric: 'cashflow', cash: 'expense' }), NOW).value).toBe('300.000 ₫');
    expect(resolveCard(db, cfg({ metric: 'cashflow', cash: 'income' }), NOW).value).toBe('10.500.000 ₫');
    expect(resolveCard(db, cfg({ metric: 'cashflow', cash: 'net' }), NOW).value).toBe('10.200.000 ₫');
    expect(resolveCard(db, cfg({ metric: 'cashflow', cash: 'expense', accountIds: [momo] }), NOW).value).toBe('100.000 ₫');
    // hôm nay không có giao dịch
    expect(resolveCard(db, cfg({ metric: 'cashflow', cash: 'expense', period: 'today' }), NOW).value).toBe('0 ₫');
  });

  it('ngân sách (không giới hạn danh mục → tính mọi khoản chi): chỉ định hoặc cái sát hạn nhất', () => {
    const { db } = setup();
    const a = saveBudget(db, { name: 'Cafe', amount: 250_000 });
    saveBudget(db, { name: 'Du lịch', amount: 10_000_000 });
    expect(resolveCard(db, cfg({ metric: 'budget' }), NOW)).toMatchObject({ label: 'Cafe', tone: 'over' });
    expect(resolveCard(db, cfg({ metric: 'budget', budgetId: a }), NOW).rows.map((r) => r.label)).toEqual(['Du lịch']);
  });

  it('quỹ tiết kiệm: tiến độ nhập tay', () => {
    const { db } = setup();
    saveGoal(db, { name: 'Laptop', targetAmount: 10_000_000, savedAmount: 2_500_000, color: '#000' });
    const card = resolveCard(db, cfg({ metric: 'goal' }), NOW);
    expect(card).toMatchObject({ label: 'Laptop', value: '2.500.000 ₫', ratio: 0.25 });
  });

  it('chưa có dữ liệu → thẻ trống có lời nhắn, không lỗi', () => {
    const db = createTestDb();
    for (const metric of ['budget', 'goal', 'credit', 'upcoming', 'debt'] as const) {
      expect(resolveCard(db, cfg({ metric }), NOW).value).toBe('—');
    }
  });

  it('nhãn riêng thay nhãn tự động', () => {
    const { db } = setup();
    expect(resolveCard(db, cfg({ metric: 'balance', title: 'Quỹ nhà' }), NOW).label).toBe('Quỹ nhà');
  });
});

describe('rangeOf', () => {
  it('hôm nay / tuần / tháng', () => {
    const today = '2026-10-16';
    expect(rangeOf('today', today, 1)).toEqual({ from: vnDateToMs('2026-10-16'), to: vnDateToMs('2026-10-17') });
    expect(rangeOf('week', today, 1).from).toBe(vnDateToMs('2026-10-12'));
    expect(rangeOf('month', today, 17).from).toBe(vnDateToMs('2026-10-01'));
    // kỳ lương ngày 17: hôm nay 16/10 vẫn thuộc kỳ bắt đầu 17/9
    expect(rangeOf('cycle', today, 17).from).toBe(vnDateToMs('2026-09-17'));
  });
});
