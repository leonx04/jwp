// Tự đọc thông báo / SMS biến động số dư của ngân hàng & ví điện tử → gợi ý một giao dịch.
// Hàm thuần, chạy hoàn toàn trên máy. Định dạng mỗi ngân hàng một khác nên parser đi theo dấu hiệu chung
// (số có dấu +/−, từ khoá nhận / chuyển, "SD" = số dư, "ND" = nội dung); mẫu thật được ghi trong
// "Nhật ký" để chỉnh thêm khi gặp định dạng mới.
import { detectBank } from '@/lib/banks';

export type CaptureSource = 'notification' | 'sms';

export type RawCapture = {
  source: CaptureSource;
  /** Notification: tên gói app (com.mbmobile…) · SMS: tên / số người gửi (MBBANK, TPBank…) */
  sender: string;
  title: string;
  text: string;
  /** ms */
  postedAt: number;
};

export type ParsedCapture = {
  type: 'income' | 'expense';
  amount: number;
  /** Số dư sau giao dịch (nếu thông báo có) */
  balanceAfter: number | null;
  /** Nội dung chuyển khoản / lời nhắn */
  content: string;
  /** Người gửi / nhận (MoMo…) */
  counterparty: string | null;
  /** Mã ngân hàng / ví theo lib/banks (MB, TPB, TCB, MOMO…) */
  bankCode: string | null;
};

/** Tên gói app → mã ngân hàng / ví (lib/banks). Danh sách mặc định, có thể chỉnh trong cài đặt. */
export const KNOWN_PACKAGES: Readonly<Record<string, string>> = {
  'com.mbmobile': 'MB',
  'com.tpb.mb.gprsandroid': 'TPB',
  'vn.com.techcombank.bb.app': 'TCB',
  'com.mservice.momotransfer': 'MOMO',
  'com.shopee.vn': 'SHOPEEPAY',
  'vn.com.vng.zalopay': 'ZALOPAY',
  'com.VCB': 'VCB',
  'com.vietinbank.ipay': 'ICB',
  'com.vnpay.bidv': 'BIDV',
  'mobile.acb.com.vn': 'ACB',
  'com.vnpay.vpbankonline': 'VPB',
  'com.sacombank.mobilebanking': 'STB',
  'com.vnpay.hdbank': 'HDB',
  'com.msb.mbank': 'MSB',
};

/** "1.234.567" / "1,234,567" / "50.000" / "50000" / "1,234,567.00" → số nguyên đồng; null nếu không phải số tiền */
export function parseVnd(raw: string): number | null {
  let s = raw.trim().replace(/\s+/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  // Phần lẻ ".00" / ",50" ở cuối một số đã có dấu ngăn nghìn → bỏ (đồng Việt Nam không có lẻ)
  if (/[.,]\d{3}[.,]\d{1,2}$/.test(s)) s = s.replace(/[.,]\d{1,2}$/, '');
  const digits = s.replace(/[.,]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const MONEY = String.raw`(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+)`;
const UNIT = String.raw`\s?(?:VND|VNĐ|vnd|đ|₫|d)(?![a-zA-Z])`;
const SIGN = String.raw`([+\-−–])`;

/** Số dư: "SD: 1,234,567VND", "Số dư 934.567 đ", "So du: ..." (nhóm 1 = số, nhóm 2 = đơn vị nếu có) */
const BALANCE_RE = new RegExp(
  String.raw`(?:\bSD\b|s[ốo]\s?d[ưu](?:\s+(?:cu[ốo]i|hi[ệe]n\s+t[ạa]i|kh[ảa]\s+d[ụu]ng))?)\s*(?:TK)?[:\s]*(?:là\s*)?${MONEY}(${UNIT})?(?![\d*])`,
  'gi',
);
const SIGNED_AMOUNT_RE = new RegExp(`${SIGN}\\s?${MONEY}${UNIT}`, 'i');
const PLAIN_AMOUNT_RE = new RegExp(`${MONEY}${UNIT}`, 'i');

const INCOME_RE =
  /(nh[ậa]n(?![a-zà-ỹ])|ghi\s?c[óo]|ti[ềe]n\s?v[àa]o|c[ộo]ng\s|n[ạa]p\s|ho[àa]n\s?ti[ềe]n|credit)/i;
const EXPENSE_RE =
  /(chuy[ểe]n|thanh\s?to[áa]n|ghi\s?n[ợo]|r[úu]t(?![a-zà-ỹ])|tr[ừu]\s|mua\s|debit)/i;
const NOISE_RE =
  /((?<![a-zà-ỹ])otp(?![a-zà-ỹ])|m[ãa]\s?x[áa]c\s?th[ựu]c|m[ãa]\s?kh[ôo]ng\s?chia\s?s[ẻe]|khuy[ếe]n\s?m[ãa]i|[ưu]u\s?[đd][ãa]i)/i;

/** Nội dung / lời nhắn: dừng trước dấu |, xuống dòng hoặc phần số dư */
const CONTENT_RE =
  /(?:(?<![a-zà-ỹ])ND(?![a-zà-ỹ])|n[ộo]i\s?dung|l[ờo]i\s?nh[ắa]n|(?<![a-zà-ỹ])ref(?![a-zà-ỹ]))\s*[:：]\s*([\s\S]+?)(?=\s*(?:\||\n|\.\s*(?:SD(?![a-zà-ỹ])|s[ốo]\s?d[ưu])|$))/i;

/** Tên người / nơi nhận: dãy chữ viết hoa đầu từ sau "từ / đến / cho / tới" */
const COUNTERPARTY_RE =
  /(?<=^|[\s,.;:|])(?:từ|tu|đến|den|cho|tới)\s+(\p{Lu}\p{L}*(?:\s+\p{Lu}\p{L}*){0,5})(?=[.,;|]|\s+(?:Lời|Loi|ND|nội|noi)(?![\p{L}])|$)/u;

const firstIndex = (re: RegExp, s: string) => {
  const m = re.exec(s);
  return m ? m.index : -1;
};

/** Số dư thật: số có dấu ngăn nghìn hoặc kèm đơn vị tiền (loại "SD TK 0011**1234") — lấy kết quả cuối cùng */
function findBalance(text: string): { amount: number; match: string } | null {
  let found: { amount: number; match: string } | null = null;
  for (const m of text.matchAll(BALANCE_RE)) {
    const looksLikeMoney = !!m[2] || /[.,]\d{3}/.test(m[1]);
    const amount = looksLikeMoney ? parseVnd(m[1]) : null;
    if (amount) found = { amount, match: m[0] };
  }
  return found;
}

/** Gói / người gửi → mã ngân hàng */
export function bankOf(sender: string): string | null {
  if (KNOWN_PACKAGES[sender]) return KNOWN_PACKAGES[sender];
  return detectBank(sender)?.code ?? null;
}

export function parseCapture(raw: RawCapture): ParsedCapture | null {
  const full = `${raw.title}\n${raw.text}`.replace(/ /g, ' ');
  if (!/\d/.test(full)) return null;

  // 1. Tách số dư ra trước để không nhầm với số tiền giao dịch
  const balance = findBalance(full);
  const balanceAfter = balance?.amount ?? null;
  const body = balance ? full.replace(balance.match, ' ') : full;

  // 2. Số tiền + chiều: ưu tiên số có dấu +/−
  let amount: number | null = null;
  let type: ParsedCapture['type'] | null = null;
  const signed = SIGNED_AMOUNT_RE.exec(body);
  if (signed) {
    amount = parseVnd(signed[2]);
    type = signed[1] === '+' ? 'income' : 'expense';
  } else {
    const plain = PLAIN_AMOUNT_RE.exec(body);
    if (plain) amount = parseVnd(plain[1]);
    const inAt = firstIndex(INCOME_RE, body);
    const outAt = firstIndex(EXPENSE_RE, body);
    if (inAt >= 0 && (outAt < 0 || inAt < outAt)) type = 'income';
    else if (outAt >= 0) type = 'expense';
  }
  if (!amount || !type) return null;
  // Tin quảng cáo / mã OTP không có số tiền có dấu → bỏ
  if (!signed && NOISE_RE.test(full)) return null;

  const content = (CONTENT_RE.exec(full)?.[1] ?? '').trim().replace(/\s+/g, ' ');
  const counterparty = COUNTERPARTY_RE.exec(body)?.[1]?.trim() ?? null;
  return { type, amount, balanceAfter, content, counterparty, bankCode: bankOf(raw.sender) };
}

/** Dấu vân tay chống trùng: cùng người gửi + cùng nội dung + cùng phút → một giao dịch */
export function captureFingerprint(
  raw: Pick<RawCapture, 'sender' | 'title' | 'text' | 'postedAt'>,
): string {
  const minute = Math.floor(raw.postedAt / 60_000);
  const s = `${raw.sender}|${raw.title}|${raw.text}|${minute}`;
  // djb2 — đủ cho chống trùng cục bộ
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `cap:${(h >>> 0).toString(36)}:${s.length}`;
}
