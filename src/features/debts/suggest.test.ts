import { suggestDebts, type SuggestTx } from './suggest';

let n = 0;
const tx = (
  type: 'income' | 'expense',
  amount: number,
  title: string,
  categoryName: string | null,
  day: number,
): SuggestTx => ({
  id: `t${++n}`,
  type,
  amount,
  date: Date.UTC(2026, 6, day),
  title,
  categoryName,
  accountId: 'acc',
});

// Mẫu thật lấy từ cách người dùng ghi tiêu đề giao dịch
const SAMPLE: SuggestTx[] = [
  tx('income', 200_000, 'Mượn a Quý', 'Vay nợ', 16),
  tx('income', 1_000_000, 'Mượn a Nguyên', 'Vay nợ', 16),
  tx('income', 800_000, 'Mượn a Toàn', 'Vay nợ', 16),
  tx('expense', 200_000, 'Nợ a Quý', 'Vay nợ', 17),
  tx('expense', 1_000_000, 'Nợ a Nguyên', 'Vay nợ', 17),
  tx('expense', 178_000, 'Nợ c Hiền', 'Vay nợ', 17),
  tx('income', 2_000_000, 'Vay bạn Phương', 'Vay nợ', 26),
  tx('expense', 800_000, 'Nợ a Toàn', 'Hóa đơn', 28),
  tx('expense', 1_000_000, 'Nợ Phương', 'Vay nợ', 28),
  tx('expense', 200_000, 'Cho em Lít Vay', 'Vay nợ', 30),
  tx('income', 200_000, 'E Lít trả', 'Cho Mượn', 31),
  tx('expense', 300_000, 'Chuyển Thùy', 'Cho Mượn', 9),
  // không phải nợ
  tx('expense', 300_000, 'Trả tiền ăn', 'Hóa đơn', 20),
  tx('expense', 2_000_000, 'Trả tiền bồi thường tai nạn', 'Hóa đơn', 29),
  tx('expense', 513_000, '', 'Claude Code', 25),
];

describe('suggestDebts', () => {
  const result = suggestDebts(SAMPLE);
  const find = (name: string) => result.find((p) => p.personName === name)!;

  it('nhận ra người đi vay và trả đủ → còn 0', () => {
    for (const name of ['a Quý', 'a Nguyên']) {
      const p = find(name);
      expect(p.direction).toBe('borrowed');
      expect(p.remaining).toBe(0);
      expect(p.records).toHaveLength(1);
      expect(p.records[0].type).toBe('repay');
    }
  });

  it('"Nợ a Toàn" trong danh mục Hóa đơn vẫn là trả nợ; "bạn" bị bỏ khỏi tên', () => {
    expect(find('a Toàn').remaining).toBe(0);
    const phuong = find('Phương');
    expect(phuong.direction).toBe('borrowed');
    expect(phuong.opening.amount).toBe(2_000_000);
    expect(phuong.remaining).toBe(1_000_000);
  });

  it('khoản chỉ có phần trả, không có phần gốc: "c Hiền" không đủ gốc → bỏ', () => {
    // "Nợ c Hiền" là trả nợ nhưng không có "Mượn c Hiền" → không tạo gợi ý
    expect(result.find((p) => p.personName.includes('Hiền'))).toBeUndefined();
  });

  it('cho vay và nhận trả lại', () => {
    const lit = find('em Lít');
    expect(lit.direction).toBe('lent');
    expect(lit.remaining).toBe(0);
    const thuy = find('Thùy');
    expect(thuy.direction).toBe('lent');
    expect(thuy.remaining).toBe(300_000);
  });

  it('không bắt nhầm "Trả tiền ăn" hay giao dịch không tiêu đề', () => {
    expect(result.find((p) => /tiền|Claude/i.test(p.personName))).toBeUndefined();
    expect(result).toHaveLength(6);
  });

  it('khoản còn nợ xếp trước', () => {
    expect(result[0].remaining).toBeGreaterThan(0);
  });

  it('vay thêm cùng người → increase', () => {
    const more = suggestDebts([
      tx('income', 100, 'Mượn Nam', null, 1),
      tx('income', 50, 'Mượn Nam', null, 2),
      tx('expense', 30, 'Trả nợ Nam', null, 3),
    ]);
    expect(more).toHaveLength(1);
    expect(more[0].records.map((r) => r.type)).toEqual(['increase', 'repay']);
    expect(more[0].remaining).toBe(120);
  });
});
