import { saveAccount } from '@/features/accounts/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import {
  buildCalendarDays,
  formatMonthTitle,
  getDailyTotals,
  loadCalendarMonth,
  monthGrid,
  shiftMonth,
  summarizeMonth,
} from './calendar';
import { findOccurrence, type Occurrence, type ScheduleLike } from './occurrences';
import { listOverrides, listSchedules, rescheduleOccurrence, saveSchedule } from './repository';

const TODAY = '2026-10-11';

describe('lưới lịch tháng', () => {
  it('6 tuần, bắt đầu thứ Hai, gồm ngày tháng trước / sau', () => {
    const grid = monthGrid('2026-10-11');
    expect(grid.month).toBe('2026-10-01');
    expect(grid.days).toHaveLength(42);
    expect(grid.start).toBe('2026-09-28'); // 01/10/2026 là thứ Năm
    expect(grid.end).toBe('2026-11-08');
    expect(grid.days[3]).toBe('2026-10-01');
  });

  it('tháng bắt đầu đúng thứ Hai thì ô đầu là ngày 1', () => {
    expect(monthGrid('2026-06-20').start).toBe('2026-06-01');
  });

  it('đổi tháng và tiêu đề', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-01');
    expect(shiftMonth('2026-12-05', 1)).toBe('2027-01-01');
    expect(formatMonthTitle('2026-10-01')).toBe('Tháng 10, 2026');
  });
});

function setup() {
  const db = createTestDb();
  const account = (name: string, includeInBalance = true) =>
    saveAccount(db, { name, color: '#000000', icon: 'card-outline', includeInBalance });
  return { db, mb: account('MB'), tcb: account('TCB') };
}

describe('tổng thu chi theo ngày (giờ VN)', () => {
  it('gom theo ngày VN, bỏ điều chỉnh số dư; chuyển khoản chỉ tính khi bật cài đặt', () => {
    const { db, mb, tcb } = setup();
    // 23:30 ngày 10/10 giờ VN (= 16:30 UTC) vẫn thuộc ngày 10/10
    saveTransaction(db, {
      type: 'expense',
      amount: 120_000,
      accountId: mb,
      date: vnDateToMs('2026-10-10', '23:30'),
    });
    // 00:30 ngày 11/10 giờ VN (= 17:30 UTC ngày 10/10) thuộc ngày 11/10
    saveTransaction(db, {
      type: 'expense',
      amount: 50_000,
      accountId: mb,
      date: vnDateToMs('2026-10-11', '00:30'),
    });
    saveTransaction(db, {
      type: 'income',
      amount: 15_000_000,
      accountId: mb,
      date: vnDateToMs('2026-10-11', '09:00'),
    });
    saveTransaction(db, {
      type: 'transfer',
      amount: 1_000_000,
      accountId: mb,
      toAccountId: tcb,
      date: vnDateToMs('2026-10-11', '10:00'),
    });
    saveTransaction(db, {
      type: 'income',
      amount: 999_000,
      accountId: mb,
      isAdjustment: true,
      date: vnDateToMs('2026-10-11', '11:00'),
    });
    // Ngoài khoảng
    saveTransaction(db, {
      type: 'expense',
      amount: 1,
      accountId: mb,
      date: vnDateToMs('2026-11-09', '08:00'),
    });

    const totals = getDailyTotals(db, { from: '2026-09-28', to: '2026-11-08' });
    expect(totals.get('2026-10-10')).toEqual({ income: 0, expense: 120_000, count: 1 });
    expect(totals.get('2026-10-11')).toEqual({ income: 15_000_000, expense: 50_000, count: 3 });
    expect(totals.has('2026-11-09')).toBe(false);

    const withTransfers = getDailyTotals(db, {
      from: '2026-10-11',
      to: '2026-10-11',
      transfersAsIncomeExpense: true,
    });
    expect(withTransfers.get('2026-10-11')).toEqual({
      income: 16_000_000,
      expense: 1_050_000,
      count: 3,
    });
  });
});

const schedule = (patch: Partial<ScheduleLike>): ScheduleLike => ({
  id: 's',
  type: 'expense',
  amount: 100,
  accountId: 'a',
  toAccountId: null,
  categoryId: null,
  title: '',
  startDate: '2026-10-01',
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
  ...patch,
});

const occ = (patch: Partial<Occurrence> & Pick<Occurrence, 'date'>): Occurrence => ({
  scheduleId: 's',
  dueDate: patch.date,
  amount: 100,
  type: 'expense',
  status: 'upcoming',
  transactionId: null,
  schedule: schedule({}),
  ...patch,
});

describe('đánh dấu từng ô', () => {
  const grid = monthGrid(TODAY);
  const day = (days: ReturnType<typeof buildCalendarDays>, date: string) =>
    days.find((d) => d.date === date)!;

  it('chấm thu / chi, bill, quá hạn, đã trả, hôm nay, âm lịch', () => {
    const days = buildCalendarDays({
      grid,
      today: TODAY,
      totals: new Map([['2026-10-11', { income: 0, expense: 120_000, count: 2 }]]),
      occurrences: [
        occ({ date: '2026-10-05', status: 'overdue' }),
        occ({ date: '2026-10-10', type: 'income', status: 'paid', scheduleId: 'luong' }),
        occ({ date: '2026-10-19', type: 'expense' }),
        occ({ date: '2026-10-19', type: 'income', scheduleId: 'thuong' }),
        occ({ date: '2026-10-20', type: 'transfer', scheduleId: 'credit:the-tin-dung' }),
        occ({ date: '2026-10-21', status: 'skipped' }),
        // Quá hạn từ trước khi lưới bắt đầu → không thuộc ô nào
        occ({ date: '2026-09-01', status: 'overdue' }),
      ],
    });
    expect(days).toHaveLength(42);
    expect(day(days, '2026-10-05')).toMatchObject({ overdue: true, expense: 'pending' });
    expect(day(days, '2026-10-10')).toMatchObject({
      income: 'done',
      payday: true,
      lunar: '1/9',
      lunarFirst: true,
    });
    expect(day(days, '2026-10-11')).toMatchObject({
      isToday: true,
      isSunday: true,
      totals: { expense: 120_000 },
      lunar: '2',
    });
    expect(day(days, '2026-10-19')).toMatchObject({ income: 'pending', expense: 'pending' });
    expect(day(days, '2026-10-20')).toMatchObject({ billDue: true, transfer: 'none' });
    expect(day(days, '2026-10-21')).toMatchObject({ expense: 'none' });
    expect(day(days, '2026-10-21').planned).toHaveLength(1);
    expect(day(days, '2026-09-28')).toMatchObject({ inMonth: false, day: 28 });
    expect(days.flatMap((d) => d.planned).some((o) => o.date === '2026-09-01')).toBe(false);

    expect(summarizeMonth(days)).toEqual({
      income: 0,
      expense: 120_000,
      plannedIncome: 100,
      plannedExpense: 200, // kỳ quá hạn 05/10 + kỳ 19/10 (bỏ qua và đã trả không tính)
    });
  });
});

describe('dữ liệu lịch tháng từ DB', () => {
  it('kỳ của lịch, kỳ đã dời, giao dịch thực tế', () => {
    const { db, mb } = setup();
    const rent = saveSchedule(db, {
      type: 'expense',
      amount: 3_000_000,
      accountId: mb,
      title: 'Tiền nhà',
      startDate: '2026-09-19',
      frequency: 'monthly',
    });
    saveSchedule(db, {
      type: 'income',
      amount: 15_000_000,
      accountId: mb,
      title: 'Lương',
      startDate: '2026-09-10',
      frequency: 'monthly',
    });
    rescheduleOccurrence(db, rent, '2026-10-19', '2026-10-22');
    saveTransaction(db, {
      type: 'expense',
      amount: 45_000,
      accountId: mb,
      date: vnDateToMs('2026-10-11', '12:00'),
    });

    const data = loadCalendarMonth(db, '2026-10-01', { today: TODAY });
    const day = (date: string) => data.days.find((d) => d.date === date)!;
    expect(day('2026-10-10')).toMatchObject({ income: 'pending', overdue: true, payday: true });
    expect(day('2026-10-19').expense).toBe('none');
    expect(day('2026-10-22').expense).toBe('pending');
    expect(day('2026-10-11').totals).toEqual({ income: 0, expense: 45_000, count: 1 });
    // Kỳ tháng 9 đã qua và kỳ tháng 11 trong phần lưới của tháng sau
    expect(day('2026-09-28').planned).toEqual([]);
    expect(data.summary).toMatchObject({ expense: 45_000, plannedIncome: 15_000_000 });
  });
});

describe('tìm một kỳ theo ngày gốc', () => {
  it('kỳ đã dời vẫn tìm được (trước đây màn chi tiết báo "Không tìm thấy" sau khi dời)', () => {
    const { db, mb } = setup();
    const rent = saveSchedule(db, {
      type: 'expense',
      amount: 3_000_000,
      accountId: mb,
      startDate: '2026-10-19',
      frequency: 'monthly',
    });
    rescheduleOccurrence(db, rent, '2026-11-19', '2026-11-25');
    const s = listSchedules(db)[0];
    const found = findOccurrence(s, listOverrides(db), '2026-11-19', TODAY);
    expect(found).toMatchObject({ dueDate: '2026-11-19', date: '2026-11-25', status: 'upcoming' });
    expect(findOccurrence(s, listOverrides(db), '2026-10-19', TODAY)?.date).toBe('2026-10-19');
    // Ngày không thuộc quy tắc / tham số hỏng
    expect(findOccurrence(s, [], '2026-10-20', TODAY)).toBeNull();
    expect(findOccurrence(s, [], undefined, TODAY)).toBeNull();
    expect(findOccurrence(s, [], 'abc', TODAY)).toBeNull();
  });

  it('dữ liệu lịch hỏng (thứ / ngày trong tháng ngoài phạm vi) không làm treo bộ sinh kỳ', () => {
    const weekly = schedule({ frequency: 'weekly', weekdays: '0,9,abc', startDate: '2026-10-05' });
    expect(findOccurrence(weekly, [], '2026-10-12', TODAY)?.date).toBe('2026-10-12');
    const monthly = schedule({ frequency: 'monthly', monthDay: -5, startDate: '2026-10-05' });
    expect(findOccurrence(monthly, [], '2026-11-05', TODAY)?.date).toBe('2026-11-05');
  });
});
