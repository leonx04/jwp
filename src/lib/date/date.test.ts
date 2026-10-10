import {
  addDays,
  addMonths,
  diffDays,
  formatDate,
  formatDayHeader,
  formatRelativeDue,
  periodContaining,
  shiftPeriod,
  startOfWeek,
  toVnDate,
  toVnTime,
  vnDateToMs,
  weekdayOf,
} from './index';

// 2026-10-11 10:00 giờ VN
const NOW = Date.UTC(2026, 9, 11, 3, 0);

describe('giờ Việt Nam', () => {
  it('giao dịch lúc 23:30 giờ VN không bị lệch sang ngày khác', () => {
    const ms = Date.UTC(2026, 9, 10, 16, 30); // 10/10 16:30 UTC = 10/10 23:30 VN
    expect(toVnDate(ms)).toBe('2026-10-10');
    expect(toVnTime(ms)).toBe('23:30');
    const ms2 = Date.UTC(2026, 9, 10, 17, 30); // = 11/10 00:30 VN
    expect(toVnDate(ms2)).toBe('2026-10-11');
  });

  it('vnDateToMs là nghịch đảo của toVnDate/toVnTime', () => {
    const ms = vnDateToMs('2026-10-19', '12:00');
    expect(ms).toBe(Date.UTC(2026, 9, 19, 5, 0));
    expect(toVnDate(ms)).toBe('2026-10-19');
    expect(toVnTime(ms)).toBe('12:00');
  });
});

describe('cộng ngày / tháng', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-03-31', 1, '2026-04-30'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-01-15', -1, '2025-12-15'],
    ['2026-08-19', 36, '2029-08-19'],
  ])('%s + %d tháng = %s', (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected);
  });

  it('addDays qua năm, diffDays', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-10-11', '2026-10-19')).toBe(8);
    expect(diffDays('2026-10-19', '2026-10-11')).toBe(-8);
  });

  it('thứ trong tuần (1 = thứ Hai)', () => {
    expect(weekdayOf('2026-10-11')).toBe(7); // Chủ nhật
    expect(weekdayOf('2026-10-12')).toBe(1);
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05');
  });
});

describe('hiển thị', () => {
  it('formatDate', () => {
    expect(formatDate('2026-10-05')).toBe('05/10/2026');
    expect(formatDate('2026-10-05', false)).toBe('05/10');
  });

  it('formatDayHeader', () => {
    expect(formatDayHeader('2026-10-11', NOW)).toBe('Hôm nay');
    expect(formatDayHeader('2026-10-10', NOW)).toBe('Hôm qua');
    expect(formatDayHeader('2026-10-12', NOW)).toBe('Ngày mai');
    expect(formatDayHeader('2026-10-05', NOW)).toBe('Thứ Hai, 05/10');
    expect(formatDayHeader('2025-12-31', NOW)).toBe('Thứ Tư, 31/12/2025');
  });

  it('formatRelativeDue', () => {
    expect(formatRelativeDue('2026-10-11', NOW)).toBe('hôm nay');
    expect(formatRelativeDue('2026-10-12', NOW)).toBe('ngày mai');
    expect(formatRelativeDue('2026-10-19', NOW)).toBe('còn 8 ngày');
    expect(formatRelativeDue('2026-10-09', NOW)).toBe('quá hạn 2 ngày');
  });
});

describe('kỳ thống kê theo ngày bắt đầu tháng', () => {
  it('mặc định: tháng dương lịch', () => {
    expect(periodContaining('2026-10-11')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(periodContaining('2026-02-14')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('tháng tính từ ngày 10 (ngày nhận lương)', () => {
    expect(periodContaining('2026-10-11', 10)).toEqual({ start: '2026-10-10', end: '2026-11-09' });
    expect(periodContaining('2026-10-09', 10)).toEqual({ start: '2026-09-10', end: '2026-10-09' });
  });

  it('ngày 31 ở tháng ngắn → ngày cuối tháng', () => {
    expect(periodContaining('2026-02-28', 31)).toEqual({ start: '2026-02-28', end: '2026-03-30' });
    expect(periodContaining('2026-03-15', 31)).toEqual({ start: '2026-02-28', end: '2026-03-30' });
  });

  it('dịch kỳ trước / sau', () => {
    const p = periodContaining('2026-10-11', 10);
    expect(shiftPeriod(p, -1, 10)).toEqual({ start: '2026-09-10', end: '2026-10-09' });
    expect(shiftPeriod(p, 1, 10)).toEqual({ start: '2026-11-10', end: '2026-12-09' });
    expect(shiftPeriod(periodContaining('2026-01-05'), -1)).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
  });
});
