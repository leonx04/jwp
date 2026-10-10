// File backup Ivy MẪU (tự tạo, không phải dữ liệu thật) — đúng định dạng Ivy ghi ra:
// các trường có giá trị mặc định bị BỎ QUA (vd ví "Tiền mặt" không có orderNum).
import { zipSync } from 'fflate';

import { vnDateToMs } from '@/lib/date';

/** '2026-09-05 09:00' giờ VN → mili giây */
const vn = (text: string) => {
  const [date, time] = text.split(' ');
  return vnDateToMs(date, time ?? '12:00');
};

export const ivySample = {
  accounts: [
    { name: 'Tiền mặt', currency: 'VND', color: -15414114, icon: 'cash', isSynced: true, id: 'A1' },
    { name: 'Ngân hàng', currency: 'VND', color: -3977985, icon: '', orderNum: 1.0, id: 'A2' },
    {
      name: 'Quỹ du lịch',
      color: -45825,
      icon: 'ic_vue_shop_bag1',
      orderNum: 2.0,
      includeInBalance: false,
      id: 'A3',
    },
    { name: 'Ví đã xoá', color: -1, orderNum: 3.0, isDeleted: true, id: 'A4' },
  ],
  categories: [
    { name: 'Ăn uống', color: -49056, icon: 'fooddrink', id: 'C1' },
    { name: 'Lương', color: -16711936, icon: 'work', orderNum: 1.0, id: 'C2' },
    { name: 'Hoá đơn', color: -256, icon: '', orderNum: 2.0, id: 'C3' },
  ],
  transactions: [
    {
      id: 'T1',
      accountId: 'A2',
      type: 'INCOME',
      amount: 10000000.0,
      title: 'Lương',
      dateTime: vn('2026-09-05 09:00'),
      categoryId: 'C2',
    },
    {
      id: 'T2',
      accountId: 'A1',
      type: 'EXPENSE',
      amount: 35000.0,
      title: 'Cà phê',
      dateTime: vn('2026-09-06 07:30'),
      categoryId: 'C1',
    },
    // 23:30 giờ VN (16:30 UTC) — không được lệch sang ngày khác; không danh mục, không tiêu đề
    {
      id: 'T3',
      accountId: 'A1',
      type: 'EXPENSE',
      amount: 50000.0,
      dateTime: vn('2026-09-06 23:30'),
    },
    {
      id: 'T4',
      accountId: 'A2',
      type: 'TRANSFER',
      amount: 2000000.0,
      toAccountId: 'A1',
      toAmount: 2000000.0,
      title: 'Rút tiền',
      dateTime: vn('2026-09-07 10:00'),
    },
    // Chuyển khoản không có toAmount → bằng amount
    {
      id: 'T5',
      accountId: 'A2',
      type: 'TRANSFER',
      amount: 500000.0,
      toAccountId: 'A3',
      dateTime: vn('2026-09-07 11:00'),
    },
    // Trả kỳ 10/09 của "Tiền nhà" sớm 1 ngày, số tiền khác quy tắc
    {
      id: 'T6',
      accountId: 'A2',
      type: 'EXPENSE',
      amount: 2800000.0,
      title: 'Tiền nhà',
      dateTime: vn('2026-09-09 20:00'),
      categoryId: 'C3',
      recurringRuleId: 'R1',
      paidForDateTime: vn('2026-09-10 12:00'),
    },
    {
      id: 'T7',
      accountId: 'A1',
      type: 'EXPENSE',
      amount: 999.0,
      dateTime: vn('2026-09-08 08:00'),
      isDeleted: true,
    },
    // Các khoản "sắp tới" Ivy sinh sẵn (dateTime null)
    {
      id: 'T8a',
      accountId: 'A2',
      type: 'EXPENSE',
      amount: 3000000.0,
      title: 'Tiền nhà',
      categoryId: 'C3',
      dueDate: vn('2026-10-10 12:00'),
      recurringRuleId: 'R1',
    },
    {
      id: 'T8b',
      accountId: 'A2',
      type: 'EXPENSE',
      amount: 3000000.0,
      title: 'Tiền nhà',
      categoryId: 'C3',
      dueDate: vn('2026-11-10 12:00'),
      recurringRuleId: 'R1',
    },
    {
      id: 'T8c',
      accountId: 'A2',
      type: 'EXPENSE',
      amount: 3000000.0,
      title: 'Tiền nhà',
      categoryId: 'C3',
      dueDate: vn('2026-12-10 12:00'),
      recurringRuleId: 'R1',
    },
    // Khoản một lần bị dời từ 18/09 sang 22/10
    {
      id: 'T9',
      accountId: 'A1',
      type: 'EXPENSE',
      amount: 1000000.0,
      title: 'Trả nợ',
      dueDate: vn('2026-10-22 12:00'),
      recurringRuleId: 'R2',
    },
    // Trỏ tới quy tắc đã bị xoá
    {
      id: 'T10',
      accountId: 'A1',
      type: 'EXPENSE',
      amount: 120000.0,
      title: 'Ăn tối',
      dateTime: vn('2026-09-12 19:00'),
      categoryId: 'C1',
      recurringRuleId: 'R-deleted',
    },
    {
      id: 'T11',
      accountId: 'A1',
      type: 'EXPENSE',
      amount: 10000.0,
      title: 'Phở',
      dateTime: vn('2026-09-13 07:00'),
      categoryId: 'C1',
    },
    // Chuyển khoản tới ví không tồn tại → thành khoản chi
    {
      id: 'T12',
      accountId: 'A1',
      type: 'TRANSFER',
      amount: 70000.0,
      toAccountId: 'MISSING',
      dateTime: vn('2026-09-14 09:00'),
    },
    // Khoản vay: tiền ra khi cho vay, tiền vào khi được trả
    {
      id: 'T13',
      accountId: 'A1',
      type: 'EXPENSE',
      amount: 500000.0,
      title: 'Cho anh Nam vay',
      dateTime: vn('2026-09-01 08:00'),
      loanId: 'L1',
    },
    {
      id: 'T14',
      accountId: 'A1',
      type: 'INCOME',
      amount: 200000.0,
      title: 'Anh Nam trả',
      dateTime: vn('2026-09-15 08:00'),
      loanId: 'L1',
      loanRecordId: 'LR1',
    },
  ],
  plannedPaymentRules: [
    {
      id: 'R1',
      startDate: vn('2026-08-10 12:00'),
      intervalN: 1,
      intervalType: 'MONTH',
      type: 'EXPENSE',
      accountId: 'A2',
      amount: 3000000.0,
      categoryId: 'C3',
      title: 'Tiền nhà',
    },
    {
      id: 'R2',
      startDate: vn('2026-09-18 12:00'),
      intervalN: 1,
      intervalType: 'MONTH',
      oneTime: true,
      type: 'EXPENSE',
      accountId: 'A1',
      amount: 1000000.0,
      title: 'Trả nợ',
    },
    {
      id: 'R3',
      startDate: vn('2026-09-20 12:00'),
      intervalN: 1,
      intervalType: 'MONTH',
      oneTime: true,
      type: 'EXPENSE',
      accountId: 'A1',
      amount: 280000.0,
    },
  ],
  settings: [{ theme: 'DARK', currency: 'VND', bufferAmount: 4000000.0, name: 'Test', id: 'S1' }],
  sharedPrefs: {
    transfers_as_inc_exp: 'true',
    show_notifications: 'true',
    hide_current_balance: 'false',
    lock_app: 'false',
  },
  tags: [
    { id: 'G1', name: 'Du lịch', color: -1, orderNum: 0.0 },
    { id: 'G2', name: 'du lich', color: -1, orderNum: 1.0 },
  ],
  tagAssociations: [
    { tagId: 'G1', associatedId: 'T11' },
    { tagId: 'G2', associatedId: 'T11' },
    { tagId: 'G1', associatedId: 'T7' },
    { tagId: 'G1', associatedId: 'NOPE' },
  ],
  loans: [
    {
      id: 'L1',
      name: 'Anh Nam',
      amount: 500000.0,
      type: 'LEND',
      accountId: 'A1',
      dateTime: vn('2026-09-01 08:00'),
    },
    { id: 'L2', name: 'anh nam', amount: 300000.0, type: 'BORROW' },
  ],
  loanRecords: [
    {
      id: 'LR1',
      loanId: 'L1',
      amount: 200000.0,
      dateTime: vn('2026-09-15 08:00'),
      accountId: 'A1',
    },
    {
      id: 'LR2',
      loanId: 'L1',
      amount: 100000.0,
      dateTime: vn('2026-09-20 08:00'),
      loanRecordType: 'INCREASE',
    },
    { id: 'LR3', loanId: 'L1', amount: 10000.0, dateTime: vn('2026-09-25 08:00'), interest: true },
  ],
  budgets: [
    {
      id: 'B1',
      name: 'Ăn uống',
      amount: 2000000.0,
      categoryIdsSerialized: 'C1,unknown',
      orderId: 0.0,
    },
  ],
};

/** Giá trị mong đợi — tính tay từ dữ liệu trên */
export const ivySampleExpected = {
  balances: { A1: 1_415_000, A2: 4_700_000, A3: 500_000 },
  /** A3 không tính vào tổng */
  total: 6_115_000,
};

/** Mã hoá giống file Ivy thật: UTF-16 Big-Endian có BOM */
export function encodeUtf16be(text: string): Uint8Array {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xfe;
  bytes[1] = 0xff;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    bytes[2 + i * 2] = unit >> 8;
    bytes[3 + i * 2] = unit & 0xff;
  }
  return bytes;
}

export const ivySampleBytes = () => encodeUtf16be(JSON.stringify(ivySample));

export const ivySampleZip = () => zipSync({ 'data9058811165702004018.json': ivySampleBytes() });
