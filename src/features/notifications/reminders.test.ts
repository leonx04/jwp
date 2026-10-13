import { vnDateToMs } from '@/lib/date';

import { avoidQuietHours, buildReminders, type ReminderItem } from './reminders';

const TODAY = '2026-10-12';
const NOW = vnDateToMs(TODAY, '08:00');
const money = (n: number) => `${n}đ`;

const item = (over: Partial<ReminderItem> = {}): ReminderItem => ({
  key: 'k1',
  kind: 'payment',
  date: '2026-10-15',
  title: 'Tiền nhà',
  amount: 3_000_000,
  overdue: false,
  daysBefore: 1,
  time: '09:00',
  url: '/x',
  ...over,
});

const base = {
  now: NOW,
  today: TODAY,
  quietStart: '22:00',
  quietEnd: '07:00',
  flags: { payments: true, income: true, overdue: true, debts: true },
  money,
};
const run = (items: ReminderItem[], extra: Partial<typeof base> = {}) =>
  buildReminders({ ...base, ...extra, items });

describe('avoidQuietHours', () => {
  it('ngoài khoảng yên lặng giữ nguyên', () => {
    expect(avoidQuietHours('2026-10-15', '09:00', '22:00', '07:00')).toBe(
      vnDateToMs('2026-10-15', '09:00'),
    );
  });
  it('trước nửa đêm → sáng hôm sau', () => {
    expect(avoidQuietHours('2026-10-15', '23:00', '22:00', '07:00')).toBe(
      vnDateToMs('2026-10-16', '07:00'),
    );
  });
  it('sau nửa đêm → cuối khoảng cùng ngày', () => {
    expect(avoidQuietHours('2026-10-15', '03:00', '22:00', '07:00')).toBe(
      vnDateToMs('2026-10-15', '07:00'),
    );
  });
  it('khoảng không vắt đêm', () => {
    expect(avoidQuietHours('2026-10-15', '13:00', '12:00', '14:00')).toBe(
      vnDateToMs('2026-10-15', '14:00'),
    );
  });
});

describe('buildReminders', () => {
  it('hẹn nhắc trước 1 ngày và đúng ngày, có nút hành động cho khoản phải trả', () => {
    const r = run([item()]);
    expect(r.map((x) => x.id)).toEqual([
      'reminder:payment:k1:before@2026-10-14',
      'reminder:payment:k1:due@2026-10-15',
    ]);
    expect(r[0].title).toBe('💸 Ngày mai: Tiền nhà');
    expect(r[0].fireAt).toBe(vnDateToMs('2026-10-14', '09:00'));
    expect(r[1].title).toBe('💸 Hôm nay: Tiền nhà');
    expect(r.every((x) => x.withActions && x.channel === 'payments')).toBe(true);
  });

  it('nhắc trước nhiều ngày; "N ngày nữa"', () => {
    const r = run([item({ daysBefore: 3 })]);
    expect(r[0].title).toContain('3 ngày nữa');
    expect(r[0].fireAt).toBe(vnDateToMs('2026-10-12', '09:00'));
  });

  it('bỏ nhắc trong quá khứ; hôm nay đã qua giờ thì chỉ còn nhắc sau', () => {
    const late = run([item({ date: TODAY, daysBefore: 1 })], { now: vnDateToMs(TODAY, '10:00') });
    expect(late).toHaveLength(0);
    const early = run([item({ date: TODAY, daysBefore: 1 })]);
    expect(early.map((x) => x.id)).toEqual([`reminder:payment:k1:due@${TODAY}`]);
  });

  it('daysBefore = 0 chỉ nhắc đúng ngày', () => {
    expect(run([item({ daysBefore: 0 })])).toHaveLength(1);
  });

  it('tôn trọng công tắc từng loại', () => {
    const items = [
      item({ key: 'p' }),
      item({ key: 'i', kind: 'income', title: 'Lương' }),
      item({ key: 'd', kind: 'debt', title: 'Quý hẹn trả' }),
    ];
    const none = run(items, {
      flags: { payments: false, income: false, overdue: true, debts: false },
    });
    expect(none).toHaveLength(0);
    const onlyIncome = run(items, {
      flags: { payments: false, income: true, overdue: true, debts: false },
    });
    expect(new Set(onlyIncome.map((x) => x.channel))).toEqual(new Set(['income']));
    expect(onlyIncome.every((x) => !x.withActions)).toBe(true);
  });

  it('chỉ hẹn khoản trong khoảng 14 ngày', () => {
    expect(run([item({ date: '2026-12-01' })])).toHaveLength(0);
  });

  it('khoản quá hạn gộp thành một thông báo mỗi ngày (3 ngày)', () => {
    const r = run([
      item({ key: 'a', overdue: true, date: '2026-10-01', title: 'Điện' }),
      item({ key: 'b', overdue: true, date: '2026-10-05', title: 'Nước' }),
    ]);
    expect(r).toHaveLength(3);
    expect(r[0].title).toBe('⚠️ 2 khoản quá hạn');
    expect(r[0].body).toContain('Điện');
    expect(r[0].body).toContain('Nước');
    expect(
      run([item({ overdue: true })], {
        flags: { payments: true, income: true, overdue: false, debts: true },
      }),
    ).toHaveLength(0);
  });

  it('giờ nhắc nằm trong giờ yên lặng thì dời', () => {
    const r = run([item({ time: '23:30', daysBefore: 0 })]);
    expect(r[0].fireAt).toBe(vnDateToMs('2026-10-16', '07:00'));
  });
});
