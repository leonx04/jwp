import { vnDateToMs } from '@/lib/date';

import { estimateTetExtraSpend, nextTet, planTet, tetDateOfYear } from './plan';

describe('tetDateOfYear / nextTet', () => {
  it('mùng 1 Tết các năm đã biết', () => {
    expect(tetDateOfYear(2025)).toBe('2025-01-29');
    expect(tetDateOfYear(2026)).toBe('2026-02-17');
    expect(tetDateOfYear(2027)).toBe('2027-02-06');
  });

  it('chọn Tết sắp tới; qua Tết hơn 7 ngày thì sang năm sau', () => {
    expect(nextTet('2026-10-17')).toBe('2027-02-06');
    expect(nextTet('2026-01-05')).toBe('2026-02-17');
    expect(nextTet('2026-02-20')).toBe('2026-02-17'); // mới qua 3 ngày
    expect(nextTet('2026-03-01')).toBe('2027-02-06');
  });
});

describe('estimateTetExtraSpend', () => {
  const tet = '2026-02-17';
  const spend = (day: string, amount: number) => ({ date: vnDateToMs(day, '12:00'), amount });

  it('chi thêm = tổng quanh Tết − mức thường ngày × số ngày của kỳ Tết', () => {
    // Nền: 60 ngày 28/11/2025 → 26/01/2026, mỗi ngày 100k. Kỳ Tết 27/01 → 24/02 (29 ngày): chi 5tr.
    const base = Array.from({ length: 60 }, (_, i) => spend(addDay('2025-11-28', i), 100_000));
    const festive = [spend('2026-02-10', 3_000_000), spend('2026-02-16', 2_000_000)];
    expect(estimateTetExtraSpend([...base, ...festive], tet)).toEqual({
      total: 5_000_000,
      extra: 5_000_000 - 100_000 * 29,
    });
  });

  it('thiếu lịch sử → null', () => {
    expect(estimateTetExtraSpend([spend('2026-02-10', 1_000_000)], tet)).toBeNull();
    expect(estimateTetExtraSpend([], tet)).toBeNull();
  });
});

describe('planTet', () => {
  it('chia phần còn thiếu đều cho số tháng tới hạn (7 ngày trước Tết)', () => {
    const p = planTet({
      today: '2026-10-17',
      tet: '2027-02-06',
      expectedSpend: 12_000_000,
      expectedBonus: 5_000_000,
      countBonus: true,
      saved: 1_000_000,
    });
    expect(p.deadline).toBe('2027-01-30');
    expect(p.target).toBe(7_000_000);
    expect(p.remaining).toBe(6_000_000);
    expect(p.monthsLeft).toBe(4); // 105 ngày / 30 → 4
    expect(p.perMonth).toBe(1_500_000);
    expect(p.covered).toBe(false);
  });

  it('không dựa vào thưởng: mục tiêu là cả chi phí; thưởng đủ thì covered', () => {
    const base = { today: '2026-10-17', tet: '2027-02-06', expectedSpend: 10_000_000, saved: 0 };
    expect(planTet({ ...base, expectedBonus: 15_000_000, countBonus: false }).target).toBe(10_000_000);
    const covered = planTet({ ...base, expectedBonus: 15_000_000, countBonus: true });
    expect(covered).toMatchObject({ target: 0, perMonth: 0, covered: true });
  });

  it('sát hạn: vẫn chia cho ít nhất 1 tháng', () => {
    const p = planTet({
      today: '2027-01-29',
      tet: '2027-02-06',
      expectedSpend: 3_000_000,
      expectedBonus: 0,
      countBonus: false,
      saved: 0,
    });
    expect(p.monthsLeft).toBe(1);
    expect(p.perMonth).toBe(3_000_000);
  });
});

// ── trợ giúp cho test ─────────────────────────────────────────────────────────
function addDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
