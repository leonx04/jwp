import { saveAccount } from '@/features/accounts/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { goalProgress } from './compute';
import { listGoals } from './queries';
import { deleteGoal, saveGoal } from './repository';

const TODAY = '2026-10-12';

describe('goalProgress', () => {
  it('cần góp mỗi tháng đến hạn (làm tròn lên để không thiếu)', () => {
    const p = goalProgress({
      target: 10_000_000,
      saved: 1_000_000,
      deadline: '2027-01-10',
      today: TODAY,
    });
    expect(p.remaining).toBe(9_000_000);
    expect(p.daysLeft).toBe(90);
    expect(p.monthsLeft).toBe(3);
    expect(p.perMonth).toBe(3_000_000);
    expect(p.ratio).toBeCloseTo(0.1);
    expect(p.overdue).toBe(false);
  });

  it('không chia hết thì làm tròn lên', () => {
    const p = goalProgress({ target: 1_000_000, saved: 0, deadline: '2026-12-11', today: TODAY });
    expect(p.monthsLeft).toBe(2);
    expect(p.perMonth).toBe(500_000);
    const q = goalProgress({ target: 1_000_001, saved: 0, deadline: '2026-12-11', today: TODAY });
    expect(q.perMonth).toBe(500_001);
  });

  it('đã đạt / quá hạn / không đặt hạn', () => {
    expect(goalProgress({ target: 100, saved: 150, deadline: null, today: TODAY })).toMatchObject({
      done: true,
      remaining: 0,
      ratio: 1,
      perMonth: null,
    });
    expect(
      goalProgress({ target: 100, saved: 10, deadline: '2026-10-01', today: TODAY }),
    ).toMatchObject({
      overdue: true,
      perMonth: null,
    });
    expect(goalProgress({ target: 100, saved: 10, deadline: null, today: TODAY })).toMatchObject({
      perMonth: null,
      monthsLeft: null,
    });
  });

  it('số dư âm tính là 0', () => {
    expect(goalProgress({ target: 100, saved: -50, deadline: null, today: TODAY }).saved).toBe(0);
  });
});

describe('goals repository', () => {
  it('quỹ gắn ví: tiến độ = số dư ví; nhập tay: dùng số đã góp', () => {
    const db = createTestDb();
    const fund = saveAccount(db, {
      name: 'Quỹ du lịch',
      color: '#0EA5E9',
      icon: 'airplane-outline',
      includeInBalance: false,
    });
    saveTransaction(db, {
      type: 'income',
      amount: 400_000,
      accountId: fund,
      date: vnDateToMs('2026-10-01', '12:00'),
    });
    saveGoal(db, {
      name: 'Đi Đà Lạt',
      targetAmount: 2_000_000,
      accountId: fund,
      color: '#0EA5E9',
      deadline: '2026-12-31',
    });
    saveGoal(db, {
      name: 'Mua máy ảnh',
      targetAmount: 5_000_000,
      savedAmount: 1_250_000,
      color: '#F59E0B',
    });

    const [dl, cam] = listGoals(db, TODAY);
    expect(dl.saved).toBe(400_000);
    expect(dl.accountName).toBe('Quỹ du lịch');
    expect(cam.saved).toBe(1_250_000);
    expect(cam.accountName).toBeNull();
  });

  it('gắn ví thì bỏ qua số nhập tay; sửa, xoá, kiểm tra dữ liệu', () => {
    const db = createTestDb();
    const w = saveAccount(db, {
      name: 'W',
      color: '#000',
      icon: 'wallet-outline',
      includeInBalance: true,
    });
    const id = saveGoal(db, {
      name: 'A',
      targetAmount: 100,
      accountId: w,
      savedAmount: 999,
      color: '#000',
    });
    expect(listGoals(db, TODAY)[0].goal.savedAmount).toBe(0);
    saveGoal(db, { id, name: 'A2', targetAmount: 200, color: '#000', savedAmount: 50 });
    expect(listGoals(db, TODAY)[0]).toMatchObject({ saved: 50, accountName: null });
    deleteGoal(db, id);
    expect(listGoals(db, TODAY)).toHaveLength(0);
    expect(() => saveGoal(db, { name: '', targetAmount: 5, color: '#000' })).toThrow();
    expect(() => saveGoal(db, { name: 'x', targetAmount: 0, color: '#000' })).toThrow();
  });
});
