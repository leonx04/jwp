// Xuất giao dịch ra CSV chuẩn (RFC 4180): mở được bằng Excel / Google Sheets, giữ tiếng Việt (BOM UTF-8).
import type { BackupData } from './jwp/format';

const BOM = '﻿';
const VN_OFFSET_MS = 7 * 3600 * 1000;

export const CSV_HEADER = [
  'Ngày',
  'Giờ',
  'Loại',
  'Số tiền',
  'Ví',
  'Ví nhận',
  'Danh mục',
  'Tiêu đề',
  'Ghi chú',
] as const;

const TYPE_LABEL = { income: 'Thu', expense: 'Chi', transfer: 'Chuyển khoản' } as const;

/** Bao ô trong ngoặc kép khi có dấu phẩy, xuống dòng hoặc ngoặc kép */
export function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  // Chống "CSV injection": ô bắt đầu bằng = + - @ bị Excel hiểu là công thức (số âm thì giữ nguyên)
  const safe =
    /^[=+@]/.test(text) || (/^-/.test(text) && Number.isNaN(Number(text))) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** ms → ['2026-10-12', '18:14'] theo giờ Việt Nam */
export function vnDateTime(ms: number): [string, string] {
  const iso = new Date(ms + VN_OFFSET_MS).toISOString();
  return [iso.slice(0, 10), iso.slice(11, 16)];
}

export function transactionsToCsv(
  data: Pick<BackupData, 'transactions' | 'accounts' | 'categories'>,
): string {
  const account = new Map(data.accounts.map((a) => [a.id, a.name]));
  const category = new Map(data.categories.map((c) => [c.id, c.name]));
  const rows = [...data.transactions]
    .sort((a, b) => a.date - b.date)
    .map((t) => {
      const [date, time] = vnDateTime(t.date);
      return [
        date,
        time,
        t.isAdjustment ? 'Điều chỉnh số dư' : TYPE_LABEL[t.type],
        t.amount,
        account.get(t.accountId) ?? '',
        t.toAccountId ? (account.get(t.toAccountId) ?? '') : '',
        t.categoryId ? (category.get(t.categoryId) ?? '') : '',
        t.title,
        t.note ?? '',
      ];
    });
  return (
    BOM +
    [CSV_HEADER as readonly string[], ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') +
    '\r\n'
  );
}
