import { parseQuestion, previousAskPeriod, type AskPeriod } from './parse';

// Thứ Sáu 16/10/2026
const TODAY = '2026-10-16';
const q = (text: string, startDay = 1) => parseQuestion(text, TODAY, startDay);
const periodOf = (text: string) => (q(text) as unknown as { period: AskPeriod }).period;

describe('parseQuestion', () => {
  it('tổng chi trong kỳ, mặc định tháng này', () => {
    expect(q('tháng này tôi tiêu bao nhiêu?')).toMatchObject({
      kind: 'total',
      flow: 'expense',
      terms: [],
      period: { start: '2026-10-01', end: '2026-10-31', label: 'tháng này' },
    });
  });

  it('lọc theo từ khoá còn lại (danh mục / tag / tên quán)', () => {
    expect(q('ăn uống tháng trước hết bao nhiêu')).toMatchObject({
      kind: 'total',
      terms: ['an', 'uong'],
      period: { start: '2026-09-01', end: '2026-09-30' },
    });
    expect(q('cafe tuần này mình chi bao nhiêu')).toMatchObject({
      terms: ['cafe'],
      period: { start: '2026-10-12', end: '2026-10-18', label: 'tuần này' },
    });
  });

  it('thu nhập', () => {
    expect(q('lương tháng 9 nhận bao nhiêu')).toMatchObject({
      flow: 'income',
      period: { start: '2026-09-01', end: '2026-09-30', label: 'tháng {n}', params: { n: 9 } },
    });
  });

  it('chu kỳ lương ngày 17 (hôm nay 16/10 vẫn thuộc kỳ 17/9–16/10)', () => {
    expect(q('tháng này chi bao nhiêu', 17)).toMatchObject({
      period: { start: '2026-09-17', end: '2026-10-16' },
    });
  });

  it('hôm qua, N ngày qua, năm nay', () => {
    expect(periodOf('hôm qua tiêu bao nhiêu')).toMatchObject({ start: '2026-10-15', end: '2026-10-15' });
    expect(periodOf('30 ngày qua chi bao nhiêu')).toMatchObject({ start: '2026-09-17', end: '2026-10-16' });
    expect(periodOf('năm nay chi bao nhiêu')).toMatchObject({ kind: 'year' });
  });

  it('so sánh, đếm, lớn nhất, danh mục nhiều nhất', () => {
    expect(q('tháng này chi nhiều hơn tháng trước không so với tháng trước')).toMatchObject({
      kind: 'total',
      compare: true,
    });
    expect(q('tháng này đi cafe mấy lần')).toMatchObject({ kind: 'count', terms: ['cafe'] });
    expect(q('khoản chi lớn nhất tháng này')).toMatchObject({ kind: 'biggest' });
    expect(q('tháng này tiêu nhiều nhất vào đâu')).toMatchObject({ kind: 'top_category' });
  });

  it('số dư và ngân sách', () => {
    expect(q('số dư momo')).toMatchObject({ kind: 'balance', terms: ['momo'] });
    expect(q('ngân sách đổ xăng còn bao nhiêu')).toMatchObject({ kind: 'budget', terms: ['do', 'xang'] });
  });

  it('câu lạ → unknown', () => {
    expect(q('xin chào')).toEqual({ kind: 'unknown' });
    expect(q('')).toEqual({ kind: 'unknown' });
  });

  it('kỳ trước của tuần = tuần liền trước', () => {
    const week = q('tuần này chi bao nhiêu');
    if (week.kind !== 'total') throw new Error('sai');
    expect(previousAskPeriod(week.period, 1)).toMatchObject({ start: '2026-10-05', end: '2026-10-11' });
  });
});
