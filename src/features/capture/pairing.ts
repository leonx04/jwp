// Nhận ra chuyển tiền giữa hai ví của chính bạn: bank này báo trừ X, bank kia báo cộng đúng X trong
// vòng vài phút → đó là MỘT khoản chuyển khoản, không phải một chi + một thu. Hàm thuần, test được.
import { normalizeForSearch } from '@/lib/text';

/** Hai thông báo cách nhau tối đa ngần này thì coi là cùng một lần chuyển */
export const PAIR_WINDOW_MS = 2 * 60_000;

export type PairCandidate = {
  id: string;
  type: 'income' | 'expense' | null;
  amount: number | null;
  accountId: string | null;
  postedAt: number;
};

export type TransferPair<T extends PairCandidate> = { out: T; in: T };

/**
 * Ghép từng khoản chi với khoản thu cùng số tiền, khác ví, gần nhau nhất về thời gian.
 * Mỗi thông báo chỉ thuộc tối đa một cặp. Thông báo chưa biết ví không được ghép.
 */
export function pairTransfers<T extends PairCandidate>(
  items: readonly T[],
  windowMs = PAIR_WINDOW_MS,
): TransferPair<T>[] {
  const outs = items.filter((c) => c.type === 'expense' && c.amount && c.accountId);
  const ins = items.filter((c) => c.type === 'income' && c.amount && c.accountId);

  // Mọi cặp hợp lệ, gần nhau nhất xét trước → ghép tham lam không chồng chéo
  const candidates: { out: T; in: T; gap: number }[] = [];
  for (const o of outs) {
    for (const i of ins) {
      if (o.amount !== i.amount || o.accountId === i.accountId) continue;
      const gap = Math.abs(o.postedAt - i.postedAt);
      if (gap <= windowMs) candidates.push({ out: o, in: i, gap });
    }
  }
  candidates.sort((a, b) => a.gap - b.gap);

  const used = new Set<string>();
  const pairs: TransferPair<T>[] = [];
  for (const c of candidates) {
    if (used.has(c.out.id) || used.has(c.in.id)) continue;
    used.add(c.out.id);
    used.add(c.in.id);
    pairs.push({ out: c.out, in: c.in });
  }
  return pairs;
}

/** Nội dung / người chuyển có tên của chính bạn không (không phân biệt hoa thường, dấu; đủ mọi từ trong tên) */
export function mentionsOwner(
  ownerName: string,
  ...texts: readonly (string | null | undefined)[]
): boolean {
  const tokens = normalizeForSearch(ownerName).split(' ').filter(Boolean);
  if (tokens.length < 2) return false;
  const haystack = normalizeForSearch(texts.filter(Boolean).join(' '));
  // Tên có thể viết liền (NGUYENXUANDUNG) trong nội dung chuyển khoản
  return (
    tokens.every((t) => haystack.split(' ').includes(t)) ||
    haystack.replace(/ /g, '').includes(tokens.join(''))
  );
}
