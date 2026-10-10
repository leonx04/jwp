// Đọc số tiền người dùng gõ / dán: '1.500.000', '1,500,000', '1.5tr', '150k', '2 tỷ', '1tr5'...
import { removeDiacritics } from '@/lib/text';

import { MAX_AMOUNT, type Money } from './constants';

// Đơn vị viết tắt (đã bỏ dấu). Thứ tự dài trước ngắn để regex dễ đọc.
const UNIT_MULTIPLIER: Record<string, number> = {
  nghin: 1_000,
  ngan: 1_000,
  ng: 1_000,
  k: 1_000,
  n: 1_000,
  trieu: 1_000_000,
  tr: 1_000_000,
  m: 1_000_000,
  ty: 1_000_000_000,
  ti: 1_000_000_000,
  b: 1_000_000_000,
};

const AMOUNT_PATTERN = new RegExp(
  `^(\\d[\\d.,]*)(${Object.keys(UNIT_MULTIPLIER).join('|')})?(\\d*)$`,
);

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}

/** '1.500.000' với sep='.' → hợp lệ nếu nhóm đầu 1–3 chữ số, các nhóm sau đúng 3 chữ số */
function isGrouped(text: string, sep: string): boolean {
  const [first, ...rest] = text.split(sep);
  return /^\d{1,3}$/.test(first) && rest.every((group) => /^\d{3}$/.test(group));
}

/** Đọc phần số (chưa nhân đơn vị). Trả về null nếu không hợp lệ. */
function parseNumber(text: string, hasUnit: boolean): number | null {
  const dots = count(text, '.');
  const commas = count(text, ',');
  if (dots === 0 && commas === 0) return Number(text);

  // Có cả hai loại dấu: dấu xuất hiện sau cùng là dấu thập phân ('1.500.000,50' hoặc '1,500,000.50')
  if (dots > 0 && commas > 0) {
    const decimalSep = text.lastIndexOf('.') > text.lastIndexOf(',') ? '.' : ',';
    const groupSep = decimalSep === '.' ? ',' : '.';
    if (count(text, decimalSep) > 1) return null;
    const [intPart, fracPart] = text.split(decimalSep);
    if (!fracPart || !isGrouped(intPart, groupSep)) return null;
    return Number(`${intPart.split(groupSep).join('')}.${fracPart}`);
  }

  const sep = dots > 0 ? '.' : ',';
  const parts = text.split(sep);
  // Nhiều dấu cùng loại → chắc chắn là dấu ngăn nghìn
  if (parts.length > 2) return isGrouped(text, sep) ? Number(parts.join('')) : null;

  const [intPart, after] = parts;
  if (!intPart || !after) return null;
  // Một dấu + đúng 3 chữ số + không có đơn vị → ngăn nghìn ('1.500'); còn lại là thập phân ('1,5tr', '1.5')
  if (!hasUnit && after.length === 3) return Number(intPart + after);
  return Number(`${intPart}.${after}`);
}

/**
 * Trả về số đồng (số nguyên), hoặc null nếu không đọc được / vượt giới hạn.
 * Hỗ trợ dấu âm ở đầu ('-' hoặc '−'), ký hiệu ₫ / đ / VND / đồng ở cuối.
 */
export function parseMoney(input: string): Money | null {
  let text = removeDiacritics(input)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/₫|vnd|dong/g, '')
    .replace(/(\d)d$/, '$1'); // '50.000đ' (đ đã thành d khi bỏ dấu)

  let negative = false;
  if (/^[-−+]/.test(text)) {
    negative = text[0] !== '+';
    text = text.slice(1);
  }

  const match = AMOUNT_PATTERN.exec(text);
  if (!match) return null;
  const [, numberPart, unit, tail] = match;

  let value: number | null;
  if (tail) {
    // '1tr5' = 1,5 triệu · '1tr250' = 1,25 triệu — không cho kết hợp với dấu ('1.5tr5')
    if (/[.,]/.test(numberPart)) return null;
    value = Number(`${numberPart}.${tail}`);
  } else {
    value = parseNumber(numberPart, Boolean(unit));
  }
  if (value === null || !Number.isFinite(value)) return null;

  const amount = Math.round(value * (unit ? UNIT_MULTIPLIER[unit] : 1));
  if (amount > MAX_AMOUNT) return null;
  return negative && amount !== 0 ? -amount : amount;
}
