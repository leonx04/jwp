import { vnDateToMs } from '@/lib/date';

import { detectRecurring, titleKey, type RecurringTx } from './detect';

let n = 0;
const tx = (
  date: string,
  amount: number,
  title: string,
  extra: Partial<RecurringTx> = {},
): RecurringTx => ({
  id: `t${++n}`,
  type: 'expense',
  amount,
  date: vnDateToMs(date, '09:00'),
  title,
  categoryId: null,
  accountId: 'mb',
  ...extra,
});
const run = (txs: RecurringTx[], over: Partial<Parameters<typeof detectRecurring>[0]> = {}) =>
  detectRecurring({ txs, existing: [], today: '2026-10-12', ...over });

describe('titleKey', () => {
  it('bỏ số và "tháng N", gom các tháng về một khoá', () => {
    expect(titleKey('Nhận lương tháng 5')).toBe(titleKey('Lương Tháng 7'));
    expect(titleKey('Tiền phòng T10')).toBe(titleKey('Tiền phòng'));
    expect(titleKey('Spaylater tháng 8')).toBe('spaylater');
  });
});

describe('detectRecurring', () => {
  it('khoản đều hằng tháng (đăng ký) → gợi ý, kỳ tới đúng ngày', () => {
    const r = run([
      tx('2026-07-25', 513_000, 'Claude Code'),
      tx('2026-08-25', 513_000, 'Claude Code'),
      tx('2026-09-25', 513_000, 'Claude Code'),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      title: 'Claude Code',
      amount: 513_000,
      monthDay: 25,
      occurrences: 3,
      isEstimate: false,
      nextDate: '2026-10-25',
      type: 'expense',
    });
  });

  it('đã qua ngày trong tháng này thì kỳ tới là tháng sau', () => {
    const r = run(
      [
        tx('2026-07-05', 100_000, 'Netflix'),
        tx('2026-08-05', 100_000, 'Netflix'),
        tx('2026-09-05', 100_000, 'Netflix'),
      ],
      { today: '2026-10-12' },
    );
    expect(r[0].nextDate).toBe('2026-11-05');
  });

  it('lương: tên khác nhau theo tháng, số tiền dao động → ước tính', () => {
    const r = run([
      tx('2026-07-17', 7_600_000, 'Lương tháng 6', { type: 'income' }),
      tx('2026-08-18', 8_275_000, 'Lương Tháng 7', { type: 'income' }),
      tx('2026-09-17', 7_000_000, 'Lương tháng 8', { type: 'income' }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      type: 'income',
      isEstimate: true,
      amount: 7_600_000,
      monthDay: 17,
    });
  });

  it('thói quen hằng ngày không bị gợi ý', () => {
    const daily = [
      '2026-09-01',
      '2026-09-02',
      '2026-09-04',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-10-01',
      '2026-10-06',
    ];
    expect(run(daily.map((d) => tx(d, 30_000, 'Ăn sáng')))).toHaveLength(0);
  });

  it('chỉ 2 tháng → chưa đủ; lỡ nhiều tháng → bỏ', () => {
    expect(run([tx('2026-08-10', 50, 'Alpha'), tx('2026-09-10', 50, 'Alpha')])).toHaveLength(0);
    expect(
      run([
        tx('2026-04-10', 50, 'Beta'),
        tx('2026-05-10', 50, 'Beta'),
        tx('2026-09-10', 50, 'Beta'),
      ]),
    ).toHaveLength(0);
  });

  it('ngày trong tháng lệch nhiều → bỏ; lệch nhẹ → chấp nhận', () => {
    expect(
      run([
        tx('2026-07-02', 50, 'Gamma'),
        tx('2026-08-15', 50, 'Gamma'),
        tx('2026-09-28', 50, 'Gamma'),
      ]),
    ).toHaveLength(0);
    expect(
      run([
        tx('2026-07-14', 50, 'Delta'),
        tx('2026-08-16', 50, 'Delta'),
        tx('2026-09-15', 50, 'Delta'),
      ]),
    ).toHaveLength(1);
  });

  it('số tiền chênh quá nhiều → bỏ', () => {
    expect(
      run([
        tx('2026-07-10', 100_000, 'Epsilon'),
        tx('2026-08-10', 400_000, 'Epsilon'),
        tx('2026-09-10', 900_000, 'Epsilon'),
      ]),
    ).toHaveLength(0);
  });

  it('đã dừng lâu thì bỏ', () => {
    expect(
      run([
        tx('2026-03-10', 50, 'Zeta'),
        tx('2026-04-10', 50, 'Zeta'),
        tx('2026-05-10', 50, 'Zeta'),
      ]),
    ).toHaveLength(0);
  });

  it('đã có lịch cùng tên hoặc cùng số tiền & ngày thì không gợi ý lại', () => {
    const txs = [
      tx('2026-07-25', 513_000, 'Claude Code'),
      tx('2026-08-25', 513_000, 'Claude Code'),
      tx('2026-09-25', 513_000, 'Claude Code'),
    ];
    expect(
      run(txs, {
        existing: [
          {
            title: 'claude code',
            type: 'expense',
            amount: 1,
            startDate: '2026-10-25',
            monthDay: 25,
          },
        ],
      }),
    ).toHaveLength(0);
    expect(
      run(txs, {
        existing: [
          { title: '', type: 'expense', amount: 513_000, startDate: '2026-10-24', monthDay: null },
        ],
      }),
    ).toHaveLength(0);
  });

  it('gợi ý đã bỏ qua không hiện lại', () => {
    const txs = [
      tx('2026-07-25', 5, 'Gym'),
      tx('2026-08-25', 5, 'Gym'),
      tx('2026-09-25', 5, 'Gym'),
    ];
    const [s] = run(txs);
    expect(run(txs, { dismissed: new Set([s.key]) })).toHaveLength(0);
  });

  it('không tiêu đề: gom theo danh mục + đúng số tiền', () => {
    const c = { categoryId: 'cat-claude' };
    const r = run([
      tx('2026-07-25', 513_000, '', c),
      tx('2026-08-26', 513_000, '', c),
      tx('2026-09-25', 513_000, '', c),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].categoryId).toBe('cat-claude');
    // khác số tiền thì không gom
    expect(
      run([tx('2026-07-25', 1, '', c), tx('2026-08-26', 2, '', c), tx('2026-09-25', 3, '', c)]),
    ).toHaveLength(0);
  });

  it('ngày cuối tháng: kỳ tới theo ngày cuối của tháng đó', () => {
    const r = run([
      tx('2026-07-31', 10, 'Phí'),
      tx('2026-08-31', 10, 'Phí'),
      tx('2026-09-30', 10, 'Phí'),
    ]);
    expect(r[0].monthDay).toBe(31);
    expect(r[0].nextDate).toBe('2026-10-31');
  });
});
