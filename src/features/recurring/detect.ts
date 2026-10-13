// Phát hiện khoản lặp hằng tháng trong lịch sử (tiền nhà, đăng ký, lương…) để gợi ý tạo lịch nhắc.
// Hàm thuần. Chặt có chủ đích: thà bỏ sót còn hơn gợi ý nhầm thói quen hằng ngày như "ăn sáng", "đổ xăng".
import { addMonths, daysInMonth, makeDate, parseDate, toVnDate, type DateString } from '@/lib/date';
import { normalizeForSearch } from '@/lib/text';

export type RecurringTx = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  /** ms */
  date: number;
  title: string;
  categoryId: string | null;
  accountId: string;
};

export type ExistingSchedule = {
  title: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  startDate: DateString;
  monthDay: number | null;
};

export type RecurringSuggestion = {
  /** Khoá ổn định (dùng để ẩn gợi ý đã bỏ qua) */
  key: string;
  title: string;
  type: 'income' | 'expense';
  /** Số tiền trung vị các lần gần đây */
  amount: number;
  /** Số tiền dao động > 2% → coi là ước tính */
  isEstimate: boolean;
  /** Ngày trong tháng thường gặp (trung vị) */
  monthDay: number;
  occurrences: number;
  lastDate: DateString;
  /** Kỳ kế tiếp dự kiến (≥ hôm nay) */
  nextDate: DateString;
  accountId: string;
  categoryId: string | null;
  /** 0..1 */
  confidence: number;
};

/** Số lần xuất hiện (ở các tháng khác nhau) tối thiểu để tính là lặp */
export const MIN_OCCURRENCES = 3;
/** Lệch ngày tối đa so với ngày trung vị */
const MAX_DAY_SPREAD = 4;
/** Chênh lệch giữa số tiền lớn nhất và nhỏ nhất so với trung vị */
const MAX_AMOUNT_SPREAD = 0.5;
/** Lần cuối xuất hiện quá ngần này ngày thì coi như đã dừng */
const STALE_DAYS = 50;
/** Số lần gần nhất dùng để xét */
const WINDOW = 6;

const median = (values: readonly number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/** "Nhận lương tháng 5" và "Lương Tháng 7" cùng một khoá: bỏ số và cụm "tháng N" */
export function titleKey(title: string): string {
  return normalizeForSearch(title)
    .replace(/\bthang\s*\d+\b/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\b(nhan|tra|t)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const monthIndex = (date: DateString) => {
  const { year, month } = parseDate(date);
  return year * 12 + (month - 1);
};

const mostCommon = <T>(values: readonly T[]): T | null => {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
};

/** Ngày `day` của tháng chứa `date` (ngày > số ngày của tháng → ngày cuối tháng) */
function dayInMonthOf(date: DateString, day: number): DateString {
  const { year, month } = parseDate(date);
  return makeDate(year, month, Math.min(day, daysInMonth(year, month)));
}

function nextOccurrence(lastDate: DateString, monthDay: number, today: DateString): DateString {
  let next = dayInMonthOf(addMonths(makeDateStart(lastDate), 1), monthDay);
  while (next < today) next = dayInMonthOf(addMonths(makeDateStart(next), 1), monthDay);
  return next;
}

/** Ngày mùng 1 của tháng chứa `date` (để cộng tháng không bị lệch khi ngày > 28) */
function makeDateStart(date: DateString): DateString {
  const { year, month } = parseDate(date);
  return makeDate(year, month, 1);
}

export function detectRecurring(args: {
  txs: readonly RecurringTx[];
  existing: readonly ExistingSchedule[];
  dismissed?: ReadonlySet<string>;
  today: DateString;
}): RecurringSuggestion[] {
  const { today } = args;
  const dismissed = args.dismissed ?? new Set<string>();

  // 1. Gom theo tên (bỏ số / "tháng N"); giao dịch không tiêu đề gom theo danh mục + số tiền đúng bằng nhau
  const groups = new Map<string, { label: string; items: RecurringTx[] }>();
  for (const tx of args.txs) {
    const tk = titleKey(tx.title);
    const key =
      tk.length >= 3
        ? `${tx.type}:t:${tk}`
        : tx.categoryId
          ? `${tx.type}:c:${tx.categoryId}:${tx.amount}`
          : null;
    if (!key) continue;
    const g = groups.get(key) ?? { label: tx.title.trim(), items: [] };
    g.items.push(tx);
    groups.set(key, g);
  }

  const existingKeys = new Set(args.existing.map((s) => titleKey(s.title)).filter(Boolean));
  const out: RecurringSuggestion[] = [];

  for (const [key, g] of groups) {
    if (dismissed.has(key)) continue;

    // 2. Mỗi ngày một lần, sắp theo thời gian
    const byDay = new Map<DateString, RecurringTx>();
    for (const tx of [...g.items].sort((a, b) => a.date - b.date)) {
      const day = toVnDate(tx.date);
      if (!byDay.has(day)) byDay.set(day, tx);
    }
    const days = [...byDay.keys()].sort();
    const recent = days.slice(-WINDOW);
    const months = recent.map(monthIndex);
    const distinctMonths = new Set(months).size;
    if (distinctMonths < MIN_OCCURRENCES) continue;
    // Mỗi tháng ~1 lần: nếu nhiều hơn hẳn thì là thói quen hằng ngày / hằng tuần
    if (recent.length > distinctMonths * 1.3) continue;

    // 3. Các tháng phải liền nhau (cho phép lỡ tối đa một tháng giữa hai lần)
    const uniq = [...new Set(months)].sort((a, b) => a - b);
    let gapsOk = true;
    let missed = 0;
    for (let i = 1; i < uniq.length; i++) {
      const gap = uniq[i] - uniq[i - 1];
      if (gap > 2) gapsOk = false;
      if (gap === 2) missed++;
    }
    if (!gapsOk || missed > 1) continue;

    // 4. Còn đang diễn ra
    const lastDate = days[days.length - 1];
    const sinceLast = (Date.parse(today) - Date.parse(lastDate)) / 86_400_000;
    if (sinceLast > STALE_DAYS) continue;

    // 5. Ngày trong tháng ổn định
    const dayNums = recent.map((d) => parseDate(d).day);
    const monthDay = median(dayNums);
    const spread = Math.max(...dayNums.map((d) => Math.abs(d - monthDay)));
    if (spread > MAX_DAY_SPREAD) continue;

    // 6. Số tiền ổn định
    const amounts = recent.map((d) => byDay.get(d)!.amount);
    const amount = median(amounts);
    const amountSpread = (Math.max(...amounts) - Math.min(...amounts)) / amount;
    if (amountSpread > MAX_AMOUNT_SPREAD) continue;

    // 7. Đã có lịch tương ứng thì thôi
    const tk = titleKey(g.label);
    const first = byDay.get(recent[0])!;
    const covered =
      (tk && existingKeys.has(tk)) ||
      args.existing.some(
        (s) =>
          s.type === first.type &&
          Math.abs(s.amount - amount) <= amount * 0.05 &&
          Math.abs(
            (s.monthDay && s.monthDay > 0 ? s.monthDay : parseDate(s.startDate).day) - monthDay,
          ) <= 3,
      );
    if (covered) continue;

    const latest = byDay.get(lastDate)!;
    const confidence = Math.min(
      1,
      0.4 +
        0.1 * Math.min(distinctMonths, 5) +
        (1 - amountSpread) * 0.05 +
        (1 - spread / (MAX_DAY_SPREAD + 1)) * 0.05,
    );
    out.push({
      key,
      title: g.label || latest.title.trim() || 'Khoản lặp hằng tháng',
      type: first.type,
      amount,
      isEstimate: amountSpread > 0.02,
      monthDay,
      occurrences: distinctMonths,
      lastDate,
      nextDate: nextOccurrence(lastDate, monthDay, today),
      accountId: mostCommon(recent.map((d) => byDay.get(d)!.accountId)) ?? latest.accountId,
      categoryId: mostCommon(recent.map((d) => byDay.get(d)!.categoryId)),
      confidence,
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence || b.amount - a.amount);
}
