// Xếp hạng gợi ý (hàm thuần → test được). Điểm càng cao càng lên đầu.

export type MatchKind = 'exact' | 'prefix' | 'word' | 'contains' | null;

export type CandidateStats = {
  /** Số lần dùng tiêu đề này */
  count: number;
  /** Lần dùng gần nhất (ms) */
  lastDate: number;
  /** Số lần có số tiền trong khoảng ±15% số đang nhập */
  similarCount?: number;
  /** Số lần đúng bằng số đang nhập */
  exactCount?: number;
  /** Số lần xảy ra trong khung giờ ±2 tiếng so với bây giờ */
  sameTimeCount?: number;
  match?: MatchKind;
};

const DAY_MS = 86_400_000;

/** Khớp chuỗi đã chuẩn hoá: trùng hẳn > đầu chuỗi > đầu một từ > chứa */
export function matchKind(titleKey: string, query: string): MatchKind {
  if (!query) return null;
  if (titleKey === query) return 'exact';
  if (titleKey.startsWith(query)) return 'prefix';
  if (titleKey.split(' ').some((word) => word.startsWith(query))) return 'word';
  if (titleKey.includes(query)) return 'contains';
  return null;
}

const MATCH_BONUS: Record<Exclude<MatchKind, null>, number> = {
  exact: 6,
  prefix: 4,
  word: 3,
  contains: 1,
};

export function scoreCandidate(stats: CandidateStats, now: number): number {
  const daysAgo = Math.max(0, (now - stats.lastDate) / DAY_MS);
  // Dùng nhiều → điểm tăng chậm dần; mới dùng gần đây → cộng thêm (giảm một nửa sau mỗi 30 ngày)
  let score = Math.log2(1 + stats.count) + 2 * Math.pow(0.5, daysAgo / 30);
  if (stats.exactCount) score += 3 + Math.log2(1 + stats.exactCount);
  if (stats.similarCount) score += 2 * (stats.similarCount / stats.count);
  if (stats.sameTimeCount) score += stats.sameTimeCount / stats.count;
  if (stats.match) score += MATCH_BONUS[stats.match];
  return score;
}

export function rankCandidates<T extends CandidateStats>(items: T[], now: number): T[] {
  return items
    .map((item) => ({ item, score: scoreCandidate(item, now) }))
    .sort((a, b) => b.score - a.score || b.item.lastDate - a.item.lastDate)
    .map(({ item }) => item);
}
