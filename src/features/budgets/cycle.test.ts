import { cyclePeriodContaining } from './cycle';

describe('cyclePeriodContaining', () => {
  it('không có quy tắc cuối tuần: đúng ngày bắt đầu', () => {
    expect(cyclePeriodContaining('2026-10-20', 17)).toEqual({
      start: '2026-10-17',
      end: '2026-11-16',
    });
    expect(cyclePeriodContaining('2026-10-16', 17)).toEqual({
      start: '2026-09-17',
      end: '2026-10-16',
    });
  });

  it('ngày 17/10/2026 là thứ Bảy → lương về thứ Hai 19/10', () => {
    expect(cyclePeriodContaining('2026-10-18', 17, 'after')).toEqual({
      start: '2026-09-17',
      end: '2026-10-18',
    });
    expect(cyclePeriodContaining('2026-10-19', 17, 'after')).toEqual({
      start: '2026-10-19',
      // 17/11/2026 là thứ Ba nên kỳ sau bắt đầu đúng ngày 17/11
      end: '2026-11-16',
    });
  });

  it('Chủ nhật → thứ Hai kế tiếp; lùi về thứ Sáu khi chọn before', () => {
    // 17/01/2027 là Chủ nhật
    expect(cyclePeriodContaining('2027-01-18', 17, 'after').start).toBe('2027-01-18');
    expect(cyclePeriodContaining('2027-01-15', 17, 'before').start).toBe('2027-01-15');
  });

  it('ngày 31 ở tháng ngắn lấy ngày cuối tháng', () => {
    expect(cyclePeriodContaining('2026-02-28', 31)).toEqual({
      start: '2026-02-28',
      end: '2026-03-30',
    });
  });

  it('qua năm mới', () => {
    expect(cyclePeriodContaining('2026-12-31', 17)).toEqual({
      start: '2026-12-17',
      end: '2027-01-16',
    });
  });
});
