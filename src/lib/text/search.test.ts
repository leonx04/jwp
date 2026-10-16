import { matchesSearch } from './search';

describe('matchesSearch', () => {
  it('ô tìm rỗng khớp tất cả', () => {
    expect(matchesSearch('', 'bất kỳ')).toBe(true);
    expect(matchesSearch('   ', 'bất kỳ')).toBe(true);
  });

  it('gõ không dấu khớp mọi biến thể dấu', () => {
    expect(matchesSearch('ca phe', 'Cà phê sáng')).toBe(true);
    expect(matchesSearch('luong', 'Lương tháng 10')).toBe(true);
    expect(matchesSearch('do xang', 'Đổ xăng')).toBe(true);
  });

  it('gõ có dấu thì khớp đúng dấu', () => {
    expect(matchesSearch('cà phê', 'Cà phê sáng')).toBe(true);
    expect(matchesSearch('cà phê', 'Cá phê')).toBe(false);
    expect(matchesSearch('lương', 'Luông')).toBe(false);
    expect(matchesSearch('đổ', 'Do xang')).toBe(false);
  });

  it('khớp đầu từ, không khớp giữa từ', () => {
    expect(matchesSearch('an', 'Ăn sáng')).toBe(true);
    expect(matchesSearch('an', 'Thanh toán')).toBe(false);
    expect(matchesSearch('thanh', 'Thanh toán')).toBe(true);
  });

  it('nhiều từ phải khớp tất cả, không cần đứng cạnh nhau', () => {
    expect(matchesSearch('xang mb', 'Đổ xăng', 'MB bank')).toBe(true);
    expect(matchesSearch('xang tp', 'Đổ xăng', 'MB bank')).toBe(false);
  });

  it('chuỗi gõ kiểu tổ hợp (NFD) vẫn khớp', () => {
    expect(matchesSearch('cà'.normalize('NFD'), 'Cà phê')).toBe(true);
  });

  it('bỏ qua trường rỗng', () => {
    expect(matchesSearch('a', null, undefined, '')).toBe(false);
    expect(matchesSearch('ghi', null, 'ghi chú')).toBe(true);
  });
});
