import { saveAccount } from '@/features/accounts/repository';
import { saveInstallmentPlan } from '@/features/credit/repository';
import { computeForecast } from '@/features/forecast/forecast';
import type { Occurrence, ScheduleLike } from '@/features/schedules/occurrences';
import { saveSchedule } from '@/features/schedules/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { computeToday, dailyAllowance, incomeLabel, projectAllowances } from './compute';
import { getDaySpending } from './queries';

const TODAY = '2026-10-11';

function occurrence(
  date: string,
  type: Occurrence['type'],
  amount: number,
  title = '',
  accountId = 'MB',
  toAccountId: string | null = null,
): Occurrence {
  const schedule: ScheduleLike = {
    id: `${title}-${date}`,
    type,
    amount,
    accountId,
    toAccountId,
    categoryId: null,
    title,
    startDate: date,
    frequency: 'once',
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
  };
  return {
    scheduleId: schedule.id,
    dueDate: date,
    date,
    amount,
    type,
    status: date < TODAY ? 'overdue' : date === TODAY ? 'due' : 'upcoming',
    transactionId: null,
    schedule,
  };
}

const forecastOf = (startBalance: number, occurrences: Occurrence[], safetyThreshold = 0) =>
  computeForecast({ today: TODAY, days: 30, startBalance, occurrences, safetyThreshold });

describe('hôm nay được tiêu', () => {
  // Lương ngày 20 → chia đều 9 ngày (11 → 19)
  const salary = occurrence('2026-10-20', 'income', 15_000_000, 'Lương tháng');

  it('chưa tiêu gì → bằng mức chi an toàn của dự báo', () => {
    const forecast = forecastOf(900_000, [salary]);
    const status = computeToday({
      today: TODAY,
      forecast,
      spending: { spent: 0, balanceEffect: 0 },
    });
    expect(status.budget).toBe(forecast.safeDailySpend);
    expect(status.budget).toBe(100_000);
    expect(status.left).toBe(100_000);
    expect(status.nextIncome).toMatchObject({ date: '2026-10-20', days: 9 });
  });

  it('tiêu đúng mức từ ví tính vào tổng → còn 0, không báo vượt (không trừ hai lần)', () => {
    // Đầu ngày 900k; đã tiêu 100k tiền mặt → số dư hiện tại 800k
    const forecast = forecastOf(800_000, [salary]);
    const status = computeToday({
      today: TODAY,
      forecast,
      spending: { spent: 100_000, balanceEffect: 100_000 },
    });
    expect(status.budget).toBe(100_000);
    expect(status.left).toBe(0);
    expect(status.over).toBe(0);
    expect(status.progress).toBe(1);
  });

  it('tiêu bằng ví trả sau vẫn trừ vào phần còn được tiêu', () => {
    const forecast = forecastOf(900_000, [salary]);
    const status = computeToday({
      today: TODAY,
      forecast,
      spending: { spent: 130_000, balanceEffect: 0 },
    });
    expect(status.left).toBe(0);
    expect(status.over).toBe(30_000);
  });

  it('trừ các khoản phải trả trước kỳ lương + ngưỡng an toàn', () => {
    const rent = occurrence('2026-10-15', 'expense', 300_000, 'Tiền nhà');
    const forecast = forecastOf(1_200_000, [rent, salary], 0);
    expect(
      computeToday({ today: TODAY, forecast, spending: { spent: 0, balanceEffect: 0 } }).budget,
    ).toBe(100_000);
    const safe = computeToday({
      today: TODAY,
      forecast: forecastOf(1_200_000, [rent, salary], 90_000),
      spending: { spent: 0, balanceEffect: 0 },
      safetyThreshold: 90_000,
    });
    expect(safe.budget).toBe(90_000);
  });

  it('không đủ tiền cho khoản phải trả → được tiêu 0, báo thiếu', () => {
    const rent = occurrence('2026-10-15', 'expense', 3_000_000, 'Tiền nhà');
    const status = computeToday({
      today: TODAY,
      forecast: forecastOf(1_000_000, [rent, salary]),
      spending: { spent: 0, balanceEffect: 0 },
    });
    expect(status.budget).toBe(0);
    expect(status.available).toBe(-2_000_000);
  });

  it('không có kỳ thu trong 30 ngày → chia cho 30 ngày, không có ngày lương', () => {
    const status = computeToday({
      today: TODAY,
      forecast: forecastOf(3_000_000, []),
      spending: { spent: 0, balanceEffect: 0 },
    });
    expect(status.days).toBe(30);
    expect(status.budget).toBe(100_000);
    expect(status.nextIncome).toBeNull();
  });

  it('lương đến hạn hôm nay chưa xác nhận → tính vào tiền dùng được, báo "hôm nay"', () => {
    const today = occurrence(TODAY, 'income', 10_000_000, 'Lương');
    const status = computeToday({
      today: TODAY,
      forecast: forecastOf(0, [today]),
      spending: { spent: 0, balanceEffect: 0 },
    });
    expect(status.incomeToday).toMatchObject({ days: 0 });
    expect(status.budget).toBeGreaterThan(0);
  });

  it('nhãn ngày lương', () => {
    const base = { date: TODAY, amount: 1, title: 'Lương tháng 10' };
    expect(incomeLabel({ ...base, days: 9 })).toBe('Còn 9 ngày tới lương');
    expect(incomeLabel({ ...base, days: 1 })).toBe('Mai nhận lương');
    expect(incomeLabel({ ...base, days: 0 })).toBe('Hôm nay nhận lương');
    expect(incomeLabel({ ...base, title: 'Thưởng dự án', days: 3 })).toBe(
      'Còn 3 ngày tới Thưởng dự án',
    );
  });
});

describe('ước tính các ngày tới (báo cáo buổi sáng)', () => {
  it('tiêu đúng mức mỗi ngày → mức giữ nguyên tới ngày lương, sau lương tính lại', () => {
    const salary = occurrence('2026-10-13', 'income', 3_000_000, 'Lương');
    const forecast = forecastOf(200_000, [salary]);
    const status = computeToday({
      today: TODAY,
      forecast,
      spending: { spent: 0, balanceEffect: 0 },
    });
    expect(status.budget).toBe(100_000);
    const days = projectAllowances({ today: TODAY, forecast, status, count: 3 });
    expect(days.map((d) => d.date)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13']);
    expect(days[0].allowance).toBe(100_000);
    expect(days[1].allowance).toBe(100_000);
    expect(days[1].nextIncome).toMatchObject({ days: 1 });
    // Ngày 13: nhận lương 3tr, còn 0 từ trước → (3tr) / 28 ngày còn lại của khoảng dự báo
    expect(days[2].incomeOnDay).toMatchObject({ days: 0 });
    expect(days[2].allowance).toBe(Math.floor(3_000_000 / 28));
  });

  it('dailyAllowance khớp computeForecast', () => {
    const rent = occurrence('2026-10-15', 'expense', 450_000, 'Tiền nhà');
    const salary = occurrence('2026-10-25', 'income', 9_000_000, 'Lương');
    const forecast = forecastOf(2_345_678, [rent, salary], 50_000);
    expect(
      dailyAllowance(forecast, { day: TODAY, startBalance: 2_345_678, safetyThreshold: 50_000 })
        .perDay,
    ).toBe(forecast.safeDailySpend);
  });
});

describe('đã tiêu hôm nay (DB)', () => {
  const at = (time: string, date = TODAY) => vnDateToMs(date, time);

  it('chỉ tính khoản chi ngoài lịch; trả góp tính 1 kỳ; ví trả sau có tính nhưng không trừ số dư', () => {
    const db = createTestDb();
    const cash = saveAccount(db, {
      name: 'Tiền mặt',
      color: '#000',
      icon: 'wallet-outline',
      includeInBalance: true,
    });
    const fund = saveAccount(db, {
      name: 'Quỹ',
      color: '#000',
      icon: 'wallet-outline',
      includeInBalance: false,
    });
    const spay = saveAccount(db, {
      name: 'SPayLater',
      color: '#EE4D2D',
      icon: 'wallet-outline',
      includeInBalance: false,
      credit: { limit: 5_000_000, statementDay: 31, dueDay: 10, paymentAccountId: cash },
    });

    saveTransaction(db, {
      type: 'income',
      amount: 5_000_000,
      accountId: cash,
      title: 'Lương',
      date: at('08:00'),
    });
    saveTransaction(db, {
      type: 'expense',
      amount: 50_000,
      accountId: cash,
      title: 'Phở',
      date: at('07:30'),
    });
    saveTransaction(db, {
      type: 'expense',
      amount: 40_000,
      accountId: spay,
      title: 'Trà sữa',
      date: at('15:00'),
    });
    // Ngày hôm qua, quỹ riêng, chuyển khoản, điều chỉnh: không tính
    saveTransaction(db, {
      type: 'expense',
      amount: 70_000,
      accountId: cash,
      title: 'Cơm',
      date: at('20:00', '2026-10-10'),
    });
    saveTransaction(db, {
      type: 'expense',
      amount: 999_000,
      accountId: fund,
      title: 'Quỹ',
      date: at('09:00'),
    });
    saveTransaction(db, {
      type: 'transfer',
      amount: 300_000,
      accountId: cash,
      toAccountId: spay,
      title: 'Trả bill',
      date: at('10:00'),
    });
    saveTransaction(db, {
      type: 'expense',
      amount: 10_000,
      accountId: cash,
      title: 'Lệch',
      date: at('11:00'),
      isAdjustment: true,
    });
    // Khoản trả theo lịch: đã nằm trong dự báo
    const rent = saveSchedule(db, {
      type: 'expense',
      amount: 2_000_000,
      accountId: cash,
      title: 'Tiền nhà',
      startDate: TODAY,
      frequency: 'once',
    });
    saveTransaction(db, {
      type: 'expense',
      amount: 2_000_000,
      accountId: cash,
      title: 'Tiền nhà',
      date: at('12:00'),
      scheduleId: rent,
      scheduleDueDate: TODAY,
    });
    // Mua trả góp 6 kỳ bằng ví trả sau → chỉ tính 1 kỳ
    const phone = saveTransaction(db, {
      type: 'expense',
      amount: 3_000_000,
      accountId: spay,
      title: 'Điện thoại',
      date: at('16:00'),
    });
    saveInstallmentPlan(db, {
      transactionId: phone,
      accountId: spay,
      title: 'Điện thoại',
      purchaseDate: TODAY,
      months: 6,
      perMonth: 500_000,
    });

    expect(getDaySpending(db, TODAY)).toEqual({
      spent: 50_000 + 40_000 + 500_000,
      balanceEffect: 50_000,
    });
    expect(getDaySpending(db, '2026-10-12')).toEqual({ spent: 0, balanceEffect: 0 });
  });
});
