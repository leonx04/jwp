import { runwayMonths } from './runway';

describe('runwayMonths', () => {
  it('chia số dư cho chi tiêu tháng và phân mức', () => {
    expect(runwayMonths(5_000_000, 10_000_000)).toEqual({ months: 0.5, level: 'low' });
    expect(runwayMonths(40_000_000, 10_000_000)).toEqual({ months: 4, level: 'ok' });
    expect(runwayMonths(75_000_000, 10_000_000)).toEqual({ months: 7.5, level: 'good' });
  });

  it('số dư âm coi như 0 tháng; chưa biết chi tiêu → null', () => {
    expect(runwayMonths(-1_000, 10_000_000)).toEqual({ months: 0, level: 'low' });
    expect(runwayMonths(1_000, 0)).toBeNull();
  });
});
