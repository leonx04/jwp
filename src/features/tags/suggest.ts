// Gợi ý tag từ lịch sử: các cụm từ lặp lại trong tiêu đề giao dịch ("ăn sáng", "cà phê", "nước", "sửa xe"…)
// → mỗi cụm là một tag gắn vào mọi giao dịch có cụm đó. Hàm thuần, chỉ đề xuất — người dùng xem rồi mới tạo.
import { normalizeForSearch, removeDiacritics } from '@/lib/text';

export type TagTx = { id: string; title: string; date: number };

export type TagProposal = {
  /** Cụm đã bỏ dấu, dùng làm khoá */
  key: string;
  /** Tên tag hiển thị (có dấu, viết hoa chữ đầu) */
  name: string;
  txIds: string[];
  count: number;
  samples: string[];
};

/** Từ chung chung / nhiễu của tin nhắn ngân hàng — không đủ nghĩa để thành tag */
const STOPWORDS = new Set([
  'mua',
  'tra',
  'tien',
  'cho',
  'tu',
  'den',
  'va',
  'cua',
  'la',
  'nhan',
  'chuyen',
  'khoan',
  'thanh',
  'toan',
  'ma',
  'giao',
  'dich',
  'ck',
  'ct',
  'nd',
  'tai',
  'di',
  'lan',
  'thang',
  'hom',
  'nay',
  'qua',
  'em',
  'anh',
  'chi',
  'a',
  'e',
  'c',
  'ban',
  'bac',
  'chu',
  'co',
  'adjust',
  'balance',
  'the',
  'cua',
  'o',
  'vao',
  'ra',
  'mot',
  'hai',
  'ba',
  'them',
  'nua',
  'con',
  'cai',
  'het',
  'tat',
]);

export const MIN_TAG_USES = 3;
const MAX_PHRASE_WORDS = 3;
/** Cụm dài hơn chiếm ≥ ngần này số lần của cụm ngắn thì thay thế cụm ngắn ("ăn sáng" thay "ăn") */
const LONGER_WINS_RATIO = 0.6;
/** Tiêu đề kiểu mã ngân hàng / quá dài → bỏ qua */
const MAX_TITLE_LENGTH = 40;

type Token = { raw: string; key: string };

const hasLetters = (text: string) => /\p{L}/u.test(text);
const hasMarks = (text: string) => removeDiacritics(text) !== text;

/** Tiêu đề do ngân hàng / máy sinh: viết hoa hết, hoặc toàn chữ không dấu nhiều từ ("RUT TIEN BANG QRC", "Nguyen Xuan Dung chuyen tien") */
function looksMachineMade(title: string): boolean {
  if (hasLetters(title) && title === title.toUpperCase()) return true;
  return !hasMarks(title) && title.split(/\s+/).length >= 3;
}

function tokenize(title: string): Token[] | null {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > MAX_TITLE_LENGTH || looksMachineMade(trimmed)) return null;
  const raw = trimmed
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  // Có từ chứa số hoặc từ quá dài (mã giao dịch) → tiêu đề do máy sinh ra
  if (raw.some((w) => /\d/.test(w) || w.length > 14)) return null;
  return raw.map((w) => ({ raw: w.normalize('NFC'), key: normalizeForSearch(w) }));
}

const isStop = (t: Token) => STOPWORDS.has(t.key) || t.key.length < 2;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Candidate = {
  /** Khoá GIỮ DẤU: "băng" ≠ "bang" — tránh gắn nhầm tag vào chữ khác dấu */
  key: string;
  /** Khoá bỏ dấu, dùng so với tag đã có / từ loại trừ */
  normKey: string;
  words: string[];
  txIds: Set<string>;
  days: Set<string>;
  forms: Map<string, number>;
};

export function proposeTags(
  txs: readonly TagTx[],
  {
    existingTagKeys = new Set<string>(),
    excludeWords = new Set<string>(),
    max = 25,
  }: {
    existingTagKeys?: ReadonlySet<string>;
    /** Từ (đã bỏ dấu) không được nằm trong tag — tên người, từ vay / nợ… */
    excludeWords?: ReadonlySet<string>;
    max?: number;
  } = {},
): TagProposal[] {
  const candidates = new Map<string, Candidate>();
  const titles = new Map<string, string>();

  for (const tx of txs) {
    const tokens = tokenize(tx.title);
    if (!tokens) continue;
    titles.set(tx.id, tx.title.trim());
    const day = new Date(tx.date + 7 * 3_600_000).toISOString().slice(0, 10);
    for (let n = 1; n <= MAX_PHRASE_WORDS; n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const slice = tokens.slice(i, i + n);
        if (isStop(slice[0]) || isStop(slice[n - 1])) continue;
        const key = slice.map((t) => t.raw).join(' ');
        const normKey = slice.map((t) => t.key).join(' ');
        const c = candidates.get(key) ?? {
          key,
          normKey,
          words: normKey.split(' '),
          txIds: new Set<string>(),
          days: new Set<string>(),
          forms: new Map<string, number>(),
        };
        c.txIds.add(tx.id);
        c.days.add(day);
        const form = slice.map((t) => t.raw).join(' ');
        c.forms.set(form, (c.forms.get(form) ?? 0) + 1);
        candidates.set(key, c);
      }
    }
  }

  const all = [...candidates.values()].filter(
    (c) =>
      c.txIds.size >= MIN_TAG_USES && c.days.size >= 2 && !c.words.some((w) => excludeWords.has(w)),
  );

  const contains = (long: Candidate, short: Candidate) =>
    long.words.length > short.words.length && ` ${long.key} `.includes(` ${short.key} `);

  // Cụm ngắn bị cụm dài hơn (chứa nó, đủ phổ biến) thay thế
  const survivors = all.filter(
    (c) => !all.some((o) => contains(o, c) && o.txIds.size >= LONGER_WINS_RATIO * c.txIds.size),
  );

  // Chọn tham lam theo số lần dùng; bỏ cụm mà phần lớn giao dịch đã thuộc một tag đã chọn
  survivors.sort((a, b) => b.txIds.size - a.txIds.size || b.words.length - a.words.length);
  const covered = new Set<string>();
  const out: TagProposal[] = [];
  for (const c of survivors) {
    // Tag đã có: coi như đã phủ các giao dịch này để cụm ngắn hơn không bị gợi ý lại
    if (existingTagKeys.has(c.normKey)) {
      c.txIds.forEach((id) => covered.add(id));
      continue;
    }
    const fresh = [...c.txIds].filter((id) => !covered.has(id));
    if (fresh.length < MIN_TAG_USES && fresh.length < 0.5 * c.txIds.size) continue;
    c.txIds.forEach((id) => covered.add(id));
    const form = [...c.forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
    out.push({
      key: c.normKey,
      name: capitalize(form),
      txIds: [...c.txIds],
      count: c.txIds.size,
      samples: [...new Set([...c.txIds].map((id) => titles.get(id)!))].slice(0, 3),
    });
    if (out.length >= max) break;
  }
  // Tag không phân biệt dấu khi lưu: hai gợi ý trùng khoá bỏ dấu thì chỉ giữ cụm phổ biến hơn
  const seen = new Set<string>();
  return out.filter((p) => !seen.has(p.key) && !!seen.add(p.key));
}
