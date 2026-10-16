// Hỏi app bằng tiếng Việt: "tháng này ăn uống hết bao nhiêu?", "cafe tháng trước mấy lần?", "số dư momo".
// Không dùng AI đám mây: đọc ý định bằng luật + từ khoá, rồi tra dữ liệu có sẵn. Hàm thuần — test được.
import { addDays, diffDays, parseDate, startOfWeek, type Period } from '@/lib/date';
import { removeDiacritics } from '@/lib/text';

import { previousPeriod, statsPeriod } from '../stats/periods';

export type AskPeriod = Period & {
  /** Khoá nhãn để dịch: "hôm nay", "tháng này"… */
  label: string;
  params?: Record<string, string | number>;
  kind: 'day' | 'week' | 'month' | 'year' | 'range';
};

export type Question =
  | { kind: 'total'; flow: 'expense' | 'income'; period: AskPeriod; terms: string[]; compare: boolean }
  | { kind: 'count'; flow: 'expense' | 'income'; period: AskPeriod; terms: string[] }
  | { kind: 'top_category'; flow: 'expense' | 'income'; period: AskPeriod }
  | { kind: 'biggest'; period: AskPeriod; terms: string[] }
  | { kind: 'balance'; terms: string[] }
  | { kind: 'budget'; terms: string[] }
  | { kind: 'unknown' };

const plainWords = (text: string): string[] =>
  removeDiacritics(text.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

function hasPhrase(words: string[], phrase: string): boolean {
  return findPhrase(words, phrase) >= 0;
}

function findPhrase(words: string[], phrase: string): number {
  const p = phrase.split(' ');
  for (let i = 0; i + p.length <= words.length; i++) {
    if (p.every((w, k) => words[i + k] === w)) return i;
  }
  return -1;
}

function removePhrase(words: string[], phrase: string): string[] {
  const at = findPhrase(words, phrase);
  if (at < 0) return words;
  return [...words.slice(0, at), ...words.slice(at + phrase.split(' ').length)];
}

/** Từ không mang nội dung tìm kiếm */
const STOP = new Set(
  (
    'toi minh em anh chi la cua cho vao o tai da dang se co khong ko nhung cac mot nhu the nao gi vay a ' +
    'bao nhieu may tong tat ca het tieu xai chi mat tra thu nhan kiem duoc luong khoan giao dich lan ' +
    'so voi sanh hon it nhat lon cao nhieu thang tuan nam ngay nay truoc roi ngoai qua hom danh muc ' +
    'ngan sach du con tien app oi nhe di thi ma va hay vua moi gan day cung'
  ).split(' '),
);

const INCOME_WORDS = ['thu', 'nhan', 'kiem', 'luong', 'thu nhap', 'duoc nhan'];

function resolvePeriod(words: string[], today: string, startDay: number): { period: AskPeriod; rest: string[] } {
  const month = (offset: number, label: string, params?: AskPeriod['params']): AskPeriod => ({
    ...statsPeriod('month', offset, today, startDay),
    label,
    params,
    kind: 'month',
  });
  const week = (back: number, label: string): AskPeriod => {
    const s = addDays(startOfWeek(today), -7 * back);
    return { start: s, end: addDays(s, 6), label, kind: 'week' };
  };
  const year = (offset: number, label: string): AskPeriod => ({
    ...statsPeriod('year', offset, today, startDay),
    label,
    kind: 'year',
  });
  const day = (offset: number, label: string): AskPeriod => {
    const d = addDays(today, offset);
    return { start: d, end: d, label, kind: 'day' };
  };

  // Cụm xuất hiện SỚM nhất thắng ("tháng này so với tháng trước" → tháng này)
  const fixed: [string, () => AskPeriod][] = [
    ['hom nay', () => day(0, 'hôm nay')],
    ['hom qua', () => day(-1, 'hôm qua')],
    ['tuan truoc', () => week(1, 'tuần trước')],
    ['tuan roi', () => week(1, 'tuần trước')],
    ['tuan qua', () => week(1, 'tuần trước')],
    ['tuan nay', () => week(0, 'tuần này')],
    ['thang truoc', () => month(-1, 'tháng trước')],
    ['thang roi', () => month(-1, 'tháng trước')],
    ['thang qua', () => month(-1, 'tháng trước')],
    ['thang nay', () => month(0, 'tháng này')],
    ['nam ngoai', () => year(-1, 'năm ngoái')],
    ['nam truoc', () => year(-1, 'năm ngoái')],
    ['nam roi', () => year(-1, 'năm ngoái')],
    ['nam nay', () => year(0, 'năm nay')],
  ];
  for (let i = 0; i < words.length; i++) {
    for (const [phrase, make] of fixed) {
      const n = phrase.split(' ').length;
      if (phrase.split(' ').every((w, k) => words[i + k] === w)) {
        return { period: make(), rest: [...words.slice(0, i), ...words.slice(i + n)] };
      }
    }
    // "30 ngày qua"
    if (/^\d+$/.test(words[i]) && words[i + 1] === 'ngay') {
      const n = Math.min(365, Math.max(1, Number(words[i])));
      const rest = [...words.slice(0, i), ...words.slice(i + 2)].filter(
        (w) => w !== 'qua' && w !== 'gan' && w !== 'day',
      );
      return {
        period: { start: addDays(today, -(n - 1)), end: today, label: '{n} ngày qua', params: { n }, kind: 'range' },
        rest,
      };
    }
    // "tháng 9"
    if (words[i] === 'thang' && /^(1[0-2]|[1-9])$/.test(words[i + 1] ?? '')) {
      const n = Number(words[i + 1]);
      const cur = parseDate(statsPeriod('month', 0, today, startDay).start).month;
      let offset = n - cur;
      if (offset > 0) offset -= 12;
      return {
        period: month(offset, 'tháng {n}', { n }),
        rest: [...words.slice(0, i), ...words.slice(i + 2)],
      };
    }
  }
  return { period: month(0, 'tháng này'), rest: words };
}

/** Kỳ ngay trước (cùng độ dài) để so sánh */
export function previousAskPeriod(p: AskPeriod, startDay: number): AskPeriod {
  if (p.kind === 'month') {
    return { ...previousPeriod('month', p, startDay), label: 'kỳ trước', kind: 'month' };
  }
  if (p.kind === 'year') {
    return { ...previousPeriod('year', p, startDay), label: 'kỳ trước', kind: 'year' };
  }
  const len = diffDays(p.start, p.end) + 1;
  return { start: addDays(p.start, -len), end: addDays(p.start, -1), label: 'kỳ trước', kind: p.kind };
}

export function parseQuestion(text: string, today: string, startDay = 1): Question {
  let words = plainWords(text);
  if (!words.length) return { kind: 'unknown' };

  const { period, rest } = resolvePeriod(words, today, startDay);
  words = rest;
  const terms = () => words.filter((w) => !STOP.has(w));
  const flow: 'expense' | 'income' = INCOME_WORDS.some((w) => hasPhrase(words, w)) && !hasPhrase(words, 'chi')
    ? 'income'
    : 'expense';
  const any = (...phrases: string[]) => phrases.some((p) => hasPhrase(words, p));

  if (any('ngan sach')) return { kind: 'budget', terms: terms() };

  if (any('so du', 'tong tai san', 'dang co bao nhieu', 'con bao nhieu tien', 'con tien khong')) {
    return { kind: 'balance', terms: terms() };
  }

  if (any('bao nhieu lan', 'may lan', 'bao nhieu giao dich', 'so lan', 'bao nhieu khoan')) {
    return { kind: 'count', flow, period, terms: terms() };
  }

  if (any('vao dau', 'danh muc', 'cho gi', 'nhom nao', 'khoan nao') && any('nhieu nhat', 'lon nhat', 'cao nhat')) {
    return { kind: 'top_category', flow, period };
  }
  if (any('nhieu nhat', 'lon nhat', 'cao nhat', 'dat nhat') && any('khoan', 'giao dich', 'mon', 'lan')) {
    return { kind: 'biggest', period, terms: terms() };
  }

  const compare = any('so voi', 'so sanh', 'hon', 'it hon', 'tang', 'giam');
  const flowWord = any('tieu', 'chi', 'xai', 'het', 'mat', 'tra', 'thu', 'nhan', 'kiem', 'luong', 'thu nhap');
  if (flowWord || compare || any('bao nhieu', 'tong')) {
    return { kind: 'total', flow, period, terms: terms(), compare };
  }
  return { kind: 'unknown' };
}
