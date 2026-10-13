import { dominantCategory, matchRule, type RuleLike } from './rules';

let n = 0;
const rule = (pattern: string, over: Partial<RuleLike> = {}): RuleLike => ({
  id: `r${++n}`,
  pattern,
  type: null,
  categoryId: `cat-${pattern}`,
  autoAccept: false,
  createdAt: n,
  ...over,
});
const subject = (content: string, over = {}) => ({
  type: 'expense' as const,
  content,
  counterparty: null,
  ...over,
});

describe('matchRule', () => {
  it('khớp không phân biệt hoa thường và dấu', () => {
    const r = rule('Phở Thìn');
    expect(matchRule([r], subject('THANH TOAN PHO THIN 13 LO DUC'))).toBe(r);
  });

  it('cụm dài hơn thắng', () => {
    const coffee = rule('coffee');
    const highlands = rule('highlands coffee');
    expect(matchRule([coffee, highlands], subject('Highlands Coffee Vincom'))).toBe(highlands);
    expect(matchRule([coffee, highlands], subject('Phuc Long Coffee'))).toBe(coffee);
  });

  it('cùng độ dài thì quy tắc tạo trước thắng', () => {
    const a = rule('grab', { createdAt: 1 });
    const b = rule('grab', { createdAt: 2 });
    expect(matchRule([b, a], subject('GRAB*TRIP'))).toBe(a);
  });

  it('lọc theo loại thu / chi', () => {
    const r = rule('luong', { type: 'income' });
    expect(matchRule([r], subject('Luong thang 9', { type: 'expense' }))).toBeNull();
    expect(matchRule([r], subject('Luong thang 9', { type: 'income' }))).toBe(r);
  });

  it('cụm quá ngắn bị bỏ qua; xét cả tên người chuyển', () => {
    expect(matchRule([rule('an')], subject('nhan tien'))).toBeNull();
    const r = rule('nguyen van a');
    expect(
      matchRule([r], { type: 'income', content: 'chuyen tien', counterparty: 'NGUYEN VAN A' }),
    ).toBe(r);
  });

  it('không có nội dung → không khớp', () => {
    expect(matchRule([rule('abc')], subject(''))).toBeNull();
  });
});

describe('dominantCategory', () => {
  it('một danh mục áp đảo (≥60%) mới được chọn', () => {
    expect(dominantCategory(new Map([['an', 3]]))).toBe('an');
    expect(
      dominantCategory(
        new Map([
          ['an', 3],
          ['xe', 1],
        ]),
      ),
    ).toBe('an');
    expect(
      dominantCategory(
        new Map([
          ['an', 2],
          ['xe', 2],
        ]),
      ),
    ).toBeNull();
    expect(dominantCategory(new Map())).toBeNull();
  });
});
