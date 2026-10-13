// Gợi ý dựng Sổ nợ từ giao dịch cũ (người dùng đã ghi vay / mượn bằng tiêu đề giao dịch):
//   "Mượn a Quý" / "Vay bạn Phương" (thu)  → tôi đi vay          · "Nợ a Quý" / "Trả nợ Hiền" (chi) → tôi trả
//   "Cho em Lít Vay" / "Chuyển Thùy" (chi, danh mục Cho Mượn / Vay nợ) → tôi cho vay · "Văn trả nợ" / "E Hương trả" (thu) → họ trả
// Hàm thuần, chỉ đề xuất — người dùng xem lại rồi mới tạo.
import type { DebtDirection } from '@/db/schema';
import { normalizeForSearch } from '@/lib/text';

import { amountsOf } from './compute';

export type SuggestTx = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  /** ms */
  date: number;
  title: string;
  categoryName: string | null;
  accountId: string;
};

export type ProposalRecord = {
  txId: string;
  type: 'repay' | 'increase';
  amount: number;
  date: number;
  accountId: string;
};

export type DebtProposal = {
  /** Khoá ổn định: `${chiều}:${khoá tên}` */
  key: string;
  personName: string;
  direction: DebtDirection;
  /** Giao dịch gốc (đầu tiên) */
  opening: SuggestTx;
  records: ProposalRecord[];
  remaining: number;
};

/** Danh xưng bỏ khi so sánh tên: "a Quý" = "Quý" = "anh Quý" */
const HONORIFICS = new Set([
  'a',
  'anh',
  'c',
  'chi',
  'e',
  'em',
  'ban',
  'bac',
  'chu',
  'co',
  'di',
  'cau',
  'mr',
  'ms',
]);

const DEBT_CATEGORIES = new Set(['vay no', 'cho muon']);

const personKey = (rawName: string) =>
  normalizeForSearch(rawName)
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t))
    .join(' ');

/** Tên hiển thị: giữ danh xưng nhưng bỏ chữ "bạn" */
function displayName(rawName: string): string {
  return rawName
    .trim()
    .split(/\s+/)
    .filter((t) => normalizeForSearch(t) !== 'ban')
    .join(' ');
}

type Match = { kind: 'open' | 'repay'; direction: DebtDirection; name: string };

function classify(tx: SuggestTx): Match | null {
  const title = tx.title.trim();
  if (!title) return null;
  const norm = normalizeForSearch(title);
  const inDebtCategory = DEBT_CATEGORIES.has(normalizeForSearch(tx.categoryName ?? ''));
  // Các mẫu giữ lại phần tên theo chữ gốc: tách theo số từ của chuỗi đã chuẩn hoá
  const words = title.split(/\s+/);
  const nwords = norm.split(/\s+/);
  const rest = (from: number, to = words.length) => words.slice(from, to).join(' ');
  if (words.length !== nwords.length) return null; // chuẩn hoá làm lệch số từ → bỏ qua cho chắc

  if (tx.type === 'income') {
    // Mượn X / Vay X → tôi đi vay
    if (['muon', 'vay', 'ung'].includes(nwords[0]) && words.length >= 2) {
      return { kind: 'open', direction: 'borrowed', name: rest(1) };
    }
    // X trả (nợ / tiền) → họ trả tôi
    const last = nwords[nwords.length - 1];
    const prev = nwords[nwords.length - 2];
    if (words.length >= 2 && last === 'no' && prev === 'tra') {
      return { kind: 'repay', direction: 'lent', name: rest(0, words.length - 2) };
    }
    if (words.length >= 2 && last === 'tra') {
      return { kind: 'repay', direction: 'lent', name: rest(0, words.length - 1) };
    }
    if (words.length >= 3 && last === 'tien' && prev === 'tra') {
      return { kind: 'repay', direction: 'lent', name: rest(0, words.length - 2) };
    }
    return null;
  }

  // expense
  // Nợ X / Trả nợ X → tôi trả nợ
  if (nwords[0] === 'no' && words.length >= 2) {
    return { kind: 'repay', direction: 'borrowed', name: rest(1) };
  }
  if (nwords[0] === 'tra' && nwords[1] === 'no' && words.length >= 3) {
    return { kind: 'repay', direction: 'borrowed', name: rest(2) };
  }
  // Trả X: chỉ khi nằm trong danh mục vay nợ (tránh "Trả tiền ăn")
  if (nwords[0] === 'tra' && words.length >= 2 && inDebtCategory) {
    return { kind: 'repay', direction: 'borrowed', name: rest(1) };
  }
  // Cho X vay / Cho X mượn → tôi cho vay
  if (
    nwords[0] === 'cho' &&
    words.length >= 3 &&
    ['vay', 'muon'].includes(nwords[words.length - 1])
  ) {
    return { kind: 'open', direction: 'lent', name: rest(1, words.length - 1) };
  }
  // Chuyển X (trong danh mục Cho Mượn / Vay nợ) → tôi cho vay
  if (nwords[0] === 'chuyen' && words.length >= 2 && inDebtCategory) {
    return { kind: 'open', direction: 'lent', name: rest(1) };
  }
  return null;
}

export function suggestDebts(txs: readonly SuggestTx[]): DebtProposal[] {
  const sorted = [...txs].sort((a, b) => a.date - b.date);
  const groups = new Map<
    string,
    { name: string; direction: DebtDirection; items: { m: Match; tx: SuggestTx }[] }
  >();

  for (const tx of sorted) {
    const m = classify(tx);
    if (!m) continue;
    const key = personKey(m.name);
    if (!key) continue;
    const gkey = `${m.direction}:${key}`;
    const g = groups.get(gkey) ?? { name: displayName(m.name), direction: m.direction, items: [] };
    g.items.push({ m, tx });
    groups.set(gkey, g);
  }

  const proposals: DebtProposal[] = [];
  for (const [key, g] of groups) {
    const openings = g.items.filter((i) => i.m.kind === 'open');
    if (!openings.length) continue; // chỉ có khoản trả mà không thấy khoản gốc → bỏ qua
    const first = openings[0].tx;
    const records: ProposalRecord[] = [];
    for (const { m, tx } of g.items) {
      if (tx.id === first.id) continue;
      if (m.kind === 'repay' && tx.date < first.date) continue; // trả trước khi vay → không khớp
      records.push({
        txId: tx.id,
        type: m.kind === 'open' ? 'increase' : 'repay',
        amount: tx.amount,
        date: tx.date,
        accountId: tx.accountId,
      });
    }
    const { remaining } = amountsOf(first.amount, records);
    proposals.push({
      key,
      personName: g.name,
      direction: g.direction,
      opening: first,
      records,
      remaining,
    });
  }
  // Còn nợ lên trước, rồi theo ngày gốc mới nhất
  return proposals.sort(
    (a, b) => Number(b.remaining > 0) - Number(a.remaining > 0) || b.opening.date - a.opening.date,
  );
}
