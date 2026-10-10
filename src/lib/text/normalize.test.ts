import { normalizeForSearch, removeDiacritics } from './normalize';

describe('removeDiacritics', () => {
  it.each([
    ['Cà phê sữa đá', 'Ca phe sua da'],
    ['ĐI CHỢ', 'DI CHO'],
    ['Tiền điện nước', 'Tien dien nuoc'],
    ['Quỹ du lịch', 'Quy du lich'],
    ['abc 123', 'abc 123'],
  ])('%s → %s', (input, expected) => {
    expect(removeDiacritics(input)).toBe(expected);
  });

  it('xử lý cả chuỗi tổ hợp sẵn (NFD) do bàn phím Android sinh ra', () => {
    expect(removeDiacritics('Cà phê'.normalize('NFD'))).toBe('Ca phe');
  });
});

describe('normalizeForSearch', () => {
  it('chữ thường, gộp khoảng trắng, cắt hai đầu', () => {
    expect(normalizeForSearch('  Cà   PHÊ  Sáng ')).toBe('ca phe sang');
  });
});
