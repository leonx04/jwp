import {
  LoanInputError,
  annuityPayment,
  buildSchedule,
  effectiveAnnualRate,
  simulatePrepayment,
  summarizeLoan,
  type LoanTerms,
} from './amortize';

// Ví dụ trong kế hoạch: vay 50 triệu, 12%/năm, 12 kỳ
const base: LoanTerms = { principal: 50_000_000, annualRate: 12, months: 12, method: 'annuity' };

const sumOf = (rows: { principal: number }[]) => rows.reduce((s, r) => s + r.principal, 0);

describe('bốn cách tính lãi', () => {
  it('trả đều (niên kim): mọi kỳ 4.442.439, kỳ cuối nhận phần chênh làm tròn', () => {
    const s = buildSchedule(base);
    expect(s.rows).toHaveLength(12);
    expect(s.rows.slice(0, 11).every((r) => r.payment === 4_442_439)).toBe(true);
    expect(s.lastPayment).toBe(4_442_447);
    expect(s.totalInterest).toBe(3_309_276);
    expect(s.rows[0]).toMatchObject({ interest: 500_000, principal: 3_942_439 });
    expect(s.rows.at(-1)!.balance).toBe(0);
    expect(sumOf(s.rows)).toBe(50_000_000);
  });

  it('gốc đều: gốc cố định, lãi giảm dần', () => {
    const s = buildSchedule({ ...base, method: 'equal_principal' });
    expect(s.firstPayment).toBe(4_666_667);
    expect(s.lastPayment).toBe(4_208_330);
    expect(s.totalInterest).toBe(3_250_000);
    expect(s.rows.map((r) => r.payment)).toEqual(
      [...s.rows.map((r) => r.payment)].sort((a, b) => b - a),
    );
  });

  it('lãi phẳng: lãi tính trên gốc ban đầu, lãi thực khoảng 21,5%/năm', () => {
    const s = summarizeLoan({ ...base, method: 'flat' });
    expect(s.firstPayment).toBe(4_666_667);
    expect(s.rows.every((r) => r.interest === 500_000)).toBe(true);
    expect(s.totalInterest).toBe(6_000_000);
    expect(s.effectiveRate).toBeCloseTo(21.46, 1);
  });

  it('trả lãi hằng kỳ, gốc cuối kỳ', () => {
    const s = buildSchedule({ ...base, method: 'interest_only' });
    expect(s.rows.slice(0, 11).every((r) => r.payment === 500_000 && r.principal === 0)).toBe(true);
    expect(s.lastPayment).toBe(50_500_000);
    expect(s.totalInterest).toBe(6_000_000);
  });

  it('lãi thực của dư nợ giảm dần bằng lãi niêm yết', () => {
    expect(summarizeLoan(base).effectiveRate).toBeCloseTo(12, 3);
    expect(summarizeLoan({ ...base, method: 'equal_principal' }).effectiveRate).toBeCloseTo(12, 3);
  });

  it('lãi 0%: chia đều gốc', () => {
    const s = buildSchedule({ ...base, annualRate: 0, months: 3, principal: 1_000_000 });
    expect(s.rows.map((r) => r.payment)).toEqual([333_333, 333_333, 333_334]);
    expect(s.totalInterest).toBe(0);
    expect(annuityPayment(900, 0, 3)).toBe(300);
  });
});

describe('tuỳ chọn hợp đồng', () => {
  it('ưu đãi 6 tháng 8% rồi thả nổi 12%: số trả đều tính lại từ kỳ 7', () => {
    const s = buildSchedule({
      ...base,
      annualRate: 8,
      rateSteps: [{ fromPeriod: 7, annualRate: 12 }],
    });
    const p = s.rows.map((r) => r.payment);
    expect(new Set(p.slice(0, 6)).size).toBe(1);
    expect(p[6]).toBeGreaterThan(p[5]);
    expect(s.rows[6].annualRate).toBe(12);
    expect(s.rows.at(-1)!.balance).toBe(0);
  });

  it('ân hạn gốc 3 tháng: chỉ trả lãi, sau đó trả đều trong 9 kỳ', () => {
    const s = buildSchedule({ ...base, graceMonths: 3 });
    expect(s.rows.slice(0, 3).map((r) => r.payment)).toEqual([500_000, 500_000, 500_000]);
    expect(s.rows[3].payment).toBe(Math.round(annuityPayment(50_000_000, 0.01, 9)));
    expect(s.rows.at(-1)!.balance).toBe(0);
  });

  it('ngày đến hạn theo ngày giải ngân, tháng ngắn lùi về cuối tháng', () => {
    const s = buildSchedule({ ...base, months: 3, startDate: '2026-01-31' });
    expect(s.rows.map((r) => r.date)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('lãi theo ngày thực / 365', () => {
    const s = buildSchedule({
      ...base,
      months: 2,
      startDate: '2026-01-31',
      dayCount: 'actual_365',
    });
    // 28 ngày của tháng 2 trên 50 triệu, 12%/năm
    expect(s.rows[0].interest).toBe(Math.round((50_000_000 * 0.12 * 28) / 365));
  });

  it('phí hằng kỳ và phí trả trước làm tăng lãi thực', () => {
    const s = summarizeLoan({ ...base, monthlyFee: 50_000 }, 1_000_000);
    expect(s.rows[0].payment).toBe(4_442_439 + 50_000);
    expect(s.totalFee).toBe(600_000);
    expect(s.effectiveRate!).toBeGreaterThan(15);
  });

  it('từ chối dữ liệu sai', () => {
    expect(() => buildSchedule({ ...base, principal: 0 })).toThrow(LoanInputError);
    expect(() => buildSchedule({ ...base, months: 0 })).toThrow(LoanInputError);
    expect(() => buildSchedule({ ...base, annualRate: -1 })).toThrow(LoanInputError);
    expect(() => buildSchedule({ ...base, graceMonths: 12 })).toThrow(LoanInputError);
  });
});

describe('lãi thực', () => {
  it('trả đúng số nhận thì lãi 0', () => {
    expect(
      effectiveAnnualRate(1200, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]),
    ).toBeCloseTo(0, 6);
  });
  it('không có nghĩa khi trả ít hơn nhận', () => {
    expect(effectiveAnnualRate(1000, [100])).toBeNull();
  });
});

describe('trả trước hạn', () => {
  it('trả thêm 10 triệu sau kỳ 6, giữ số trả mỗi kỳ: bớt kỳ, tiết kiệm lãi', () => {
    const r = simulatePrepayment({
      terms: base,
      afterPeriod: 6,
      amount: 10_000_000,
      mode: 'shorten',
    });
    expect(r.monthsLeft).toBeLessThan(6);
    expect(r.nextPayment).toBeLessThanOrEqual(4_442_439);
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.after.rows.slice(0, 6)).toEqual(r.before.rows.slice(0, 6));
    expect(r.after.rows.at(-1)!.balance).toBe(0);
  });

  it('giữ số kỳ: bớt số trả mỗi kỳ', () => {
    const r = simulatePrepayment({
      terms: base,
      afterPeriod: 6,
      amount: 10_000_000,
      mode: 'reduce',
    });
    expect(r.monthsLeft).toBe(6);
    expect(r.nextPayment).toBeLessThan(4_442_439);
    expect(r.interestSaved).toBeGreaterThan(0);
  });

  it('phí phạt lớn hơn lãi tiết kiệm thì không có lợi', () => {
    const r = simulatePrepayment({
      terms: base,
      afterPeriod: 11,
      amount: 4_000_000,
      mode: 'reduce',
      feePercent: 5,
    });
    expect(r.netSaving).toBeLessThan(0);
  });

  it('trả hết dư nợ là tất toán', () => {
    const r = simulatePrepayment({
      terms: base,
      afterPeriod: 3,
      amount: 999_000_000,
      mode: 'reduce',
    });
    expect(r.monthsLeft).toBe(0);
    expect(r.after.rows).toHaveLength(3);
  });
});
