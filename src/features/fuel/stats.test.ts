import { saveAccount } from '@/features/accounts/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { listFuelFills, summarizeFuel, type FuelFill } from './stats';

const fill = (day: string, amount: number, price: number, liters = amount / price): FuelFill => ({
  id: day,
  date: vnDateToMs(day, '09:00'),
  amount,
  price,
  liters,
});

describe('summarizeFuel', () => {
  const fills = [
    fill('2026-08-20', 100_000, 20_000, 5),
    fill('2026-09-10', 100_000, 21_000, 4.76),
    fill('2026-10-01', 200_000, 22_000, 9.09),
  ];

  it('tổng, giá trung bình có trọng số, nhỏ nhất / lớn nhất / gần nhất', () => {
    const s = summarizeFuel(fills, '2026-10-16')!;
    expect(s).toMatchObject({ count: 3, totalAmount: 400_000, minPrice: 20_000, maxPrice: 22_000, lastPrice: 22_000, lastChange: 1000 });
    expect(s.avgPrice).toBe(Math.round(400_000 / (5 + 4.76 + 9.09)));
    expect(s.prices).toEqual([20_000, 21_000, 22_000]);
  });

  it('theo tháng: 6 tháng gần nhất, tháng trống = 0', () => {
    const s = summarizeFuel(fills, '2026-10-16')!;
    expect(s.monthly.map((m) => m.key)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(s.monthly[5]).toMatchObject({ amount: 200_000, count: 1 });
    expect(s.monthly[2]).toMatchObject({ amount: 0, count: 0 });
  });

  it('khoảng cách giữa các lần và dự kiến lần tới', () => {
    const s = summarizeFuel(fills, '2026-10-16')!;
    // 20/8 → 1/10 = 42 ngày / 2 khoảng = 21 ngày
    expect(s.avgGapDays).toBe(21);
    expect(s.nextEstimate).toBe('2026-10-22');
  });

  it('một lần: chưa có khoảng cách; không có gì: null', () => {
    const one = summarizeFuel([fills[0]], '2026-10-16')!;
    expect(one.avgGapDays).toBeNull();
    expect(one.lastChange).toBeNull();
    expect(summarizeFuel([], '2026-10-16')).toBeNull();
  });
});

describe('listFuelFills', () => {
  it('đọc dòng ⛽ trong ghi chú, bỏ giao dịch không có', () => {
    const db = createTestDb();
    const acc = saveAccount(db, { name: 'Tiền mặt', color: '#000', icon: 'wallet', includeInBalance: true });
    saveTransaction(db, {
      type: 'expense', amount: 60_000, accountId: acc, title: 'Đổ xăng',
      note: '⛽ 20.000đ/lít · 3 lít', date: vnDateToMs('2026-10-01', '09:00'),
    });
    saveTransaction(db, {
      type: 'expense', amount: 50_000, accountId: acc, title: 'Đổ xăng',
      note: '⛽ 25.000đ/lít', date: vnDateToMs('2026-10-08', '09:00'),
    });
    saveTransaction(db, { type: 'expense', amount: 30_000, accountId: acc, title: 'Cafe', date: vnDateToMs('2026-10-09', '09:00') });
    const fills = listFuelFills(db);
    expect(fills).toHaveLength(2);
    expect(fills[0]).toMatchObject({ price: 20_000, liters: 3 });
    expect(fills[1]).toMatchObject({ price: 25_000, liters: 2 });
  });
});
