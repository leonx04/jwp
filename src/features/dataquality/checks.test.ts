import { vnDateToMs } from '@/lib/date';

import { findIssues, type CheckTx } from './checks';

const NOW = vnDateToMs('2026-10-16', '12:00');
let n = 0;
const tx = (patch: Partial<CheckTx> & { day?: string; time?: string }): CheckTx => {
  const { day = '2026-10-10', time = '09:00', ...rest } = patch;
  return {
    id: `t${++n}`,
    type: 'expense',
    amount: 35_000,
    date: vnDateToMs(day, time),
    title: 'Cafe',
    accountId: 'a',
    categoryId: 'food',
    ...rest,
  };
};

const kinds = (issues: ReturnType<typeof findIssues>) => issues.map((i) => i.kind);

describe('findIssues', () => {
  it('dữ liệu sạch → không có vấn đề', () => {
    expect(findIssues([tx({}), tx({ day: '2026-10-11' })], [{ id: 'g', usage: 2 }], NOW)).toEqual([]);
  });

  it('ngày sai: năm 2010 và tương lai xa; không tính trùng cho giao dịch sai ngày', () => {
    const old = tx({ day: '2010-05-01', title: 'Ăn xôi' });
    const future = tx({ day: '2026-12-31' });
    const issues = findIssues([old, future], [], NOW);
    expect(issues).toEqual([{ kind: 'bad_date', ids: [old.id, future.id] }]);
  });

  it('trùng: cùng ví / số tiền / tên trong 10 phút, khác ví hoặc cách xa thì không', () => {
    const a = tx({ time: '09:00' });
    const b = tx({ time: '09:05' });
    const farAway = tx({ time: '15:00' });
    const otherWallet = tx({ time: '09:02', accountId: 'b' });
    const issues = findIssues([a, b, farAway, otherWallet], [], NOW);
    expect(issues).toEqual([{ kind: 'duplicate', ids: [a.id, b.id] }]);
  });

  it('số tiền bất thường: cần đủ mẫu và chỉ là thiểu số', () => {
    const normal = [1, 2, 3, 4].map((d) => tx({ day: `2026-10-0${d}`, title: 'Đổ xăng', amount: 60_000 }));
    const odd = tx({ day: '2026-10-09', title: 'Đổ xăng', amount: 6_000_000 });
    expect(findIssues([...normal, odd], [], NOW)).toEqual([{ kind: 'outlier', ids: [odd.id] }]);
    // chưa đủ mẫu
    expect(findIssues([normal[0], odd], [], NOW)).toEqual([]);
  });

  it('chưa phân loại (bỏ chuyển khoản) và tag không dùng', () => {
    const noCat = tx({ categoryId: null, title: 'Linh tinh' });
    const transfer = tx({ type: 'transfer', categoryId: null, title: 'Chuyển' });
    const issues = findIssues(
      [noCat, transfer],
      [{ id: 'g1', usage: 0 }, { id: 'g2', usage: 3 }],
      NOW,
    );
    expect(issues).toEqual([
      { kind: 'uncategorized', ids: [noCat.id] },
      { kind: 'unused_tag', ids: ['g1'] },
    ]);
    expect(kinds(issues)).toHaveLength(2);
  });
});
