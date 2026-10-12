import { formatLunar, lunarLabel, lunarYearName, solarToLunar, toLunar } from './index';

describe('âm lịch Việt Nam', () => {
  it.each([
    // [dương lịch, ngày, tháng, năm âm, nhuận]
    ['2025-01-29', 1, 1, 2025, false], // Tết Ất Tỵ
    ['2026-02-17', 1, 1, 2026, false], // Tết Bính Ngọ
    ['2026-02-16', 29, 12, 2025, false], // Giao thừa (tháng Chạp thiếu)
    ['2024-02-10', 1, 1, 2024, false], // Tết Giáp Thìn
    ['2027-02-06', 1, 1, 2027, false], // Tết Đinh Mùi
    ['2026-09-25', 15, 8, 2026, false], // Trung thu 2026
    ['2025-10-06', 15, 8, 2025, false], // Trung thu 2025
    ['2025-09-06', 15, 7, 2025, false], // Vu Lan 2025
    ['2026-04-26', 10, 3, 2026, false], // Giỗ Tổ Hùng Vương 2026
    ['2026-10-10', 1, 9, 2026, false],
  ])('%s → %i/%i/%i', (date, day, month, year, leap) => {
    expect(toLunar(date)).toEqual({ day, month, year, leap });
  });

  it('tháng nhuận', () => {
    expect(toLunar('2025-07-25')).toEqual({ day: 1, month: 6, year: 2025, leap: true });
    expect(toLunar('2025-08-23')).toEqual({ day: 1, month: 7, year: 2025, leap: false });
    expect(toLunar('2023-03-22')).toEqual({ day: 1, month: 2, year: 2023, leap: true });
    expect(toLunar('2020-05-23')).toEqual({ day: 1, month: 4, year: 2020, leap: true });
  });

  it('tính theo giờ Việt Nam (UTC+7), khác lịch Trung Quốc (UTC+8) ở vài năm', () => {
    // Tết Ất Sửu: Việt Nam 21/01/1985, Trung Quốc 20/02/1985
    expect(toLunar('1985-01-21')).toMatchObject({ day: 1, month: 1, year: 1985 });
    expect(solarToLunar(20, 2, 1985, 8)).toMatchObject({ day: 1, month: 1, year: 1985 });
    // Tết Đinh Hợi: Việt Nam 17/02/2007, Trung Quốc 18/02/2007
    expect(toLunar('2007-02-17')).toMatchObject({ day: 1, month: 1, year: 2007 });
    expect(solarToLunar(17, 2, 2007, 8)).toMatchObject({ day: 30, month: 12, year: 2006 });
  });

  it('nhãn ô lịch: mùng 1 hiện tháng, ngày khác chỉ hiện ngày', () => {
    expect(lunarLabel('2026-10-10')).toBe('1/9');
    expect(lunarLabel('2026-10-11')).toBe('2');
    expect(lunarLabel('2025-07-25')).toBe('1/6N');
  });

  it('tên năm can chi và mô tả đầy đủ', () => {
    expect(lunarYearName(2026)).toBe('Bính Ngọ');
    expect(lunarYearName(2025)).toBe('Ất Tỵ');
    expect(lunarYearName(1985)).toBe('Ất Sửu');
    expect(formatLunar('2026-09-25')).toBe('Rằm tháng 8 năm Bính Ngọ');
    expect(formatLunar('2026-02-17')).toBe('Mùng 1 tháng Giêng năm Bính Ngọ');
    expect(formatLunar('2025-07-25')).toBe('Mùng 1 tháng 6 nhuận năm Ất Tỵ');
    expect(formatLunar('2026-02-16')).toBe('Ngày 29 tháng Chạp năm Ất Tỵ');
  });
});
