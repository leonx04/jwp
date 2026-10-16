import { projectSalary } from './projection';

const base = {
  today: '2026-10-16',
  currentIncome: 15_000_000,
  newIncome: 18_000_000,
  effectiveFrom: '2026-12-01',
  currentExpense: 10_000_000,
  extraSpendRatio: 0.3,
};

describe('projectSalary', () => {
  it('trước tháng hiệu lực giữ nguyên, từ tháng hiệu lực dùng lương mới', () => {
    const p = projectSalary(base);
    expect(p.months).toHaveLength(12);
    expect(p.months[0]).toMatchObject({ month: '2026-10', income: 15_000_000, surplus: 5_000_000 });
    expect(p.months[1]).toMatchObject({ month: '2026-11', income: 15_000_000 });
    expect(p.months[2]).toMatchObject({ month: '2026-12', income: 18_000_000 });
  });

  it('phần tăng thêm chia theo tỷ lệ chi thêm', () => {
    const p = projectSalary(base);
    // tăng 3tr, chi thêm 30% = 0,9tr → dư thêm 2,1tr mỗi tháng
    expect(p.monthlyRaise).toBe(3_000_000);
    expect(p.extraSurplusPerMonth).toBe(2_100_000);
    // 10 tháng (12/2026 → 09/2027) × 2,1tr
    expect(p.totalExtraSaved).toBe(21_000_000);
  });

  it('tỷ lệ tiết kiệm tăng khi lương tăng', () => {
    const p = projectSalary(base);
    expect(p.baseSavingRate).toBeCloseTo(5 / 15, 5);
    expect(p.savingRate).toBeCloseTo(7.1 / 18, 5);
    expect(p.savingRate).toBeGreaterThan(p.baseSavingRate);
  });

  it('chi hết phần tăng thêm thì không để dành thêm', () => {
    const p = projectSalary({ ...base, extraSpendRatio: 1 });
    expect(p.extraSurplusPerMonth).toBe(0);
    expect(p.totalExtraSaved).toBe(0);
  });

  it('tăng thêm mỗi năm sau mốc đầu', () => {
    const p = projectSalary({ ...base, months: 24, yearlyRaisePct: 10 });
    expect(p.months[2].income).toBe(18_000_000); // 12/2026
    expect(p.months[13].income).toBe(18_000_000); // 11/2027 chưa đủ một năm
    expect(p.months[14].income).toBe(19_800_000); // 12/2027: +10%
  });

  it('lạm phát chi tiêu áp cho cả hai kịch bản', () => {
    const p = projectSalary({ ...base, months: 14, yearlyInflationPct: 10 });
    expect(p.months[12].baseExpense).toBe(11_000_000);
    expect(p.months[12].expense).toBeGreaterThan(p.months[12].baseExpense);
  });

  it('quỹ tiết kiệm đạt sớm hơn khi lương tăng', () => {
    const p = projectSalary({
      ...base,
      goals: [{ id: 'g', name: 'Mua laptop', remaining: 60_000_000 }],
    });
    const [goal] = p.goals;
    expect(goal.baseMonths).toBe(12); // 5tr/tháng
    expect(goal.months).toBeLessThan(12);
    expect(goal.monthsEarlier).toBeGreaterThan(0);
  });

  it('không có tiền dư thì quỹ không bao giờ đạt (null)', () => {
    const p = projectSalary({
      ...base,
      currentExpense: 16_000_000,
      newIncome: 15_000_000,
      goals: [{ id: 'g', name: 'X', remaining: 1_000_000 }],
    });
    expect(p.goals[0]).toMatchObject({ baseMonths: null, months: null, monthsEarlier: null });
  });

  it('bỏ qua quỹ đã đạt', () => {
    const p = projectSalary({ ...base, goals: [{ id: 'g', name: 'X', remaining: 0 }] });
    expect(p.goals).toEqual([]);
  });
});
