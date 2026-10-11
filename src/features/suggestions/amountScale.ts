// Gợi ý độ lớn số tiền: gõ "15" → 15.000 / 150.000 / 1.500.000, xếp theo khả năng cao nhất.
// Dựa trên: lịch sử số tiền của đúng tiêu đề / danh mục / loại giao dịch + mức thường gặp theo loại.
import type { TransactionType } from '@/db/schema';
import { MAX_AMOUNT } from '@/lib/money';

export type AmountSample = { amount: number; weight: number };

/** Mức "thường gặp" theo loại (log10 đồng): chi ~30k, thu ~8 triệu, chuyển ~1 triệu */
const PRIOR: Record<TransactionType, { center: number; spread: number }> = {
  expense: { center: Math.log10(30_000), spread: 0.9 },
  income: { center: Math.log10(8_000_000), spread: 1 },
  transfer: { center: Math.log10(1_000_000), spread: 1 },
};

/** Độ rộng "vùng giống" quanh một số tiền trong lịch sử (theo log10): ±0.3 ≈ ×2 */
const SIGMA = 0.3;

const gaussian = (d: number, sigma: number) => Math.exp(-(d * d) / (2 * sigma * sigma));

/** Các bội 10 hợp lệ của số đã gõ: ≥ 1.000 ₫ và không vượt giới hạn */
export function scaleCandidates(typed: number): number[] {
  const out: number[] = [];
  for (let value = typed; value <= MAX_AMOUNT; value *= 10) {
    if (value >= 1_000) out.push(value);
    if (out.length >= 7) break;
  }
  return out;
}

export function suggestAmountScales(
  typed: number,
  history: readonly AmountSample[],
  type: TransactionType,
  limit = 3,
): number[] {
  if (!Number.isInteger(typed) || typed <= 0) return [];
  const candidates = scaleCandidates(typed);
  const prior = PRIOR[type];
  const totalWeight = history.reduce((sum, s) => sum + s.weight, 0);

  const scored = candidates.map((value) => {
    const lv = Math.log10(value);
    let score = 0.6 * gaussian(lv - prior.center, prior.spread);
    if (totalWeight > 0) {
      let fit = 0;
      let exact = 0;
      for (const s of history) {
        if (s.amount <= 0) continue;
        fit += s.weight * gaussian(lv - Math.log10(s.amount), SIGMA);
        if (s.amount === value) exact += s.weight;
      }
      // Lịch sử càng nhiều thì càng tin lịch sử hơn mức thường gặp
      const confidence = Math.min(1, totalWeight / 5);
      score = (1 - confidence) * score + confidence * (fit / totalWeight) * 2 + (exact / totalWeight) * 1.5;
    }
    return { value, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.value - b.value)
    .slice(0, limit)
    .map((s) => s.value);
}
