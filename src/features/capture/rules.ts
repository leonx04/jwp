// Khớp quy tắc phân loại cho giao dịch tự đọc. Hàm thuần.
// "Nội dung chứa <cụm từ> → danh mục X": không phân biệt hoa thường và dấu tiếng Việt.
import { normalizeForSearch } from '@/lib/text';

export type RuleLike = {
  id: string;
  pattern: string;
  /** Trống = cả thu và chi */
  type: 'income' | 'expense' | null;
  categoryId: string;
  autoAccept: boolean;
  createdAt: number;
};

export type RuleSubject = {
  type: 'income' | 'expense' | null;
  content: string;
  counterparty: string | null;
};

/** Cụm từ quá ngắn (vd "an") sẽ khớp bừa vào nhiều nội dung khác nhau */
export const MIN_PATTERN_LENGTH = 3;

export const patternKey = (pattern: string): string => normalizeForSearch(pattern);

/**
 * Quy tắc áp dụng cho giao dịch này: cụm từ DÀI nhất khớp thắng ("highlands coffee" ưu tiên hơn
 * "coffee"); bằng nhau thì quy tắc tạo trước.
 */
export function matchRule<R extends RuleLike>(rules: readonly R[], subject: RuleSubject): R | null {
  const haystack = normalizeForSearch([subject.content, subject.counterparty ?? ''].join(' '));
  if (!haystack) return null;
  let best: R | null = null;
  let bestLength = 0;
  for (const rule of rules) {
    const key = patternKey(rule.pattern);
    if (key.length < MIN_PATTERN_LENGTH) continue;
    if (rule.type && subject.type && rule.type !== subject.type) continue;
    if (!haystack.includes(key)) continue;
    if (
      key.length > bestLength ||
      (key.length === bestLength && best !== null && rule.createdAt < best.createdAt)
    ) {
      best = rule;
      bestLength = key.length;
    }
  }
  return best;
}

/** Danh mục chiếm đa số (≥ minShare) trong số lần dùng; không ai áp đảo → null */
export function dominantCategory(
  counts: ReadonlyMap<string, number>,
  minShare = 0.6,
): string | null {
  let total = 0;
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, n] of counts) {
    total += n;
    if (n > bestCount) {
      best = id;
      bestCount = n;
    }
  }
  return best !== null && total > 0 && bestCount / total >= minShare ? best : null;
}
