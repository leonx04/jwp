// Kiểm tra dữ liệu: tìm chỗ "lẫn lộn" cần dọn — giao dịch có thể trùng, ngày sai (vd năm 2010), số tiền bất thường
// so với các lần cùng tên, giao dịch chưa phân loại, tag không dùng. Hàm thuần: không đụng DB.
import { vnDateToMs } from '@/lib/date';
import { normalizeForSearch } from '@/lib/text';

export type CheckTx = {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  date: number;
  title: string;
  accountId: string;
  categoryId: string | null;
};

export type IssueKind = 'bad_date' | 'duplicate' | 'outlier' | 'uncategorized' | 'unused_tag';

export type Issue = {
  kind: IssueKind;
  /** Giao dịch liên quan (hoặc id tag với unused_tag) */
  ids: string[];
};

/** Hai giao dịch cùng ví, số tiền, tên, cách nhau không quá ngần này thì nghi là nhập trùng */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
export const EARLIEST_DATE = '2015-01-01';
const FUTURE_SLACK_MS = 36 * 60 * 60 * 1000;
const OUTLIER_RATIO = 6;
const MIN_SAMPLES = 4;

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export function findIssues(
  txs: readonly CheckTx[],
  tags: readonly { id: string; usage: number }[],
  now: number,
): Issue[] {
  const issues: Issue[] = [];
  const earliest = vnDateToMs(EARLIEST_DATE);

  // Ngày sai: quá xa trong quá khứ hoặc ở tương lai
  const bad = txs.filter((t) => t.date < earliest || t.date > now + FUTURE_SLACK_MS);
  if (bad.length) issues.push({ kind: 'bad_date', ids: bad.map((t) => t.id) });
  const badIds = new Set(bad.map((t) => t.id));

  // Trùng: cùng ví + loại + số tiền + tên, các lần liền nhau trong vòng 10 phút
  const groups = new Map<string, CheckTx[]>();
  for (const t of txs) {
    if (badIds.has(t.id)) continue;
    const key = `${t.accountId}|${t.type}|${t.amount}|${normalizeForSearch(t.title)}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date - b.date);
    let cluster: CheckTx[] = [list[0]];
    const flush = () => {
      if (cluster.length >= 2) issues.push({ kind: 'duplicate', ids: cluster.map((c) => c.id) });
    };
    for (let i = 1; i < list.length; i++) {
      if (list[i].date - cluster[cluster.length - 1].date <= DUPLICATE_WINDOW_MS) cluster.push(list[i]);
      else {
        flush();
        cluster = [list[i]];
      }
    }
    flush();
  }

  // Số tiền bất thường so với các lần cùng tên (cần đủ mẫu)
  const byTitle = new Map<string, CheckTx[]>();
  for (const t of txs) {
    const key = normalizeForSearch(t.title);
    if (!key || t.type === 'transfer' || badIds.has(t.id)) continue;
    byTitle.set(`${t.type}|${key}`, [...(byTitle.get(`${t.type}|${key}`) ?? []), t]);
  }
  for (const list of byTitle.values()) {
    if (list.length < MIN_SAMPLES) continue;
    const m = median(list.map((t) => t.amount));
    if (m <= 0) continue;
    const odd = list.filter((t) => t.amount > m * OUTLIER_RATIO || t.amount < m / OUTLIER_RATIO);
    if (odd.length && odd.length <= Math.floor(list.length / 2)) {
      issues.push({ kind: 'outlier', ids: odd.map((t) => t.id) });
    }
  }

  // Chưa phân loại (không tính chuyển khoản)
  const uncategorized = txs.filter((t) => t.type !== 'transfer' && !t.categoryId);
  if (uncategorized.length) issues.push({ kind: 'uncategorized', ids: uncategorized.map((t) => t.id) });

  const unused = tags.filter((t) => t.usage === 0);
  if (unused.length) issues.push({ kind: 'unused_tag', ids: unused.map((t) => t.id) });

  return issues;
}
