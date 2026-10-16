import { layoutFlow } from './layout';

const item = (key: string, amount: number) => ({ key, name: key, color: '#000', amount });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('layoutFlow', () => {
  it('thu > chi: có phần "Còn lại", mọi dải nối khớp chiều cao nút', () => {
    const l = layoutFlow({
      income: 15_000_000,
      expenses: [item('an', 5_000_000), item('xang', 2_000_000)],
      height: 300,
      gap: 10,
    })!;
    expect(l.remaining).toBe(8_000_000);
    expect(l.right.map((n) => n.key)).toEqual(['an', 'xang', '__remaining']);
    expect(l.left).toHaveLength(1);
    // tổng cao các dải = cao cột trái
    expect(sum(l.links.map((k) => k.from[1]))).toBeCloseTo(l.left[0].h, 6);
    // mỗi nút phải nhận đủ chiều cao
    l.right.forEach((n) => {
      const got = sum(l.links.filter((k) => k.to[0] >= n.y - 1e-6 && k.to[0] < n.y + n.h - 1e-6).map((k) => k.to[1]));
      expect(got).toBeCloseTo(n.h, 6);
    });
  });

  it('chi > thu: thêm nguồn "Từ số dư", không có "Còn lại"', () => {
    const l = layoutFlow({ income: 10, expenses: [item('a', 8), item('b', 6)], height: 100, gap: 0 })!;
    expect(l.remaining).toBe(-4);
    expect(l.left.map((n) => n.key)).toEqual(['__income', '__shortfall']);
    expect(l.right.some((n) => n.key === '__remaining')).toBe(false);
    expect(sum(l.links.map((k) => k.from[1]))).toBeCloseTo(100, 6);
  });

  it('gom danh mục nhỏ vào "Khác"', () => {
    const l = layoutFlow({
      income: 100,
      expenses: ['a', 'b', 'c', 'd'].map((k, i) => item(k, 10 - i)),
      height: 100,
      topN: 2,
    })!;
    expect(l.right.map((n) => n.key)).toEqual(['a', 'b', '__other', '__remaining']);
    expect(l.right[2].amount).toBe(8 + 7);
  });

  it('không có dữ liệu → null', () => {
    expect(layoutFlow({ income: 0, expenses: [], height: 100 })).toBeNull();
  });
});
