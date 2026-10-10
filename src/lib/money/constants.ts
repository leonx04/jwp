/** Số tiền luôn là số nguyên, đơn vị đồng. Không bao giờ dùng số thực cho tiền. */
export type Money = number;

/** Giới hạn nhập: 999.999.999.999 ₫ (dưới 1.000 tỷ) — vẫn an toàn với số nguyên của JS. */
export const MAX_AMOUNT: Money = 999_999_999_999;

/** Khoảng trắng không ngắt dòng: giữ "1.500.000 ₫" luôn trên một dòng. */
export const NBSP = ' ';

/** Dấu trừ chuẩn (−), không phải gạch nối (-). */
export const MINUS = '−';

export type CurrencySymbol = '₫' | 'đ' | 'VND';
export const CURRENCY_SYMBOLS: readonly CurrencySymbol[] = ['₫', 'đ', 'VND'];

/** Chi / thu / chuyển — quyết định dấu và màu khi hiển thị. */
export type MoneyFlow = 'expense' | 'income' | 'transfer';
