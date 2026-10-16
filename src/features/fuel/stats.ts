// Thống kê xăng xe từ các lần đổ đã ghi giá (dòng ⛽ trong ghi chú): giá mỗi lít theo thời gian, lít / tiền theo
// tháng, bao lâu đổ một lần và dự kiến lần tới. Hàm thuần `summarizeFuel` + một truy vấn `listFuelFills`.
import { sql } from 'drizzle-orm';

import type { AppDatabase } from '@/db/types';
import { addDays, diffDays, toVnDate } from '@/lib/date';

import { FUEL_MARK, parseFuelNote } from './fuel';

export type FuelFill = {
  id: string;
  date: number;
  amount: number;
  price: number;
  /** Số lít ghi trong ghi chú; thiếu thì suy ra từ tiền / giá */
  liters: number;
};

export function listFuelFills(db: AppDatabase): FuelFill[] {
  const rows = db.all<{ id: string; date: number; amount: number; note: string }>(
    sql`select id, date, amount, note from transactions
        where type = 'expense' and is_adjustment = 0 and note like ${`%${FUEL_MARK}%`}
        order by date asc`,
  );
  const fills: FuelFill[] = [];
  for (const r of rows) {
    const parsed = parseFuelNote(r.note);
    if (!parsed) continue;
    fills.push({
      id: r.id,
      date: r.date,
      amount: r.amount,
      price: parsed.price,
      liters: parsed.liters ?? Math.round((r.amount / parsed.price) * 100) / 100,
    });
  }
  return fills;
}

export type FuelMonth = { key: string; amount: number; liters: number; count: number };

export type FuelSummary = {
  count: number;
  totalAmount: number;
  totalLiters: number;
  /** Giá trung bình có trọng số (tổng tiền / tổng lít) */
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  lastPrice: number;
  /** Giá theo thứ tự thời gian (vẽ đường xu hướng) */
  prices: number[];
  /** `months` tháng gần nhất, cũ → mới, gồm cả tháng không đổ */
  monthly: FuelMonth[];
  /** Số ngày trung bình giữa hai lần đổ liên tiếp (cần ≥ 2 lần) */
  avgGapDays: number | null;
  /** Ngày dự kiến đổ lần tới = lần cuối + khoảng cách trung bình */
  nextEstimate: string | null;
  /** Giá lần cuối − giá lần đổ trước đó (đ/lít), null nếu mới có một lần */
  lastChange: number | null;
};

export function summarizeFuel(fills: readonly FuelFill[], today: string, months = 6): FuelSummary | null {
  if (!fills.length) return null;
  const sorted = [...fills].sort((a, b) => a.date - b.date);
  const totalAmount = sorted.reduce((s, f) => s + f.amount, 0);
  const totalLiters = sorted.reduce((s, f) => s + f.liters, 0);
  const prices = sorted.map((f) => f.price);

  // Các khoá tháng YYYY-MM, tính lùi từ tháng của `today`
  const [ty, tm] = today.split('-').map(Number);
  const keys = Array.from({ length: months }, (_, i) => {
    const idx = ty * 12 + (tm - 1) - (months - 1 - i);
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  });
  const monthly: FuelMonth[] = keys.map((key) => ({ key, amount: 0, liters: 0, count: 0 }));
  for (const f of sorted) {
    const m = monthly.find((x) => x.key === toVnDate(f.date).slice(0, 7));
    if (m) {
      m.amount += f.amount;
      m.liters += f.liters;
      m.count += 1;
    }
  }

  const days = sorted.map((f) => toVnDate(f.date));
  let avgGapDays: number | null = null;
  let nextEstimate: string | null = null;
  if (sorted.length >= 2) {
    avgGapDays = Math.max(1, Math.round(diffDays(days[0], days[days.length - 1]) / (sorted.length - 1)));
    nextEstimate = addDays(days[days.length - 1], avgGapDays);
  }

  return {
    count: sorted.length,
    totalAmount,
    totalLiters: Math.round(totalLiters * 100) / 100,
    avgPrice: totalLiters > 0 ? Math.round(totalAmount / totalLiters) : 0,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    lastPrice: prices[prices.length - 1],
    prices,
    monthly,
    avgGapDays,
    nextEstimate,
    lastChange: prices.length >= 2 ? prices[prices.length - 1] - prices[prices.length - 2] : null,
  };
}
