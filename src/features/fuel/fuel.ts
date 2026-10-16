// Đổ xăng: ghi giá xăng hôm đó vào ghi chú giao dịch (dòng "⛽ 21.350đ/lít · 2,81 lít"), gợi ý giá lần
// trước và cho biết tăng / giảm bao nhiêu. Không cần thêm cột trong DB: ghi chú là nơi lưu.
import { t } from '@/lib/i18n';
import { sql } from 'drizzle-orm';

import type { AppDatabase } from '@/db/types';
import { normalizeForSearch } from '@/lib/text';

export const FUEL_MARK = '⛽';

/** Tiêu đề / danh mục có phải đổ xăng không: "Đổ xăng", "xăng xe", "Đổ Xăng 50k"... */
export function isFuelText(text: string | null | undefined): boolean {
  return /\b(xang|nhien lieu|do xang)\b/.test(normalizeForSearch(text ?? ''));
}

/** Số lít từ số tiền và giá mỗi lít, làm tròn 2 chữ số */
export function litersFor(amount: number, pricePerLiter: number): number {
  return pricePerLiter > 0 ? Math.round((amount / pricePerLiter) * 100) / 100 : 0;
}

const group = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const decimal = (n: number) => n.toString().replace('.', ',');

/** '⛽ 21.350đ/lít · 2,81 lít' */
export function formatFuelNote(pricePerLiter: number, liters: number): string {
  const base = t('{FUEL_MARK} {pricePerLiter}đ/lít', {
    FUEL_MARK,
    pricePerLiter: group(pricePerLiter),
  });
  return liters > 0 ? t('{base} · {liters} lít', { base, liters: decimal(liters) }) : base;
}

export type FuelNote = { price: number; liters: number | null };

/** Đọc lại dòng ⛽ trong ghi chú (null nếu không có) */
export function parseFuelNote(note: string | null | undefined): FuelNote | null {
  const m = new RegExp(
    t('{FUEL_MARK}\\s*([\\d.]+)\\s*đ/lít(?:\\s*·\\s*([\\d,]+)\\s*lít)?', { FUEL_MARK }),
  ).exec(note ?? '');
  if (!m) return null;
  const price = Number(m[1].replace(/\./g, ''));
  if (!Number.isFinite(price) || price <= 0) return null;
  return { price, liters: m[2] ? Number(m[2].replace(',', '.')) : null };
}

/** Ghi chú không kèm dòng ⛽ (để người dùng sửa phần ghi chú của mình) */
export function stripFuelNote(note: string | null | undefined): string {
  return (note ?? '')
    .split('\n')
    .filter((line) => !line.trim().startsWith(FUEL_MARK))
    .join('\n')
    .trim();
}

/** Ghép dòng ⛽ lên đầu ghi chú; fuel = null → bỏ dòng ⛽ */
export function mergeFuelNote(
  note: string,
  fuel: { price: number; liters: number } | null,
): string {
  const rest = stripFuelNote(note);
  if (!fuel || fuel.price <= 0) return rest;
  const line = formatFuelNote(fuel.price, fuel.liters);
  return rest ? `${line}\n${rest}` : line;
}

export type LastFuel = { price: number; date: number };

/** Lần đổ xăng gần nhất có ghi giá (bỏ qua giao dịch `excludeId` đang sửa) */
export function lastFuel(db: AppDatabase, excludeId?: string): LastFuel | null {
  const row = db.get<{ note: string; date: number }>(
    sql`select note, date from transactions
        where note like ${`%${FUEL_MARK}%`} and id != ${excludeId ?? ''}
        order by date desc limit 1`,
  );
  const parsed = parseFuelNote(row?.note);
  return row && parsed ? { price: parsed.price, date: row.date } : null;
}

/** 'Tăng 450đ/lít so với lần trước' · 'Giảm 300đ/lít…' · 'Bằng giá lần trước' */
export function priceChangeText(price: number, last: number): string {
  const diff = price - last;
  if (diff === 0) return 'Bằng giá lần đổ trước';
  return `${diff > 0 ? 'Tăng' : 'Giảm'} ${group(Math.abs(diff))}đ/lít so với lần đổ trước`;
}
