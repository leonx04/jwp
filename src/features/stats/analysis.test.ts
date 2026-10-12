import {
  bucketByPeriods,
  categoryDeltas,
  cumulative,
  cumulativeByDay,
  findSpikes,
  foldSlices,
  OTHER_KEY,
  percentChange,
  projectPeriodEnd,
  sumFlows,
  topSpendingDay,
  topWeekday,
  weekdayPattern,
  type CategoryTotal,
  type DailyFlow,
} from './analysis';
import { buildInsights, formatPercent, formatRatio, type InsightInput } from './insights';
import {
  comparablePeriod,
  elapsedDays,
  monthsEnding,
  monthsOfYear,
  periodRangeLabel,
  periodTitle,
  previousPeriod,
  statsPeriod,
  statsYearOf,
  yearPeriod,
} from './periods';

const cat = (key: string, amount: number, name = key): CategoryTotal => ({
  key,
  categoryId: key,
  name,
  color: '#F97316',
  icon: null,
  amount,
  count: 1,
});

const day = (date: string, expense: number, income = 0): DailyFlow => ({
  date,
  expense,
  income,
  count: 1,
});

describe('so sánh kỳ', () => {
  it('percentChange', () => {
    expect(percentChange(135, 100)).toBeCloseTo(35);
    expect(percentChange(80, 100)).toBeCloseTo(-20);
    expect(percentChange(50, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });

  it('categoryDeltas: tỷ trọng, chênh lệch, sắp xếp giảm dần', () => {
    const result = categoryDeltas(
      [cat('food', 1_350_000, 'Ăn uống'), cat('shop', 650_000, 'Mua sắm'), cat('zero', 0)],
      [cat('food', 1_000_000), cat('fun', 300_000)],
    );
    expect(result.map((r) => r.key)).toEqual(['food', 'shop']);
    expect(result[0]).toMatchObject({ previous: 1_000_000, delta: 350_000 });
    expect(result[0].share).toBeCloseTo(0.675);
    expect(result[0].change).toBeCloseTo(35);
    // Danh mục mới (kỳ trước không có) → không tính được %
    expect(result[1]).toMatchObject({ previous: 0, delta: 650_000, change: null });
  });
});

describe('theo ngày', () => {
  const days = [
    day('2026-10-01', 100_000),
    day('2026-10-03', 500_000, 10_000_000),
    day('2026-10-04', 200_000),
    day('2026-10-10', 300_000),
  ];

  it('sumFlows trong khoảng', () => {
    expect(sumFlows(days, 'expense')).toBe(1_100_000);
    expect(sumFlows(days, 'expense', '2026-10-03', '2026-10-04')).toBe(700_000);
    expect(sumFlows(days, 'income')).toBe(10_000_000);
  });

  it('ngày chi nhiều nhất', () => {
    expect(topSpendingDay(days, 'expense')).toEqual({ date: '2026-10-03', amount: 500_000 });
    expect(
      topSpendingDay(days, 'expense', { start: '2026-10-04', end: '2026-10-31' }),
    ).toEqual({ date: '2026-10-10', amount: 300_000 });
    expect(topSpendingDay([], 'expense')).toBeNull();
  });

  it('thứ trong tuần: trung bình tính cả ngày không chi', () => {
    // 01/10/2026 là thứ Năm; 14 ngày → mỗi thứ xuất hiện đúng 2 lần
    const pattern = weekdayPattern(
      [day('2026-10-03', 600_000), day('2026-10-10', 400_000), day('2026-10-05', 100_000)],
      'expense',
      '2026-10-01',
      '2026-10-14',
    );
    expect(pattern.every((p) => p.days === 2)).toBe(true);
    expect(pattern[5]).toMatchObject({ weekday: 6, total: 1_000_000, average: 500_000 }); // thứ Bảy
    expect(pattern[0]).toMatchObject({ weekday: 1, total: 100_000, average: 50_000 });
    const top = topWeekday(pattern);
    expect(top?.weekday).toBe(6);
    // Trung bình chung = (500k + 50k) / 7
    expect(top?.ratio).toBeCloseTo(500_000 / (550_000 / 7));
  });

  it('thứ trong tuần: khoảng lẻ ngày', () => {
    const pattern = weekdayPattern([], 'expense', '2026-10-01', '2026-10-10'); // T5 → T7 tuần sau
    expect(pattern.map((p) => p.days)).toEqual([1, 1, 1, 2, 2, 2, 1]);
    expect(topWeekday(pattern)).toBeNull();
  });
});

describe('dự báo & cộng dồn', () => {
  it('dự báo cuối tháng theo tốc độ hiện tại', () => {
    expect(projectPeriodEnd({ spent: 2_000_000, elapsedDays: 10, totalDays: 31 })).toBe(6_200_000);
    // Quá sớm trong tháng / tháng đã hết → không dự báo
    expect(projectPeriodEnd({ spent: 500_000, elapsedDays: 2, totalDays: 31 })).toBeNull();
    expect(projectPeriodEnd({ spent: 5_000_000, elapsedDays: 31, totalDays: 31 })).toBeNull();
  });

  it('cộng dồn theo ngày, dừng ở hôm nay', () => {
    const period = { start: '2026-10-01', end: '2026-10-05' };
    const days = [day('2026-09-30', 999), day('2026-10-01', 100), day('2026-10-03', 50), day('2026-10-05', 10)];
    expect(cumulativeByDay(days, 'expense', period)).toEqual([100, 100, 150, 150, 160]);
    expect(cumulativeByDay(days, 'expense', period, '2026-10-03')).toEqual([100, 100, 150, null, null]);
    expect(cumulative([1, 2, 3, 4], 1)).toEqual([1, 3, null, null]);
  });

  it('gom theo tháng (tháng bắt đầu từ ngày 10)', () => {
    const periods = [
      { start: '2026-08-10', end: '2026-09-09' },
      { start: '2026-09-10', end: '2026-10-09' },
    ];
    const result = bucketByPeriods(
      [day('2026-08-09', 1), day('2026-08-10', 10, 5), day('2026-09-09', 20), day('2026-09-10', 40)],
      periods,
    );
    expect(result.map((r) => [r.expense, r.income, r.count])).toEqual([
      [30, 5, 2],
      [40, 0, 1],
    ]);
  });
});

describe('bất thường & gộp phần nhỏ', () => {
  it('tìm danh mục tăng đột biến so với trung bình 3 tháng', () => {
    const spikes = findSpikes(
      [cat('fun', 900_000, 'Giải trí'), cat('food', 3_000_000), cat('tiny', 30_000), cat('new', 500_000)],
      // Tổng 3 tháng trước: fun 1,2Tr (tb 400k) · food 8,4Tr (tb 2,8Tr) · tiny 30k (tb 10k)
      [cat('fun', 1_200_000), cat('food', 8_400_000), cat('tiny', 30_000)],
      3,
      { minRatio: 1.5, minDelta: 100_000 },
    );
    expect(spikes).toHaveLength(1);
    expect(spikes[0]).toMatchObject({ key: 'fun', baseline: 400_000 });
    expect(spikes[0].ratio).toBeCloseTo(2.25);
  });

  it('gộp phần nhỏ thành "Khác"', () => {
    const items = ['a', 'b', 'c', 'd'].map((k, i) => cat(k, (4 - i) * 100));
    expect(foldSlices(items, 4, { name: 'Khác', color: '#999999' })).toHaveLength(4);
    const folded = foldSlices(items, 3, { name: 'Khác', color: '#999999' });
    expect(folded.map((s) => [s.key, s.value])).toEqual([
      ['a', 400],
      ['b', 300],
      [OTHER_KEY, 300],
    ]);
    expect(folded[2].keys).toEqual(['c', 'd']);
  });
});

describe('kỳ thống kê', () => {
  it('tháng & năm, kể cả tháng bắt đầu từ ngày 10', () => {
    expect(statsPeriod('month', 0, '2026-10-11')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(statsPeriod('month', -1, '2026-10-11', 10)).toEqual({
      start: '2026-09-10',
      end: '2026-10-09',
    });
    expect(statsPeriod('year', 0, '2026-10-11')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(yearPeriod(2026, 10)).toEqual({ start: '2026-01-10', end: '2027-01-09' });
    // 05/01/2027 thuộc kỳ 10/12/2026 – 09/01/2027 → năm 2026
    expect(statsYearOf('2027-01-05', 10)).toBe(2026);
    expect(previousPeriod('year', yearPeriod(2026))).toEqual(yearPeriod(2025));
  });

  it('các tháng của xu hướng', () => {
    const months = monthsEnding({ start: '2026-10-01', end: '2026-10-31' }, 6);
    expect(months).toHaveLength(6);
    expect(months[0].start).toBe('2026-05-01');
    expect(months[5]).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    const year = monthsOfYear(yearPeriod(2026, 10), 10);
    expect(year[0]).toEqual({ start: '2026-01-10', end: '2026-02-09' });
    expect(year[11]).toEqual({ start: '2026-12-10', end: '2027-01-09' });
  });

  it('so sánh cùng kỳ', () => {
    const october = { start: '2026-10-01', end: '2026-10-31' };
    const september = { start: '2026-09-01', end: '2026-09-30' };
    expect(elapsedDays(october, '2026-10-11')).toBe(11);
    expect(elapsedDays(october, '2026-11-02')).toBe(31);
    expect(elapsedDays(october, '2026-09-02')).toBe(0);
    expect(comparablePeriod(september, 11)).toEqual({ start: '2026-09-01', end: '2026-09-11' });
    expect(comparablePeriod(september, 31)).toEqual(september);
  });

  it('nhãn kỳ', () => {
    expect(periodTitle('month', { start: '2026-10-01', end: '2026-10-31' })).toBe('Tháng 10/2026');
    expect(periodTitle('year', yearPeriod(2026))).toBe('Năm 2026');
    expect(periodRangeLabel({ start: '2026-10-01', end: '2026-10-31' })).toBe('01/10 – 31/10');
    expect(periodRangeLabel({ start: '2026-12-10', end: '2027-01-09' })).toBe(
      '10/12/2026 – 09/01/2027',
    );
  });
});

describe('nhận xét tự động', () => {
  const format = (n: number) => `${Math.round(n / 1000)}k`;
  const base: InsightInput = {
    type: 'expense',
    mode: 'month',
    inProgress: true,
    total: 2_000_000,
    previousTotal: 2_500_000,
    previousFullTotal: 5_100_000,
    categories: categoryDeltas(
      [cat('food', 1_350_000, 'Ăn uống'), cat('shop', 650_000, 'Mua sắm')],
      [cat('food', 1_000_000), cat('shop', 1_500_000)],
    ),
    spikes: [],
    average: 120_000,
    topDay: { date: '2026-10-03', amount: 500_000 },
    topWeekday: { weekday: 6, average: 350_000, ratio: 1.8 },
    projection: 6_200_000,
    format,
    limit: 10,
  };

  it('ghép câu tiếng Việt đúng ngữ cảnh', () => {
    const texts = buildInsights(base).map((i) => i.text);
    expect(texts).toContain('Theo tốc độ hiện tại, cuối tháng chi khoảng 6200k (tháng trước 5100k)');
    expect(texts).toContain('Chi tiêu giảm 20% so với cùng kỳ tháng trước');
    expect(texts).toContain('Ăn uống tăng 35% so với cùng kỳ tháng trước');
    expect(texts).toContain('Mua sắm giảm 57% so với cùng kỳ tháng trước');
    expect(texts).toContain('Thứ Bảy là ngày bạn chi nhiều nhất (trung bình 350k)');
    expect(texts).toContain('Trung bình mỗi ngày chi 120k');
    expect(texts).toContain('Ăn uống chiếm 68% tổng chi');
    expect(texts).toContain('Ngày chi nhiều nhất: 03/10 — 500k');
  });

  it('màu: chi giảm là tốt, dự báo vượt tháng trước là cần chú ý', () => {
    const insights = buildInsights(base);
    expect(insights.find((i) => i.key === 'total')?.tone).toBe('good');
    expect(insights.find((i) => i.key === 'projection')?.tone).toBe('bad');
    expect(insights.find((i) => i.key === 'up-food')?.tone).toBe('bad');
  });

  it('thu nhập: tăng là tốt, không dự báo, kỳ đã kết thúc so với "tháng trước"', () => {
    const insights = buildInsights({
      ...base,
      type: 'income',
      inProgress: false,
      total: 12_000_000,
      previousTotal: 10_000_000,
      categories: [],
    });
    expect(insights.find((i) => i.key === 'projection')).toBeUndefined();
    expect(insights.find((i) => i.key === 'total')).toMatchObject({
      tone: 'good',
      text: 'Thu nhập tăng 20% so với tháng trước',
    });
  });

  it('tăng bất thường, giới hạn số nhận xét, không có dữ liệu', () => {
    const insights = buildInsights({
      ...base,
      spikes: [{ key: 'fun', name: 'Giải trí', amount: 900_000, baseline: 400_000, ratio: 2.25 }],
      limit: 4,
    });
    expect(insights).toHaveLength(4);
    expect(insights[3].text).toBe('Giải trí cao bất thường: gấp 2,3 lần mức trung bình 3 tháng trước');
    expect(buildInsights({ ...base, total: 0, previousTotal: 0, projection: null })).toEqual([]);
  });

  it('định dạng % và tỷ lệ', () => {
    expect(formatPercent(35.4)).toBe('35%');
    expect(formatPercent(-0.2)).toBe('1%');
    expect(formatRatio(2.14)).toBe('2,1');
    expect(formatRatio(3)).toBe('3');
  });
});
