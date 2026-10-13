import { reconcileHints, type ReconcileTx } from './hints';

const money = (n: number) => `${n.toLocaleString('vi-VN')} đ`;
const names = new Map([
  ['mb', 'MB bank'],
  ['tp', 'TP Bank'],
]);
const DAY = 86_400_000;
let n = 0;
const tx = (p: Partial<ReconcileTx> & Pick<ReconcileTx, 'type' | 'amount'>): ReconcileTx => ({
  id: `t${++n}`,
  date: 1_700_000_000_000,
  title: '',
  accountId: 'mb',
  toAccountId: null,
  isAdjustment: false,
  ...p,
});
const run = (diff: number, txs: ReconcileTx[]) =>
  reconcileHints({ diff, accountId: 'mb', txs, accountNames: names, money });
const kinds = (diff: number, txs: ReconcileTx[]) => run(diff, txs).map((h) => h.kind);

describe('reconcileHints', () => {
  it('đã khớp → không có gợi ý', () => {
    expect(run(0, [tx({ type: 'expense', amount: 5 })])).toEqual([]);
  });

  it('khoản chi ghi hai lần → gợi ý ghi trùng (app thiếu tiền)', () => {
    const a = tx({ type: 'expense', amount: 180_000, title: 'Ăn gà' });
    const b = tx({ type: 'expense', amount: 180_000, title: 'Ăn gà', date: a.date + DAY / 2 });
    const hints = run(180_000, [a, b]);
    expect(hints[0].kind).toBe('duplicate');
    expect(hints[0].txId).toBe(a.id < b.id ? a.id : b.id);
  });

  it('hai khoản cách xa nhau không bị coi là trùng', () => {
    const a = tx({ type: 'expense', amount: 200_000 });
    const b = tx({ type: 'expense', amount: 200_000, date: a.date + 10 * DAY });
    expect(kinds(200_000, [a, b])).not.toContain('duplicate');
  });

  it('chênh đúng 2 lần một khoản → ghi nhầm loại', () => {
    const t = tx({ type: 'income', amount: 150_000, title: 'Hoàn cọc xe' });
    const hints = run(-300_000, [t]);
    expect(hints.map((h) => h.kind)).toContain('wrong-type');
  });

  it('khoản cùng số tiền ở ví khác → gợi ý nhầm ví', () => {
    const other = tx({ type: 'expense', amount: 513_000, title: 'Claude Code', accountId: 'tp' });
    const hints = run(-513_000, [other]);
    expect(hints[0].kind).toBe('wrong-wallet');
    expect(hints[0].text).toContain('TP Bank');
  });

  it('chênh bằng mức phí hay gặp → gợi ý phí', () => {
    expect(kinds(-3_300, [])).toContain('fee');
    expect(kinds(3_300, [])).not.toContain('fee');
  });

  it('luôn có gợi ý "thiếu khoản" ở cuối, đúng chiều', () => {
    const up = run(50_000, []);
    expect(up[up.length - 1]).toMatchObject({ kind: 'missing' });
    expect(up[0].text).toContain('thu');
    const down = run(-50_000, []);
    expect(down[0].text).toContain('chi');
  });

  it('bỏ qua giao dịch điều chỉnh số dư', () => {
    const a = tx({ type: 'expense', amount: 100, isAdjustment: true });
    const b = tx({ type: 'expense', amount: 100, isAdjustment: true });
    expect(kinds(100, [a, b])).not.toContain('duplicate');
  });
});
