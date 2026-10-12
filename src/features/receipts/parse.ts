// Đọc biên lai chuyển tiền / thanh toán từ chữ OCR (ảnh chụp màn hình app ngân hàng, ví điện tử).
// Hàm thuần, không phụ thuộc native → test được.
//
// ML Kit (bản Latin) hay làm mất / hỏng dấu tiếng Việt và nhầm O↔0, l↔1 → mọi so khớp chạy trên
// chữ đã bỏ dấu + sửa lỗi trong cụm số. Biên lai thường bố cục 2 cột "Nhãn ··· Giá trị": ML Kit tách
// thành 2 khối riêng → ghép lại theo toạ độ (cùng hàng ngang) trước khi đọc.
import { detectBank } from '@/lib/banks';
import { makeDate, vnDateToMs } from '@/lib/date';
import { MAX_AMOUNT } from '@/lib/money';
import { removeDiacritics } from '@/lib/text';

/** Một dòng chữ OCR kèm khung toạ độ (điểm ảnh) — cùng dạng với kết quả của modules/jwp-ocr */
export type ReceiptLine = { text: string; left: number; top: number; right: number; bottom: number };

export type ReceiptField =
  | 'amount'
  | 'type'
  | 'counterparty'
  | 'content'
  | 'date'
  | 'transactionRef'
  | 'bankCode'
  | 'fee';

export type ParsedReceipt = {
  /** Số tiền chính (đồng, > 0) */
  amount?: number;
  /** Chiều tiền: chi (chuyển đi / thanh toán) hay thu (nhận tiền) */
  type: 'expense' | 'income' | null;
  /** Người nhận (khoản chi) / người chuyển (khoản thu) / cửa hàng */
  counterparty?: string;
  /** Nội dung chuyển khoản / lời nhắn */
  content?: string;
  /** Thời điểm giao dịch (ms UTC) */
  date?: number;
  /** Mã giao dịch / số tham chiếu — dùng chống nhập trùng */
  transactionRef?: string;
  /** Ngân hàng / ví của chính người dùng (tiền đi ra với khoản chi, tiền vào với khoản thu) */
  bankCode?: string;
  /** Ngân hàng / ví của phía bên kia */
  counterpartyBankCode?: string;
  /** Phí giao dịch (0 = miễn phí) */
  fee?: number;
  /** Trả bằng ví trả sau (SPayLater, Ví trả sau MoMo...) */
  payLater: boolean;
  /** Nạp / rút tiền giữa ví điện tử và ngân hàng (thực chất là chuyển tiền giữa 2 ví của mình) */
  topUp: boolean;
  /** Độ tin cậy tổng (0–1) */
  confidence: number;
  /** Độ tin cậy từng trường (0–1) */
  fieldConfidence: Partial<Record<ReceiptField, number>>;
};

export type ParseOptions = {
  /** Mốc "bây giờ" — ngày giao dịch ở tương lai xa hơn 1 ngày bị coi là đọc sai */
  now?: number;
};

// ─── Chuẩn hoá ──────────────────────────────────────────────────────────────

type Row = {
  raw: string;
  /** Bỏ dấu, chữ thường, gộp khoảng trắng */
  norm: string;
  /** norm + sửa O→0, l→1 trong cụm số (cùng độ dài với norm) */
  fixed: string;
  /** Vị trí ký tự trong norm → vị trí trong raw */
  map: number[];
  /** Cột giá trị (toạ độ trái) nếu có toạ độ; dùng nối nội dung xuống dòng */
  cells: { text: string; left: number }[];
  /** Chiều cao chữ (0 nếu không có toạ độ) */
  height: number;
};

function normalizeWithMap(raw: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (/\s/.test(ch)) {
      if (norm) pendingSpace = true;
      continue;
    }
    const out = removeDiacritics(ch).toLowerCase();
    if (!out) continue; // dấu thanh rời (chuỗi NFD)
    if (pendingSpace) {
      norm += ' ';
      map.push(i);
      pendingSpace = false;
    }
    for (const c of out) {
      norm += c;
      map.push(i);
    }
  }
  return { norm, map };
}

/** Sửa lỗi OCR trong cụm trông như số: 'l50.ooo' → '150.000', '11/1o/2026' → '11/10/2026' */
function fixDigits(norm: string): string {
  return norm.replace(/\S+/g, (token) => {
    if (!/\d/.test(token)) return token;
    const m = /^([+\-−–(]?(?:vnd|₫)?)([0-9oil|][0-9oil|.,:/-]*?)((?:vnd|₫|dong|d)?[.,:;)]*)$/.exec(
      token,
    );
    if (!m) return token;
    return m[1] + m[2].replace(/o/g, '0').replace(/[il|]/g, '1') + m[3];
  });
}

function makeRow(raw: string, cells: Row['cells'], height: number): Row {
  const { norm, map } = normalizeWithMap(raw);
  return { raw, norm, fixed: fixDigits(norm), map, cells, height };
}

/** Ghép các dòng OCR cùng hàng ngang (nhãn bên trái + giá trị bên phải) thành một hàng */
function buildRows(text: string, lines?: readonly ReceiptLine[]): Row[] {
  const usable = (lines ?? []).filter((l) => l.text.trim() && l.bottom > l.top);
  if (usable.length) {
    const sorted = [...usable].sort((a, b) => a.top - b.top || a.left - b.left);
    const groups: ReceiptLine[][] = [];
    for (const line of sorted) {
      const h = line.bottom - line.top;
      let target: ReceiptLine[] | undefined;
      for (let g = groups.length - 1; g >= Math.max(0, groups.length - 3) && !target; g--) {
        const sameRow = groups[g].some((o) => {
          const overlap = Math.min(o.bottom, line.bottom) - Math.max(o.top, line.top);
          return overlap >= 0.5 * Math.min(h, o.bottom - o.top);
        });
        if (sameRow) target = groups[g];
      }
      if (target) target.push(line);
      else groups.push([line]);
    }
    return groups.map((group) => {
      const cells = [...group]
        .sort((a, b) => a.left - b.left)
        .map((l) => ({ text: l.text.trim(), left: l.left }));
      const height = Math.max(...group.map((l) => l.bottom - l.top));
      return makeRow(cells.map((c) => c.text).join('   '), cells, height);
    });
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => makeRow(line, [{ text: line, left: 0 }], 0));
}

// ─── Nhãn ───────────────────────────────────────────────────────────────────

type LabelKind =
  | 'words'
  | 'balance'
  | 'fee'
  | 'total'
  | 'amount'
  | 'receiverBank'
  | 'senderBank'
  | 'receiverAccount'
  | 'source'
  | 'bank'
  | 'phone'
  | 'account'
  | 'receiverName'
  | 'senderName'
  | 'ref'
  | 'content'
  | 'service'
  | 'time'
  | 'status';

/** Chữ 'o' trong mẫu khớp cả '0' (OCR nhầm) */
const tolerant = (source: string) => source.replace(/o/g, '[o0]');

// Thứ tự quan trọng: cụ thể trước, chung chung sau. So khớp ở ĐẦU hàng, trên chữ đã bỏ dấu.
const LABEL_DEFS: [LabelKind, string][] = [
  ['words', '(?:so tien )?(?:viet )?bang chu'],
  ['balance', '(?:so du|sd)(?: kha dung| tai khoan| cuoi(?: ky)?| hien tai| sau (?:giao dich|gd))?'],
  ['fee', '(?:tong )?phi(?: giao dich| gd| chuyen tien| chuyen khoan| dich vu| thanh toan| xu ly)?'],
  ['total', 'tong(?: tien| cong| so tien| thanh toan| tien thanh toan)?|thanh tien'],
  [
    'amount',
    'so tien(?: giao dich| gd| chuyen(?: khoan)?| thanh toan| nhan| giao dich)?|gia tri(?: giao dich)?|amount|st',
  ],
  ['receiverBank', 'ngan hang(?: nguoi)? (?:nhan|thu huong|huong|den)|(?:den|toi) ngan hang'],
  ['senderBank', 'ngan hang(?: nguoi)? (?:chuyen|gui)|tu ngan hang'],
  [
    'receiverAccount',
    '(?:so )?(?:tai khoan|tk|stk|the)(?: nguoi)? (?:nhan|thu huong|huong|den)|(?:den|toi) (?:so )?(?:tai khoan|tk|the)',
  ],
  [
    'source',
    'tai khoan (?:nguon|chuyen|trich no|thanh toan)|tu (?:so )?(?:tai khoan|tk|the|vi)|tk nguon|nguon(?: tien| thanh toan)?|thanh toan (?:bang|qua|tu)|(?:phuong|hinh) thuc(?: thanh toan)?',
  ],
  ['bank', 'ngan hang'],
  ['phone', 'so dien thoai|sdt|dien thoai|so dt'],
  ['account', 'so tai khoan|stk|tai khoan|so the|tk'],
  [
    'receiverName',
    '(?:ten )?(?:nguoi|don vi) (?:thu huong|nhan|huong)(?: tien)?|ten (?:tai khoan|tk|chu tai khoan) (?:nhan|thu huong|huong)|(?:chuyen )?(?:den|toi)(?! (?:ngan hang|han|ngay|tai khoan|tk))|nha cung cap|(?:ten )?cua hang|merchant|doi tac|thanh toan cho|don vi chap nhan|diem ban',
  ],
  [
    'senderName',
    '(?:ten )?(?:nguoi|don vi) (?:chuyen|gui)(?: tien)?|ten (?:tai khoan|tk) (?:chuyen|gui)|tu(?! (?:dong|ngay|luc))',
  ],
  [
    'ref',
    'ma (?:giao dich|gd|tham chieu|yeu cau|thanh toan|don hang|hoa don|lenh|bien lai)|so (?:tham chieu|but toan|giao dich|lenh(?: giao dich)?|chung tu|ct|ref|gd)|ref(?: no)?|trace|transaction id|id giao dich|ma',
  ],
  [
    'content',
    'noi dung(?: chuyen khoan| chuyen tien| giao dich| ck| thanh toan| gd)?|loi nhan|dien giai|mo ta|ghi chu|nd|message|chi tiet(?: giao dich)?|don hang|san pham',
  ],
  ['service', 'dich vu|loai (?:giao dich|dich vu)'],
  [
    'time',
    'thoi gian(?: giao dich| thuc hien| thanh toan| tao| chuyen)?|ngay(?: gio)?(?: giao dich| thuc hien| hieu luc| tao| thanh toan| chuyen)?|gio giao dich|time|date|luc',
  ],
  ['status', 'trang thai'],
];

const LABELS = LABEL_DEFS.map(
  ([kind, source]) => [kind, new RegExp(`^(?:${tolerant(source)})(?![a-z0-9])`)] as const,
);

function matchLabel(norm: string): { kind: LabelKind; end: number } | null {
  for (const [kind, re] of LABELS) {
    const m = re.exec(norm);
    if (m) return { kind, end: m[0].length };
  }
  return null;
}

/** Từ khoá đứng ngay trước một số tiền (cùng hàng) → số đó là gì */
type AmountContext = 'words' | 'balance' | 'fee' | 'total' | 'amount' | 'ref' | 'account' | 'phone' | 'time';
const AMOUNT_CONTEXT_DEFS: [AmountContext, string][] = [
  ['words', 'so tien bang chu|bang chu'],
  ['balance', 'so du kha dung|so du cuoi ky|so du hien tai|so du tai khoan|so du|sd'],
  ['fee', 'tong phi|phi giao dich|phi chuyen tien|phi chuyen khoan|phi dich vu|phi gd|phi'],
  ['total', 'tong thanh toan|tong tien thanh toan|tong so tien|tong tien|tong cong|thanh tien'],
  ['ref', 'ma giao dich|ma gd|so tham chieu|ma tham chieu|so but toan|so giao dich|ref|trace'],
  [
    'amount',
    'so tien giao dich|so tien thanh toan|so tien chuyen|so tien gd|so tien|gia tri giao dich|gia tri|giao dich|gd|st|amount',
  ],
  ['account', 'so tai khoan|tai khoan|stk|tk|so the'],
  ['phone', 'so dien thoai|sdt|dien thoai'],
  ['time', 'thoi gian|ngay giao dich|ngay|luc'],
];
const CONTEXT_KINDS = AMOUNT_CONTEXT_DEFS.map(([kind]) => kind);
const CONTEXT_RE = new RegExp(
  `(^|[^a-z0-9])(?:${AMOUNT_CONTEXT_DEFS.map(([, s]) => `(${tolerant(s)})`).join('|')})(?![a-z0-9])`,
  'g',
);

/** Từ khoá gần nhất kết thúc trước vị trí `before` trong hàng */
function contextBefore(fixed: string, before: number): AmountContext | null {
  let found: AmountContext | null = null;
  CONTEXT_RE.lastIndex = 0;
  for (let m = CONTEXT_RE.exec(fixed); m; m = CONTEXT_RE.exec(fixed)) {
    const end = m.index + m[0].length;
    if (end > before) break;
    const group = m.slice(2).findIndex((g) => g !== undefined);
    if (group >= 0) found = CONTEXT_KINDS[group];
    if (m[0].length === 0) CONTEXT_RE.lastIndex++;
  }
  return found;
}

// ─── Hàng đã gắn nhãn ───────────────────────────────────────────────────────

type RowInfo = {
  kind: LabelKind | null;
  /** Giá trị (chữ gốc) sau nhãn — hoặc cả hàng nếu không có nhãn */
  value: string;
  /** Hàng giá trị nằm dưới hàng nhãn (bố cục xếp chồng) */
  inherited: boolean;
  /** Hàng phụ không nhãn ngay sau người nhận / người chuyển (ngân hàng, số tài khoản của họ) */
  detailOf: 'receiver' | 'sender' | null;
};

const RECEIVER_KINDS: LabelKind[] = ['receiverName', 'receiverAccount', 'receiverBank'];
const SENDER_KINDS: LabelKind[] = ['senderName', 'senderBank'];

function cleanValue(value: string): string {
  return value.replace(/^[\s:：|•·.\-–]+/, '').trim();
}

function labelRows(rows: Row[]): RowInfo[] {
  const info: RowInfo[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = matchLabel(row.norm);
    if (!label) {
      info.push({ kind: null, value: row.raw, inherited: false, detailOf: null });
      continue;
    }
    const start = label.end < row.map.length ? row.map[label.end] : row.raw.length;
    let value = cleanValue(row.raw.slice(start));
    info.push({ kind: label.kind, value, inherited: false, detailOf: null });
    // Nhãn đứng riêng một hàng, giá trị ở hàng dưới
    const next = rows[i + 1];
    if (!value && next && !matchLabel(next.norm)) {
      value = cleanValue(next.raw);
      info[i].value = value;
      info.push({ kind: label.kind, value, inherited: true, detailOf: null });
      i++;
    }
  }
  // Các hàng không nhãn ngay sau người nhận / người chuyển: ngân hàng, số tài khoản của họ
  let side: RowInfo['detailOf'] = null;
  for (const item of info) {
    if (item.kind) side = RECEIVER_KINDS.includes(item.kind) ? 'receiver' : SENDER_KINDS.includes(item.kind) ? 'sender' : null;
    else item.detailOf = side;
  }
  return info;
}

// ─── Số tiền ────────────────────────────────────────────────────────────────

type AmountCandidate = {
  value: number;
  sign: '+' | '-' | null;
  currency: boolean;
  grouped: boolean;
  spaceGrouped: boolean;
  context: AmountContext | null;
  alone: boolean;
  row: number;
  height: number;
  rowKind: LabelKind | null;
};

const MONEY_RE =
  /(^|[^a-z0-9.,])([+\-−–]\s?)?((?:vnd|₫)\s{0,3})?(\d{1,3}(?:(?:[.,]\s?|\s)\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)(\s{0,3}(?:vnd|₫|dong)|\s?d)?(?![a-z0-9])/g;

function findAmounts(rows: Row[], info: RowInfo[]): AmountCandidate[] {
  const out: AmountCandidate[] = [];
  rows.forEach((row, index) => {
    const meta = info[index];
    // Hàng giá trị nằm dưới nhãn "Số tiền" / "Số dư"... → kế thừa ngữ cảnh của nhãn
    const inherited: AmountContext | null =
      meta.inherited && meta.kind && (CONTEXT_KINDS as string[]).includes(meta.kind)
        ? (meta.kind as AmountContext)
        : null;
    MONEY_RE.lastIndex = 0;
    for (let m = MONEY_RE.exec(row.fixed); m; m = MONEY_RE.exec(row.fixed)) {
      const [whole, lead, signPart, prefix, digits, , suffix] = m;
      const start = m.index + lead.length;
      const value = Number(digits.replace(/\D/g, ''));
      if (!Number.isFinite(value) || value > MAX_AMOUNT) continue;
      const sign = signPart ? (signPart.trim() === '+' ? '+' : '-') : null;
      const grouped = /[.,\s]/.test(digits);
      const rest = (row.fixed.slice(0, start) + row.fixed.slice(m.index + whole.length))
        .replace(/vnd|dong|₫/g, '')
        .replace(/(^|\s)d(?=\s|$)/g, ' ')
        .replace(/[\s+\-−–:.,()*]/g, '');
      out.push({
        value,
        sign,
        currency: !!prefix || !!suffix,
        grouped,
        spaceGrouped: grouped && !/[.,]/.test(digits),
        context: contextBefore(row.fixed, start) ?? inherited,
        alone: rest.length === 0,
        row: index,
        height: row.height,
        rowKind: meta.kind,
      });
    }
  });
  return out;
}

const NOT_MONEY: (AmountContext | null)[] = ['ref', 'account', 'phone', 'time'];

function scoreAmount(c: AmountCandidate, rowCount: number, medianHeight: number): number | null {
  if (c.context === 'balance' || c.context === 'words' || c.context === 'fee') return null;
  const labelled = c.context === 'amount' || c.context === 'total';
  // Số trơn (mã GD, số tài khoản, năm...) chỉ là tiền khi có đơn vị / nhãn số tiền
  if (!c.currency && !labelled && (!c.grouped || c.spaceGrouped) && !(c.alone && c.grouped)) {
    return null;
  }
  if (NOT_MONEY.includes(c.context) && !c.currency) return null;
  if (c.value <= 0) return null;
  let score = 0;
  if (c.context === 'amount') score += 6;
  else if (c.context === 'total') score += 4;
  if (c.currency) score += 3;
  if (c.sign) score += 2;
  if (c.grouped && !c.spaceGrouped) score += 1;
  if (c.alone) score += 2;
  if (medianHeight > 0 && c.height > 0) {
    const ratio = c.height / medianHeight;
    if (ratio >= 1.5) score += 3;
    else if (ratio >= 1.2) score += 1;
  }
  if (c.row < Math.max(3, rowCount * 0.4)) score += 1;
  if (c.value < 1_000) score -= 4;
  if (c.rowKind && ['content', 'receiverName', 'senderName', 'service', 'status'].includes(c.rowKind)) {
    score -= 4;
  }
  return score;
}

function median(values: number[]): number {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}

function pickAmount(candidates: AmountCandidate[], rows: Row[]) {
  const medianHeight = median(rows.map((r) => r.height));
  const scored = candidates
    .map((c) => ({ c, score: scoreAmount(c, rows.length, medianHeight) }))
    .filter((s): s is { c: AmountCandidate; score: number } => s.score !== null);
  if (!scored.length) return null;
  // Cùng một số xuất hiện nhiều lần (số lớn ở đầu + dòng "Số tiền") → chắc chắn hơn
  for (const s of scored) {
    const repeats = scored.filter((o) => o !== s && o.c.value === s.c.value).length;
    s.score += Math.min(2, repeats);
  }
  scored.sort((a, b) => b.score - a.score || b.c.value - a.c.value);
  const best = scored[0];
  const sign = best.c.sign ?? scored.find((s) => s.c.value === best.c.value && s.c.sign)?.c.sign ?? null;
  const confidence =
    best.score >= 10 ? 0.95 : best.score >= 8 ? 0.85 : best.score >= 6 ? 0.7 : best.score >= 4 ? 0.5 : 0.3;
  return { value: best.c.value, sign, confidence };
}

function pickFee(candidates: AmountCandidate[], rows: Row[], info: RowInfo[]): number | undefined {
  const fee = candidates.find((c) => c.context === 'fee' && (c.currency || c.grouped || c.value === 0));
  if (fee) return fee.value;
  const freeRow = info.findIndex(
    (item, i) => item.kind === 'fee' && /mien phi|free|khong mat phi/.test(rows[i].norm),
  );
  return freeRow >= 0 ? 0 : undefined;
}

// ─── Chiều tiền ─────────────────────────────────────────────────────────────

const INCOME_PHRASES =
  /nhan tien thanh cong|ban (?:da )?nhan(?: duoc)?|da nhan duoc|nhan duoc tien|duoc cong|cong tien|tien vao|hoan tien|ghi co|nap tien thanh cong|nhan tien tu/g;
const EXPENSE_PHRASES =
  /chuyen (?:tien|khoan)(?: nhanh)? thanh cong|chuyen thanh cong|thanh toan thanh cong|da thanh toan|ban (?:da )?chuyen|da chuyen|da tra|tru tien|ghi no|rut tien|thanh toan hoa don|mua hang thanh cong|thanh toan (?:qr|don hang)/g;

const NAME_KINDS: LabelKind[] = ['content', 'receiverName', 'senderName', 'service'];

function detectDirection(
  rows: Row[],
  info: RowInfo[],
  sign: '+' | '-' | null,
): { type: 'expense' | 'income' | null; confidence: number } {
  const text = rows
    .filter((_, i) => !NAME_KINDS.includes(info[i].kind as LabelKind) && !info[i].detailOf)
    .map((r) => r.fixed)
    .join(' | ');
  let income = 0;
  let expense = 0;
  if (sign === '+') income += 4;
  if (sign === '-') expense += 4;
  income += Math.min(4, (text.match(INCOME_PHRASES)?.length ?? 0) * 2);
  expense += Math.min(4, (text.match(EXPENSE_PHRASES)?.length ?? 0) * 2);
  if (/giao dich thanh cong/.test(text)) expense += 0.5;
  const hasReceiver = info.some((r) => r.kind === 'receiverName' || r.kind === 'receiverAccount');
  const hasSender = info.some((r) => r.kind === 'senderName' || r.kind === 'senderBank');
  if (hasReceiver) expense += 1;
  if (hasSender && !hasReceiver) income += 1.5;
  if (income === expense) return { type: null, confidence: 0 };
  const diff = Math.abs(income - expense);
  return {
    type: income > expense ? 'income' : 'expense',
    confidence: Math.min(0.95, 0.4 + 0.12 * diff),
  };
}

// ─── Người nhận / nội dung / mã GD ──────────────────────────────────────────

// Chữ cái Latin + tiếng Việt (không dùng \p{L} cho chắc chạy trên Hermes)
const LETTER = 'A-Za-z\\u00C0-\\u024F\\u1E00-\\u1EFF';
const LETTERS_RE = new RegExp(`[${LETTER}]`, 'g');
const WORD_START_RE = new RegExp(`(^|[\\s-])([${LETTER}])`, 'g');
const countLetters = (text: string) => text.match(LETTERS_RE)?.length ?? 0;

/** 'NGUYEN VAN AN' → 'Nguyen Van An' (chỉ khi toàn chữ hoa) */
function titleCase(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(WORD_START_RE, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function cleanName(value: string): string | undefined {
  // Tách phần ngân hàng / số tài khoản: 'NGUYEN VAN A - VCB' → 'NGUYEN VAN A'
  const parts = value
    .split(/\s[-–•|·]\s|\s{3,}|[(),]/)
    .map((p) =>
      p
        .replace(/[*xX]{0,8}\d[\d*xX.]{3,}/g, ' ') // số tài khoản / điện thoại (kể cả bị che ***)
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => countLetters(p) >= 2);
  // 'Vietcombank - NGUYEN VAN A' → bỏ phần chỉ là tên ngân hàng
  const name = parts.find((p) => !(detectBank(p) && p.split(' ').length <= 2)) ?? parts[0];
  return name ? titleCase(name).slice(0, 60) : undefined;
}

function cleanRef(value: string): string | undefined {
  const tokens = value.split(/\s+/);
  const kept: string[] = [];
  for (const token of tokens) {
    const t = token.replace(/[:：,;]+$/, '');
    if (!/^[A-Za-z0-9._\-/]+$/.test(t)) break;
    if (/\d/.test(t) || (kept.length === 0 && /^[A-Z]{1,5}$/.test(t))) kept.push(t);
    else break;
  }
  const ref = kept.join('').toUpperCase();
  if (ref.length < 5 || (ref.match(/\d/g)?.length ?? 0) < 3) return undefined;
  return ref.slice(0, 40);
}

function cleanContent(value: string): string | undefined {
  const text = value.replace(/\s+/g, ' ').trim();
  if (countLetters(text) + (text.match(/\d/g)?.length ?? 0) < 2) return undefined;
  return text.slice(0, 140);
}

// ─── Ngày giờ ───────────────────────────────────────────────────────────────

const DATE_DMY = /(^|[^\d])(\d{1,2})\s?[/\-.]\s?(\d{1,2})\s?[/\-.]\s?(\d{4}|\d{2})(?!\d)/;
const DATE_YMD = /(^|[^\d])(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?!\d)/;
const DATE_WORDS = /(^|[^\d])(\d{1,2})\s?(?:thg|thang)\s?(\d{1,2}),?\s+(?:nam\s)?(\d{4})(?!\d)/;
const TIME_RE = /(^|[^\d])([01]?\d|2[0-3])\s?[:h]\s?([0-5]\d)(?:\s?:\s?([0-5]\d))?(?!\d)/;

type FoundDate = { year: number; month: number; day: number; start: number; end: number };

function findDate(text: string): FoundDate | null {
  const dmy = DATE_DMY.exec(text);
  if (dmy) {
    const year = dmy[4].length === 2 ? 2000 + Number(dmy[4]) : Number(dmy[4]);
    const start = dmy.index + dmy[1].length;
    return { year, month: Number(dmy[3]), day: Number(dmy[2]), start, end: dmy.index + dmy[0].length };
  }
  const words = DATE_WORDS.exec(text);
  if (words) {
    const start = words.index + words[1].length;
    return {
      year: Number(words[4]),
      month: Number(words[3]),
      day: Number(words[2]),
      start,
      end: words.index + words[0].length,
    };
  }
  const ymd = DATE_YMD.exec(text);
  if (ymd) {
    const start = ymd.index + ymd[1].length;
    return {
      year: Number(ymd[2]),
      month: Number(ymd[3]),
      day: Number(ymd[4]),
      start,
      end: ymd.index + ymd[0].length,
    };
  }
  return null;
}

function findTime(text: string): { hour: number; minute: number; second: number } | null {
  const m = TIME_RE.exec(text);
  if (!m) return null;
  let hour = Number(m[2]);
  const after = text.slice(m.index + m[0].length, m.index + m[0].length + 4);
  if (/^\s?(pm|ch)\b/.test(after) && hour < 12) hour += 12;
  if (/^\s?(am|sa)\b/.test(after) && hour === 12) hour = 0;
  return { hour, minute: Number(m[3]), second: m[4] ? Number(m[4]) : 0 };
}

function validDate(d: FoundDate): boolean {
  if (d.year < 2000 || d.year > 2100 || d.month < 1 || d.month > 12 || d.day < 1) return false;
  return d.day <= new Date(Date.UTC(d.year, d.month, 0)).getUTCDate();
}

function pickDate(
  rows: Row[],
  info: RowInfo[],
  now: number,
): { value: number; confidence: number } | null {
  const order = rows
    .map((_, i) => i)
    .sort((a, b) => Number(info[b].kind === 'time') - Number(info[a].kind === 'time'));
  for (const i of order) {
    const text = rows[i].fixed;
    const date = findDate(text);
    if (!date || !validDate(date)) continue;
    // Giờ: cùng hàng (bỏ phần ngày), không có thì hàng kề
    const sameRow = text.slice(0, date.start) + ' ' + text.slice(date.end);
    const time =
      findTime(sameRow) ??
      (rows[i + 1] && !findDate(rows[i + 1].fixed) ? findTime(rows[i + 1].fixed) : null) ??
      (rows[i - 1] && !findDate(rows[i - 1].fixed) ? findTime(rows[i - 1].fixed) : null);
    const pad = (n: number) => String(n).padStart(2, '0');
    const value =
      vnDateToMs(
        makeDate(date.year, date.month, date.day),
        time ? `${pad(time.hour)}:${pad(time.minute)}` : '12:00',
      ) + (time ? time.second * 1000 : 0);
    if (value > now + 86_400_000) continue;
    const labelled = info[i].kind === 'time';
    return { value, confidence: (labelled ? 0.9 : 0.75) - (time ? 0 : 0.2) };
  }
  return null;
}

// ─── Ngân hàng / ví ─────────────────────────────────────────────────────────

// Tên app ví / ngân hàng số: kiểm tra trước detectBank (vd 'Cake by VPBank' là Cake, không phải VPBank)
const APP_SIGNATURES: [RegExp, string][] = [
  [/\bs ?pay ?later\b/, 'SHOPEEPAY'],
  [/\bshopee ?pay\b/, 'SHOPEEPAY'],
  [/\bmomo\b/, 'MOMO'],
  [/\bzalo ?pay\b/, 'ZALOPAY'],
  [/\bviettel ?(?:money|pay)\b/, 'VIETTELMONEY'],
  [/\bvnpt ?(?:money|pay)\b/, 'VNPTMONEY'],
  [/\bcake\b/, 'CAKE'],
  [/\btimo\b/, 'TIMO'],
  [/\bvikki\b/, 'VIKKI'],
];

function bankOf(norm: string): string | undefined {
  const text = norm.replace(/[^a-z0-9 ]/g, ' ');
  for (const [re, code] of APP_SIGNATURES) if (re.test(text)) return code;
  return detectBank(text)?.code;
}

const NOT_APP_KINDS: LabelKind[] = [
  'receiverBank',
  'senderBank',
  'receiverAccount',
  'source',
  'bank',
  'account',
  'phone',
  'receiverName',
  'senderName',
  'ref',
  'content',
  'service',
  'words',
];

function pickBanks(rows: Row[], info: RowInfo[], type: 'expense' | 'income' | null) {
  const first = (indexes: number[], text: (i: number) => string) => {
    for (const i of indexes) {
      const code = bankOf(text(i));
      if (code) return code;
    }
    return undefined;
  };
  const all = rows.map((_, i) => i);
  const sourceRows = all.filter((i) => info[i].kind === 'source');
  const source = first(sourceRows, (i) => normalizeWithMap(info[i].value).norm);
  // App đang chụp: hàng không thuộc phía bên kia, không phải nội dung / mã GD
  const appRows = all.filter(
    (i) => !NOT_APP_KINDS.includes(info[i].kind as LabelKind) && !info[i].detailOf && !/chia se/.test(rows[i].norm),
  );
  const app = first(appRows, (i) => rows[i].norm);
  const otherSide = type === 'income' ? 'sender' : 'receiver';
  const otherKinds: LabelKind[] =
    type === 'income' ? [...SENDER_KINDS, 'bank'] : [...RECEIVER_KINDS, 'bank', 'account'];
  const otherRows = all.filter(
    (i) => otherKinds.includes(info[i].kind as LabelKind) || info[i].detailOf === otherSide,
  );
  const other = first(otherRows, (i) => normalizeWithMap(info[i].value).norm);

  if (type === 'income') {
    // Nhận tiền / nạp tiền vào ví: "Nguồn tiền" là phía bên kia
    return { bankCode: app, counterpartyBankCode: other ?? source };
  }
  return { bankCode: source ?? app, counterpartyBankCode: other };
}

// ─── Ghép lại ───────────────────────────────────────────────────────────────

export function parseReceipt(
  text: string,
  lines?: readonly ReceiptLine[] | null,
  options: ParseOptions = {},
): ParsedReceipt {
  const now = options.now ?? Date.now();
  const rows = buildRows(text ?? '', lines ?? undefined);
  const info = labelRows(rows);
  const fields: ParsedReceipt['fieldConfidence'] = {};
  const result: ParsedReceipt = {
    type: null,
    payLater: false,
    topUp: false,
    confidence: 0,
    fieldConfidence: fields,
  };
  if (!rows.length) return result;

  const candidates = findAmounts(rows, info);
  const amount = pickAmount(candidates, rows);
  if (amount) {
    result.amount = amount.value;
    fields.amount = amount.confidence;
  }
  const fee = pickFee(candidates, rows, info);
  if (fee !== undefined) {
    result.fee = fee;
    fields.fee = 0.8;
  }

  const direction = detectDirection(rows, info, amount?.sign ?? null);
  result.type = direction.type;
  if (direction.type) fields.type = direction.confidence;

  // Người nhận (khoản chi) / người chuyển (khoản thu)
  const nameKinds: LabelKind[] =
    direction.type === 'income'
      ? ['senderName']
      : direction.type === 'expense'
        ? ['receiverName', 'receiverAccount']
        : ['receiverName', 'senderName', 'receiverAccount'];
  for (const kind of nameKinds) {
    const name = info
      .filter((r) => r.kind === kind && !r.inherited)
      .map((r) => cleanName(r.value))
      .find(Boolean);
    if (name) {
      result.counterparty = name;
      fields.counterparty = kind === 'receiverAccount' ? 0.6 : 0.85;
      break;
    }
  }
  if (!result.counterparty) {
    // "Chuyển tiền tới NGUYEN VAN A" / "Nhận tiền từ ..." giữa câu
    for (const row of rows) {
      const m = /(?:chuyen (?:tien|khoan)|thanh toan|nhan tien) (?:den|toi|cho|tu) (.+)$/.exec(row.norm);
      if (!m) continue;
      const name = cleanName(row.raw.slice(row.map[m.index + m[0].length - m[1].length]));
      if (name) {
        result.counterparty = name;
        fields.counterparty = 0.6;
        break;
      }
    }
  }

  // Nội dung: lấy hàng có nhãn; nội dung dài xuống dòng (có toạ độ) → nối hàng kế cùng cột
  const contentIndex = info.findIndex((r) => r.kind === 'content' && !r.inherited && cleanContent(r.value));
  if (contentIndex >= 0) {
    let content = info[contentIndex].value;
    const row = rows[contentIndex];
    const valueLeft = row.cells.length > 1 ? row.cells[1].left : null;
    for (let j = contentIndex + 1; valueLeft !== null && j < rows.length; j++) {
      const next = rows[j];
      if (info[j].kind || info[j].inherited || next.cells.length !== 1) break;
      if (Math.abs(next.cells[0].left - valueLeft) > Math.max(24, row.height * 1.5)) break;
      content += ` ${next.raw}`;
    }
    result.content = cleanContent(content);
    fields.content = 0.8;
  } else {
    const service = info.find((r) => r.kind === 'service' && !r.inherited && cleanContent(r.value));
    if (service) {
      result.content = cleanContent(service.value);
      fields.content = 0.5;
    }
  }

  // Mã giao dịch
  const ref = info
    .filter((r) => r.kind === 'ref' && !r.inherited)
    .map((r) => cleanRef(r.value))
    .find(Boolean);
  if (ref) {
    result.transactionRef = ref;
    fields.transactionRef = 0.9;
  } else {
    const ft = /\bFT\s?\d{5,}[A-Z0-9]*/i.exec(rows.map((r) => r.raw).join('\n'));
    if (ft) {
      result.transactionRef = ft[0].replace(/\s/g, '').toUpperCase();
      fields.transactionRef = 0.7;
    }
  }

  const date = pickDate(rows, info, now);
  if (date) {
    result.date = date.value;
    fields.date = date.confidence;
  }

  const banks = pickBanks(rows, info, direction.type);
  if (banks.bankCode) {
    result.bankCode = banks.bankCode;
    fields.bankCode = 0.7;
  }
  if (banks.counterpartyBankCode && banks.counterpartyBankCode !== banks.bankCode) {
    result.counterpartyBankCode = banks.counterpartyBankCode;
  }

  const all = rows.map((r) => r.norm).join(' | ');
  result.payLater = /s ?pay ?later|vi tra sau|pay ?later|mua truoc tra sau/.test(all);
  result.topUp =
    /nap tien (?:vao )?(?:vi|tai khoan)|nap tien thanh cong|nap vi|top ?up|rut tien (?:ve|thanh cong)/.test(all) &&
    !/dien thoai|the cao|data|game/.test(all);

  // Độ tin cậy tổng: số tiền quan trọng nhất
  const confidence =
    (fields.amount ?? 0) * 0.5 +
    (fields.type ?? 0) * 0.15 +
    (fields.date ?? 0) * 0.15 +
    (result.counterparty || result.content ? 0.1 : 0) +
    (result.transactionRef ? 0.1 : 0);
  result.confidence = Math.round((amount ? confidence : Math.min(confidence, 0.2)) * 100) / 100;
  return result;
}
