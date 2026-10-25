import { pickTodos } from './todos';

const TODAY = '2026-10-25';
const occ = (date: string, status: 'overdue' | 'upcoming' = 'upcoming', id = date) => ({
  id,
  date,
  status,
});
const debt = (
  id: string,
  status: 'overdue' | 'due-soon' | 'open' | 'settled',
  extra: { daysToDue?: number | null; terms?: object | null; remaining?: number } = {},
) => ({
  debt: { id },
  status,
  daysToDue: extra.daysToDue ?? null,
  terms: (extra.terms ?? null) as never,
  remaining: extra.remaining ?? 100,
});

describe('pickTodos', () => {
  it('kỳ quá hạn lên đầu, rồi tới kỳ gần nhất trong 7 ngày; xa hơn thì bỏ', () => {
    const r = pickTodos({
      today: TODAY,
      occurrences: [
        occ('2026-10-30'),
        occ('2026-11-05'),
        occ('2026-10-20', 'overdue'),
        occ('2026-10-26'),
      ],
      debts: [],
    });
    expect(r.occurrences.map((o) => o.date)).toEqual(['2026-10-20', '2026-10-26', '2026-10-30']);
    expect(r.moreOccurrences).toBe(0);
  });

  it('nhiều kỳ quá → giữ 5, báo số còn lại', () => {
    const many = Array.from({ length: 8 }, (_, i) => occ(`2026-10-2${i + 1}`.slice(0, 10)));
    const r = pickTodos({ today: TODAY, occurrences: many, debts: [] });
    expect(r.occurrences).toHaveLength(5);
    expect(r.moreOccurrences).toBe(3);
  });

  it('nợ: chỉ khoản quá hạn / sắp đến hạn, bỏ khoản vay theo kỳ (đã có ở lịch)', () => {
    const r = pickTodos({
      today: TODAY,
      occurrences: [],
      debts: [
        debt('a', 'open'),
        debt('b', 'due-soon', { daysToDue: 3 }),
        debt('c', 'overdue', { daysToDue: -2 }),
        debt('d', 'overdue', { terms: { annualRate: 12 } }),
        debt('e', 'due-soon', { daysToDue: 1 }),
        debt('f', 'settled'),
      ],
    });
    expect(r.debts.map((d) => d.debt.id)).toEqual(['c', 'e', 'b']);
  });
});
