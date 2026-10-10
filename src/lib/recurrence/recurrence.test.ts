import {
  applyWeekendRule,
  describeRule,
  generateOccurrences,
  nextOccurrence,
  type RecurrenceRule,
} from './index';

const base: RecurrenceRule = {
  startDate: '2026-01-31',
  frequency: 'monthly',
  interval: 1,
  weekendRule: 'none',
  endType: 'never',
};

const rule = (patch: Partial<RecurrenceRule>): RecurrenceRule => ({ ...base, ...patch });

describe('hằng tháng', () => {
  it('ngày 31 → tháng thiếu ngày lấy ngày cuối tháng, tháng sau quay lại 31', () => {
    expect(generateOccurrences(rule({}), '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('năm nhuận: 29/02', () => {
    expect(
      generateOccurrences(rule({ startDate: '2028-01-31' }), '2028-02-01', '2028-02-29'),
    ).toEqual(['2028-02-29']);
  });

  it('ngày cuối tháng (monthDay = -1)', () => {
    expect(
      generateOccurrences(
        rule({ startDate: '2026-01-15', monthDay: -1 }),
        '2026-01-01',
        '2026-04-30',
      ),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('ngày cố định nhỏ hơn ngày bắt đầu → kỳ đầu ở tháng sau', () => {
    expect(
      generateOccurrences(
        rule({ startDate: '2026-10-20', monthDay: 5 }),
        '2026-10-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-11-05', '2026-12-05']);
  });

  it('mỗi 3 tháng', () => {
    expect(
      generateOccurrences(
        rule({ startDate: '2026-01-10', interval: 3 }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-01-10', '2026-04-10', '2026-07-10', '2026-10-10']);
  });

  it('kỳ giống Ivy: 19 hằng tháng trong 3 năm = 36 kỳ', () => {
    const dates = generateOccurrences(
      rule({ startDate: '2026-08-19' }),
      '2026-10-19',
      '2029-07-19',
    );
    expect(dates).toHaveLength(34);
    expect(dates[0]).toBe('2026-10-19');
    expect(dates.at(-1)).toBe('2029-07-19');
  });
});

describe('quy tắc cuối tuần', () => {
  // 2026-10-10 là thứ Bảy, 2026-10-11 là Chủ nhật
  it.each([
    ['2026-10-10', 'before', '2026-10-09'],
    ['2026-10-11', 'before', '2026-10-09'],
    ['2026-10-10', 'after', '2026-10-12'],
    ['2026-10-11', 'after', '2026-10-12'],
    ['2026-10-09', 'after', '2026-10-09'],
    ['2026-10-11', 'none', '2026-10-11'],
  ] as const)('%s + %s → %s', (date, weekendRule, expected) => {
    expect(applyWeekendRule(date, weekendRule)).toBe(expected);
  });

  it('lương ngày 10 hằng tháng, rơi cuối tuần thì nhận thứ Sáu', () => {
    expect(
      generateOccurrences(
        rule({ startDate: '2026-10-10', weekendRule: 'before' }),
        '2026-10-01',
        '2027-01-31',
      ),
    ).toEqual(['2026-10-09', '2026-11-10', '2026-12-10', '2027-01-08']);
  });
});

describe('hằng ngày / tuần / năm / một lần', () => {
  it('mỗi 2 ngày', () => {
    expect(
      generateOccurrences(
        rule({ startDate: '2026-10-01', frequency: 'daily', interval: 2 }),
        '2026-10-04',
        '2026-10-10',
      ),
    ).toEqual(['2026-10-05', '2026-10-07', '2026-10-09']);
  });

  it('hằng tuần vào T2 và T6, bắt đầu giữa tuần', () => {
    // 2026-10-07 là thứ Tư
    expect(
      generateOccurrences(
        rule({ startDate: '2026-10-07', frequency: 'weekly', weekdays: [1, 5] }),
        '2026-10-01',
        '2026-10-20',
      ),
    ).toEqual(['2026-10-09', '2026-10-12', '2026-10-16', '2026-10-19']);
  });

  it('mỗi 2 tuần, mặc định theo thứ của ngày bắt đầu', () => {
    expect(
      generateOccurrences(
        rule({ startDate: '2026-10-07', frequency: 'weekly', interval: 2 }),
        '2026-10-01',
        '2026-11-10',
      ),
    ).toEqual(['2026-10-07', '2026-10-21', '2026-11-04']);
  });

  it('hằng năm, 29/02 → 28/02 năm không nhuận', () => {
    expect(
      generateOccurrences(
        rule({ startDate: '2028-02-29', frequency: 'yearly' }),
        '2028-01-01',
        '2030-12-31',
      ),
    ).toEqual(['2028-02-29', '2029-02-28', '2030-02-28']);
  });

  it('một lần', () => {
    const once = rule({ startDate: '2026-10-22', frequency: 'once' });
    expect(generateOccurrences(once, '2026-10-01', '2026-12-31')).toEqual(['2026-10-22']);
    expect(generateOccurrences(once, '2026-10-23', '2026-12-31')).toEqual([]);
  });
});

describe('điều kiện kết thúc', () => {
  it('sau N lần (đếm từ kỳ đầu, kể cả kỳ nằm ngoài khoảng xem)', () => {
    const r = rule({ startDate: '2026-01-15', endType: 'count', endCount: 3 });
    expect(generateOccurrences(r, '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
    expect(generateOccurrences(r, '2026-03-01', '2026-12-31')).toEqual(['2026-03-15']);
  });

  it('đến ngày', () => {
    const r = rule({ startDate: '2026-01-15', endType: 'until', endDate: '2026-03-20' });
    expect(generateOccurrences(r, '2026-01-01', '2026-12-31')).toHaveLength(3);
  });

  it('nextOccurrence', () => {
    expect(nextOccurrence(rule({ startDate: '2026-08-19' }), '2026-10-12')).toBe('2026-10-19');
    expect(
      nextOccurrence(
        rule({ startDate: '2026-01-15', endType: 'count', endCount: 1 }),
        '2026-02-01',
      ),
    ).toBeNull();
  });
});

describe('describeRule', () => {
  it.each([
    [rule({ startDate: '2026-08-19' }), 'Hằng tháng, ngày 19'],
    [rule({ monthDay: -1 }), 'Hằng tháng, ngày cuối tháng'],
    [rule({ frequency: 'weekly', weekdays: [5, 1], interval: 2 }), 'Mỗi 2 tuần vào T2, T6'],
    [rule({ frequency: 'once' }), 'Một lần'],
    [
      rule({ weekendRule: 'before', startDate: '2026-10-10' }),
      'Hằng tháng, ngày 10 (cuối tuần → thứ Sáu)',
    ],
  ])('%#', (r, text) => {
    expect(describeRule(r)).toBe(text);
  });
});
