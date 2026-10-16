// Tìm kiếm tiếng Việt chính xác:
//  • Gõ KHÔNG dấu ("ca phe")  → khớp mọi biến thể dấu (cà phê, cá phê…).
//  • Gõ CÓ dấu ("cà phê")     → khớp ĐÚNG dấu, không lẫn "cá", "cả"…
//  • Mỗi từ trong ô tìm phải khớp ĐẦU một từ của văn bản ("ca" ra "ca phê", không ra "thanh toán").
// Nhiều từ = phải khớp tất cả (không cần đứng cạnh nhau).
import { removeDiacritics } from './normalize';

const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

const fold = (text: string): string => text.normalize('NFC').toLowerCase();

const wordsOf = (text: string): string[] => fold(text).split(WORD_SPLIT).filter(Boolean);

/** Từ gõ có chứa dấu (hoặc đ) không? */
const hasMarks = (token: string): boolean => removeDiacritics(token) !== token;

export type SearchQuery = { token: string; plain: string; exact: boolean }[];

export function parseSearchQuery(query: string): SearchQuery {
  return wordsOf(query).map((token) => ({
    token,
    plain: removeDiacritics(token),
    exact: hasMarks(token),
  }));
}

/** Văn bản (ghép từ nhiều trường) có khớp ô tìm không. Ô tìm rỗng → khớp tất cả. */
export function matchesSearch(
  query: SearchQuery | string,
  ...fields: (string | null | undefined)[]
): boolean {
  const parsed = typeof query === 'string' ? parseSearchQuery(query) : query;
  if (!parsed.length) return true;
  const words = fields.flatMap((field) => (field ? wordsOf(field) : []));
  if (!words.length) return false;
  const plainWords = words.map((w) => removeDiacritics(w));
  return parsed.every(({ token, plain, exact }) =>
    exact ? words.some((w) => w.startsWith(token)) : plainWords.some((w) => w.startsWith(plain)),
  );
}
