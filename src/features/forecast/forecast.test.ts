import type { ScheduleOccurrence } from '@/db/schema';
import { expandOccurrences, type ScheduleLike } from '@/features/schedules/occurrences';

import { computeForecast } from './forecast';

const TODAY = '2026-10-11';

const schedule = (patch: Partial<ScheduleLike>): ScheduleLike => ({
  id: 'S',
  type: 'expense',
  amount: 1_000_000,
  accountId: 'MB',
  toAccountId: null,
  categoryId: null,
  title: '',
  startDate: '2026-08-19',
  frequency: 'monthly',
  interval: 1,
  weekdays: null,
  monthDay: null,
  weekendRule: 'none',
  endType: 'never',
  endDate: null,
  endCount: null,
  active: true,
  isEstimate: false,
  autoPost: false,
  remindDaysBefore: 1,
  remindTime: '09:00',
  ...patch,
});

const occ = (
  patch: Partial<ScheduleOccurrence> &
    Pick<ScheduleOccurrence, 'scheduleId' | 'dueDate' | 'status'>,
): ScheduleOccurrence => ({
  newDate: null,
  amount: null,
  transactionId: null,
  updatedAt: 0,
  ...patch,
});

describe('mở rộng kỳ của lịch', () => {
  const rent = schedule({
    id: 'RENT',
    title: 'Tiền nhà',
    amount: 3_000_000,
    startDate: '2026-08-19',
  });

  it('kỳ đã trả, bỏ qua, quá hạn, đến hạn, sắp tới', () => {
    const overrides = [
      occ({
        scheduleId: 'RENT',
        dueDate: '2026-08-19',
        status: 'paid',
        transactionId: 'T1',
        amount: 2_500_000,
      }),
    ];
    // 19/09 chưa xử lý → quá hạn; 19/10, 19/11 sắp tới
    const list = expandOccurrences([rent], overrides, {
      from: TODAY,
      to: '2026-11-30',
      today: TODAY,
    });
    expect(list.map((o) => [o.date, o.status])).toEqual([
      ['2026-09-19', 'overdue'],
      ['2026-10-19', 'upcoming'],
      ['2026-11-19', 'upcoming'],
    ]);
    const withResolved = expandOccurrences([rent], overrides, {
      from: '2026-08-01',
      to: '2026-08-31',
      today: TODAY,
      includeResolved: true,
    });
    expect(withResolved[0]).toMatchObject({
      status: 'paid',
      amount: 2_500_000,
      transactionId: 'T1',
    });
  });

  it('dời ngày: kỳ 19/10 dời sang 25/10; kỳ hôm nay = đến hạn', () => {
    const overrides = [
      occ({ scheduleId: 'RENT', dueDate: '2026-08-19', status: 'paid' }),
      occ({ scheduleId: 'RENT', dueDate: '2026-09-19', status: 'skipped' }),
      occ({
        scheduleId: 'RENT',
        dueDate: '2026-10-19',
        status: 'rescheduled',
        newDate: '2026-10-25',
      }),
    ];
    const list = expandOccurrences(
      [rent, schedule({ id: 'NOW', startDate: TODAY, frequency: 'once' })],
      overrides,
      {
        from: TODAY,
        to: '2026-10-31',
        today: TODAY,
      },
    );
    expect(list.map((o) => [o.scheduleId, o.dueDate, o.date, o.status])).toEqual([
      ['NOW', TODAY, TODAY, 'due'],
      ['RENT', '2026-10-19', '2026-10-25', 'upcoming'],
    ]);
  });

  it('lịch đã ngừng không sinh kỳ', () => {
    expect(
      expandOccurrences([schedule({ active: false })], [], {
        from: TODAY,
        to: '2027-01-01',
        today: TODAY,
      }),
    ).toEqual([]);
  });
});

describe('dự trù dòng tiền', () => {
  // Đúng tình huống dữ liệu thật: số dư 173.614 ₫, chưa có lịch nhận lương
  const real = [
    schedule({ id: 'A', amount: 3_000_000, startDate: '2026-10-19' }),
    schedule({ id: 'B', amount: 1_496_000, startDate: '2026-10-20' }),
    schedule({ id: 'C', amount: 1_000_000, startDate: '2026-10-22', frequency: 'once' }),
    schedule({ id: 'D', amount: 300_000, startDate: '2026-10-22' }),
    schedule({ id: 'E', amount: 1_131_000, startDate: '2026-10-28' }),
  ];

  it('khớp bảng ví dụ trong plan: âm 2.826.386 ₫ ngày 19/10, còn −6.753.386 ₫ ngày 28/10', () => {
    const occurrences = expandOccurrences(real, [], {
      from: TODAY,
      to: '2026-11-10',
      today: TODAY,
    });
    const f = computeForecast({ today: TODAY, days: 30, startBalance: 173_614, occurrences });
    const at = (date: string) => f.points.find((p) => p.date === date)!.balance;
    expect(at('2026-10-19')).toBe(-2_826_386);
    expect(at('2026-10-20')).toBe(-4_322_386);
    expect(at('2026-10-22')).toBe(-5_622_386);
    expect(at('2026-10-28')).toBe(-6_753_386);
    expect(f.firstNegative).toEqual({ date: '2026-10-19', balance: -2_826_386 });
    expect(f.nextIncome).toBeNull();
    expect(f.safeDailySpend).toBe(0);
  });

  it('có lịch nhận lương: mức chi an toàn đến ngày lương', () => {
    const salary = schedule({
      id: 'SAL',
      type: 'income',
      amount: 15_000_000,
      startDate: '2026-10-25',
      accountId: 'MB',
    });
    const rent = schedule({ id: 'RENT', amount: 3_000_000, startDate: '2026-10-19' });
    const occurrences = expandOccurrences([salary, rent], [], {
      from: TODAY,
      to: '2026-11-30',
      today: TODAY,
    });
    const f = computeForecast({
      today: TODAY,
      days: 30,
      startBalance: 5_000_000,
      occurrences,
      safetyThreshold: 500_000,
    });
    expect(f.nextIncome).toEqual({ date: '2026-10-25', amount: 15_000_000 });
    expect(f.safeDays).toBe(14);
    // (5.000.000 − 3.000.000 − 500.000) / 14 = 107.142
    expect(f.safeDailySpend).toBe(107_142);
    expect(f.firstNegative).toBeNull();
    expect(f.firstBelowSafety).toBeNull();
  });

  it('kỳ quá hạn tính vào hôm nay; cảnh báo dưới ngưỡng an toàn', () => {
    const overdue = schedule({
      id: 'OLD',
      amount: 800_000,
      startDate: '2026-10-05',
      frequency: 'once',
    });
    const occurrences = expandOccurrences([overdue], [], {
      from: TODAY,
      to: '2026-10-31',
      today: TODAY,
    });
    const f = computeForecast({
      today: TODAY,
      days: 7,
      startBalance: 1_000_000,
      occurrences,
      safetyThreshold: 500_000,
    });
    expect(f.points[0]).toEqual({ date: TODAY, balance: 200_000 });
    expect(f.firstBelowSafety).toEqual({ date: TODAY, balance: 200_000 });
  });

  it('cảnh báo theo ví: tiền nhà trả từ MB nhưng MB không đủ', () => {
    const rent = schedule({
      id: 'RENT',
      amount: 3_000_000,
      startDate: '2026-10-19',
      accountId: 'MB',
    });
    const occurrences = expandOccurrences([rent], [], {
      from: TODAY,
      to: '2026-10-31',
      today: TODAY,
    });
    const f = computeForecast({
      today: TODAY,
      days: 20,
      startBalance: 10_000_000,
      accountBalances: new Map([
        ['MB', 60_279],
        ['TCB', 9_939_721],
      ]),
      occurrences,
    });
    expect(f.firstNegative).toBeNull();
    expect(f.walletWarnings).toEqual([
      expect.objectContaining({ accountId: 'MB', balanceAfter: 60_279 - 3_000_000 }),
    ]);
  });

  it('chuyển khoản giữa hai ví tính vào tổng không đổi tổng số dư', () => {
    const save = schedule({
      id: 'SAVE',
      type: 'transfer',
      accountId: 'MB',
      toAccountId: 'TCB',
      amount: 1_000_000,
      startDate: '2026-10-15',
    });
    const occurrences = expandOccurrences([save], [], {
      from: TODAY,
      to: '2026-10-31',
      today: TODAY,
    });
    const f = computeForecast({
      today: TODAY,
      days: 10,
      startBalance: 2_000_000,
      includedAccounts: new Set(['MB', 'TCB']),
      occurrences,
    });
    expect(f.endBalance).toBe(2_000_000);
  });
});
