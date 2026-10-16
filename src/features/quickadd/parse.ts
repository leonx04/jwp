// Gõ một câu → giao dịch: "cafe 35k hôm qua momo", "lương 15tr", "chuyển 500k từ vcb sang momo".
// Thuần hàm (không đụng DB): người gọi đưa danh sách ví / danh mục / tag / lịch sử gần đây vào.
import { addDays, startOfWeek, todayVn, vnDateToMs, weekdayOf } from '@/lib/date';
import { detectBank } from '@/lib/banks';
import { parseMoney } from '@/lib/money';
import { removeDiacritics } from '@/lib/text';

export type QuickType = 'expense' | 'income' | 'transfer';

export type QuickContext = {
  now: number;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  /** Giao dịch gần đây — học danh mục từ tiêu đề đã dùng */
  history: { title: string; categoryId: string | null }[];
  defaultAccountId: string | null;
};

export type QuickEntry = {
  type: QuickType;
  /** null = chưa đọc được số tiền */
  amount: number | null;
  /** Số nhập kiểu "35" (không đơn vị) được hiểu là 35 nghìn */
  assumedThousand: boolean;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  categorySource: 'name' | 'history' | null;
  title: string;
  tagIds: string[];
  /** #tag chưa có trong app — tạo khi lưu */
  newTagNames: string[];
  date: number;
};

type Token = { raw: string; plain: string; used: boolean };

const UNIT_WORDS = new Set(['k', 'tr', 'trieu', 'nghin', 'ngan', 'ty', 'ti', 'm', 'b']);
const INCOME_WORDS = ['luong', 'thuong', 'nhan', 'thu', 'hoan'];
const TRANSFER_WORDS = ['chuyen', 'rut', 'nap'];
const TIME_OF_DAY: Record<string, string> = {
  sang: '08:00',
  trua: '12:00',
  chieu: '15:00',
  toi: '19:00',
  dem: '22:00',
};

const plainOf = (text: string) => removeDiacritics(text.toLowerCase());
const words = (text: string): string[] => plainOf(text).split(/[^a-z0-9]+/).filter(Boolean);

function tokenize(text: string): Token[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, plain: plainOf(raw).replace(/[,;!?]+$/g, ''), used: false }));
}

/** Tìm cụm từ liên tiếp (đã bỏ dấu) trong các token chưa dùng. Trả về vị trí đầu hoặc -1. */
function findPhrase(tokens: Token[], phrase: string[]): number {
  if (!phrase.length) return -1;
  for (let i = 0; i + phrase.length <= tokens.length; i++) {
    if (phrase.every((w, k) => !tokens[i + k].used && tokens[i + k].plain === w)) return i;
  }
  return -1;
}

function consume(tokens: Token[], start: number, length: number) {
  for (let i = start; i < start + length; i++) tokens[i].used = true;
}

/** Ngày + giờ (tuỳ chọn) từ các cụm "hôm qua", "ngày 5", "5/10", "thứ 6 tuần trước"… */
function extractDate(tokens: Token[], now: number): number {
  const today = todayVn(now);
  const nowTime = new Date(now + 7 * 3_600_000).toISOString().slice(11, 16);
  let date = today;
  let time = nowTime;

  const offsets: [string[], number][] = [
    [['hom', 'qua'], -1],
    [['hom', 'kia'], -2],
    [['hom', 'nay'], 0],
    [['hqua'], -1],
    [['qua'], -1],
    [['kia'], -2],
    [['nay'], 0],
  ];
  // "sáng nay", "tối qua"…: vừa chọn ngày vừa chọn buổi
  for (let i = 0; i + 1 < tokens.length; i++) {
    const [a, b] = [tokens[i], tokens[i + 1]];
    if (a.used || b.used || !TIME_OF_DAY[a.plain]) continue;
    if (b.plain === 'nay' || b.plain === 'qua' || b.plain === 'hom') {
      const off = b.plain === 'qua' ? -1 : 0;
      date = addDays(today, off);
      time = TIME_OF_DAY[a.plain];
      consume(tokens, i, 2);
      return vnDateToMs(date, time);
    }
  }

  for (const [phrase, off] of offsets) {
    const at = findPhrase(tokens, phrase);
    if (at >= 0) {
      consume(tokens, at, phrase.length);
      return vnDateToMs(addDays(today, off), nowTime);
    }
  }

  // 05/10 · 5/10/2026 · 5-10
  for (const token of tokens) {
    if (token.used) continue;
    const m = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(token.plain);
    if (!m) continue;
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    let year = Number(today.slice(0, 4));
    if (m[3]) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    // Không có năm mà ngày nằm ở tương lai → hiểu là năm trước
    const resolved =
      !m[3] && candidate > today ? `${year - 1}${candidate.slice(4)}` : candidate;
    token.used = true;
    return vnDateToMs(resolved, nowTime);
  }

  // "ngày 5" (tháng này; chưa tới thì tháng trước)
  for (let i = 0; i + 1 < tokens.length; i++) {
    if (tokens[i].used || tokens[i].plain !== 'ngay' || tokens[i + 1].used) continue;
    const day = Number(tokens[i + 1].plain);
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;
    consume(tokens, i, 2);
    const [y, m] = today.split('-').map(Number);
    let candidate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (candidate > today) {
      const prev = m === 1 ? [y - 1, 12] : [y, m - 1];
      candidate = `${prev[0]}-${String(prev[1]).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return vnDateToMs(candidate, nowTime);
  }

  // "thứ 6", "chủ nhật", "cn" (+ "tuần trước")
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk.used) continue;
    let weekday = 0;
    let length = 1;
    if (tk.plain === 'thu' && tokens[i + 1] && !tokens[i + 1].used) {
      const n = Number(tokens[i + 1].plain);
      if (n >= 2 && n <= 7) {
        weekday = n === 7 ? 6 : n - 1;
        length = 2;
      }
    } else if (tk.plain === 'chu' && tokens[i + 1]?.plain === 'nhat') {
      weekday = 7;
      length = 2;
    } else if (tk.plain === 'cn') {
      weekday = 7;
    }
    if (!weekday) continue;
    consume(tokens, i, length);
    const last = tokens.findIndex(
      (x, k) => k >= i + length && !x.used && x.plain === 'tuan' && /^(truoc|roi)$/.test(tokens[k + 1]?.plain ?? ''),
    );
    if (last >= 0) {
      consume(tokens, last, 2);
      return vnDateToMs(addDays(startOfWeek(today), -7 + weekday - 1), nowTime);
    }
    const back = (weekdayOf(today) - weekday + 7) % 7;
    return vnDateToMs(addDays(today, -back), nowTime);
  }

  return vnDateToMs(date, time);
}

/** Chọn số tiền: ưu tiên token có đơn vị (35k, 1tr2), rồi số lớn nhất */
function extractAmount(tokens: Token[]): { amount: number | null; assumedThousand: boolean } {
  type Cand = { at: number; length: number; value: number; hasUnit: boolean };
  const cands: Cand[] = [];
  tokens.forEach((tk, i) => {
    if (tk.used || !/^\d/.test(tk.plain)) return;
    const next = tokens[i + 1];
    // "35 k", "1 tr"
    if (/^\d[\d.,]*$/.test(tk.plain) && next && !next.used && UNIT_WORDS.has(next.plain)) {
      const value = parseMoney(`${tk.plain}${next.plain}`);
      if (value) cands.push({ at: i, length: 2, value, hasUnit: true });
      return;
    }
    const value = parseMoney(tk.raw);
    if (value && value > 0) cands.push({ at: i, length: 1, value, hasUnit: /[a-z]/.test(tk.plain) });
  });
  if (!cands.length) return { amount: null, assumedThousand: false };
  const withUnit = cands.filter((c) => c.hasUnit);
  const pool = withUnit.length ? withUnit : cands;
  const best = pool.reduce((a, b) => (b.value > a.value ? b : a));
  consume(tokens, best.at, best.length);
  // "cafe 35" → 35 nghìn
  if (!best.hasUnit && best.value < 1000) return { amount: best.value * 1000, assumedThousand: true };
  return { amount: best.value, assumedThousand: false };
}

type Named = { id: string; name: string };

/** Các mục có tên xuất hiện (nguyên cụm) trong câu; trả về theo thứ tự xuất hiện */
function matchNamed(
  tokens: Token[],
  items: Named[],
  stripPrefix = false,
): { item: Named; at: number; length: number }[] {
  const found: { item: Named; at: number; length: number }[] = [];
  for (const item of items) {
    let phrase = words(item.name);
    if (stripPrefix && phrase.length > 1 && phrase[0] === 'vi') phrase = phrase.slice(1);
    const phrases = [phrase];
    // Ví ngân hàng gọi tắt: "vcb" cho "Vietcombank"
    if (stripPrefix) {
      for (const k of detectBank(item.name)?.keywords ?? []) phrases.push(words(k));
    }
    for (const ph of phrases) {
      const at = findPhrase(tokens, ph);
      if (at >= 0) {
        found.push({ item, at, length: ph.length });
        break;
      }
    }
  }
  // Tên dài trước (tránh "Ăn" nuốt mất "Ăn uống"): loại mục bị phủ bởi mục dài hơn
  found.sort((a, b) => b.length - a.length);
  const taken = new Set<number>();
  const out: { item: Named; at: number; length: number }[] = [];
  for (const f of found) {
    const idx = Array.from({ length: f.length }, (_, k) => f.at + k);
    if (idx.some((i) => taken.has(i))) continue;
    idx.forEach((i) => taken.add(i));
    out.push(f);
  }
  out.forEach((f) => consume(tokens, f.at, f.length));
  return out.sort((a, b) => a.at - b.at);
}

function hasWord(tokens: Token[], list: string[]): boolean {
  const plain = tokens.filter((t) => !t.used).map((t) => t.plain);
  return list.some((w) => {
    const parts = w.split(' ');
    return plain.some((_, i) => parts.every((p, k) => plain[i + k] === p));
  });
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Học danh mục từ tiêu đề cũ có từ chung: tiêu đề nào chung nhiều từ nhất, hoà thì danh mục xuất hiện nhiều hơn */
function categoryFromHistory(
  titleWords: string[],
  history: QuickContext['history'],
): string | null {
  if (!titleWords.length) return null;
  const scores = new Map<string, number>();
  for (const h of history) {
    if (!h.categoryId) continue;
    const shared = words(h.title).filter((w) => titleWords.includes(w)).length;
    if (shared) scores.set(h.categoryId, (scores.get(h.categoryId) ?? 0) + shared * 10 + 1);
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const [id, score] of scores) {
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

export function parseQuickEntry(text: string, ctx: QuickContext): QuickEntry {
  const tokens = tokenize(text);

  // #tag trước tiên (giữ nguyên tên người gõ)
  const tagIds = new Set<string>();
  const newTagNames: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (!tk.raw.startsWith('#') || tk.raw.length < 2) continue;
    tk.used = true;
    // Tag đã có gồm nhiều chữ: "#Công việc"
    const multi = ctx.tags.find((t) => {
      const w = words(t.name);
      return (
        w.length > 1 &&
        w[0] === plainOf(tk.raw.slice(1)) &&
        w.slice(1).every((x, k) => tokens[i + 1 + k]?.plain === x)
      );
    });
    if (multi) {
      tagIds.add(multi.id);
      consume(tokens, i + 1, words(multi.name).length - 1);
      continue;
    }
    const name = tk.raw.slice(1);
    const key = plainOf(name);
    const known = ctx.tags.find((t) => plainOf(t.name) === key);
    if (known) tagIds.add(known.id);
    else if (!newTagNames.some((n) => plainOf(n) === key)) newTagNames.push(name);
  }

  const date = extractDate(tokens, ctx.now);
  const { amount, assumedThousand } = extractAmount(tokens);

  const transferIntent = hasWord(tokens, TRANSFER_WORDS);
  const incomeIntent = hasWord(tokens, INCOME_WORDS);

  const accountHits = matchNamed(tokens, ctx.accounts, true);
  const categoryHits = matchNamed(tokens, ctx.categories);
  for (const t of ctx.tags) {
    const at = findPhrase(tokens, words(t.name));
    // Tag chỉ nhận khi tên đủ dài, tránh nuốt từ thường ("An", "Di")
    if (at >= 0 && words(t.name).join('').length >= 4) {
      tagIds.add(t.id);
      consume(tokens, at, words(t.name).length);
    }
  }

  let type: QuickType = 'expense';
  let accountId: string | null = accountHits[0]?.item.id ?? ctx.defaultAccountId;
  let toAccountId: string | null = null;
  if (transferIntent && accountHits.length >= 2) {
    type = 'transfer';
    accountId = accountHits[0].item.id;
    toAccountId = accountHits[1].item.id;
  } else if (incomeIntent && !transferIntent) {
    type = 'income';
  }

  // Các từ còn lại → tiêu đề (bỏ từ nối vô nghĩa)
  const FILLER = new Set(['tu', 'sang', 'vao', 'bang', 'qua', 'tai', 'o', 'vi', 'het', 'mat']);
  const rest = tokens.filter((tk) => !tk.used);
  const titleTokens = rest.filter((tk) => !FILLER.has(tk.plain) || rest.length <= 1);
  const title = capitalize(titleTokens.map((tk) => tk.raw).join(' ').trim());

  let categoryId: string | null = categoryHits[0]?.item.id ?? null;
  let categorySource: QuickEntry['categorySource'] = categoryId ? 'name' : null;
  if (!categoryId && type !== 'transfer') {
    categoryId = categoryFromHistory(words(title), ctx.history);
    if (categoryId) categorySource = 'history';
  }
  if (type === 'transfer') {
    categoryId = null;
    categorySource = null;
  }

  return {
    type,
    amount,
    assumedThousand,
    accountId,
    toAccountId,
    categoryId,
    categorySource,
    title,
    tagIds: [...tagIds],
    newTagNames,
    date,
  };
}
