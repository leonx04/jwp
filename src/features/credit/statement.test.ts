import { vnDateToMs } from '@/lib/date';

import {
  computeCreditStatus,
  dueDateAfter,
  installmentAmounts,
  lastCloseDate,
  type AccountMovement,
} from './statement';

const m = (date: string, delta: number): AccountMovement => ({ date: vnDateToMs(date, '12:00'), delta });

describe('chu kỳ sao kê', () => {
  it.each([
    ['2026-10-11', 31, '2026-09-30'],
    ['2026-10-31', 31, '2026-10-31'],
    ['2026-10-11', 25, '2026-09-25'],
    ['2026-10-26', 25, '2026-10-25'],
    ['2026-03-15', 31, '2026-02-28'],
  ])('hôm nay %s, chốt ngày %d → %s', (today, day, expected) => {
    expect(lastCloseDate(today, day)).toBe(expected);
  });

  it.each([
    ['2026-09-30', 10, '2026-10-10'],
    ['2026-09-25', 10, '2026-10-10'],
    ['2026-10-01', 15, '2026-10-15'],
  ])('chốt %s, hạn ngày %d → %s', (close, day, expected) => {
    expect(dueDateAfter(close, day)).toBe(expected);
  });
});

describe('SPayLater: chốt cuối tháng, hạn ngày 10', () => {
  const base = { statementDay: 31, dueDay: 10, creditLimit: 5_000_000 };

  it('mua tháng 9, chưa trả: kỳ này cần trả đủ, mua tháng 10 sang kỳ sau', () => {
    const movements = [m('2026-09-05', -300_000), m('2026-09-20', -1_196_000), m('2026-10-03', -250_000)];
    const s = computeCreditStatus({ ...base, today: '2026-10-05', movements });
    expect(s.owed).toBe(1_746_000);
    expect(s.available).toBe(3_254_000);
    expect(s.current).toMatchObject({
      closeDate: '2026-09-30',
      dueDate: '2026-10-10',
      statementBalance: 1_496_000,
      dueAmount: 1_496_000,
      daysUntilDue: 5,
      overdue: false,
    });
    expect(s.next).toEqual({ closeDate: '2026-10-31', dueDate: '2026-11-10', estimatedAmount: 250_000 });
  });

  it('trả một phần rồi trả hết', () => {
    const movements = [m('2026-09-20', -1_496_000), m('2026-10-06', 1_000_000)];
    expect(computeCreditStatus({ ...base, today: '2026-10-07', movements }).current!.dueAmount).toBe(496_000);
    movements.push(m('2026-10-09', 496_000));
    const s = computeCreditStatus({ ...base, today: '2026-10-09', movements });
    expect(s.current!.dueAmount).toBe(0);
    expect(s.owed).toBe(0);
  });

  it('quá hạn nếu qua ngày 10 mà chưa trả', () => {
    const s = computeCreditStatus({ ...base, today: '2026-10-12', movements: [m('2026-09-20', -500_000)] });
    expect(s.current).toMatchObject({ overdue: true, dueAmount: 500_000, daysUntilDue: -2 });
  });

  it('mua trả góp 6 kỳ: chỉ phần đến hạn mới phải trả', () => {
    const { total, perMonth } = installmentAmounts(3_000_000, 6, 59_000);
    expect(total).toBe(3_354_000);
    expect(perMonth).toBe(559_000);
    const plan = {
      purchaseDate: '2026-09-15',
      amount: perMonth,
      dueDates: ['2026-10-10', '2026-11-10', '2026-12-10', '2027-01-10', '2027-02-10', '2027-03-10'],
    };
    const s = computeCreditStatus({
      ...base,
      today: '2026-10-05',
      movements: [m('2026-09-15', -total), m('2026-09-28', -100_000)],
      installments: [plan],
    });
    // Kỳ này: 1 kỳ góp 559.000 + món lẻ 100.000
    expect(s.current!.dueAmount).toBe(659_000);
    expect(s.installmentRemaining).toBe(559_000 * 6);
    expect(s.next!.estimatedAmount).toBe(559_000);
  });

  it('ví không cài ngày chốt / hạn: chỉ có dư nợ và hạn mức', () => {
    const s = computeCreditStatus({ today: '2026-10-05', creditLimit: 2_000_000, movements: [m('2026-10-01', -500_000)] });
    expect(s).toMatchObject({ owed: 500_000, available: 1_500_000, utilization: 0.25, current: null });
  });
});
