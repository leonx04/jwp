// Ngân hàng & ví điện tử Việt Nam: logo, màu thương hiệu, từ khoá nhận diện từ tên ví.
// Lưu trong DB dưới dạng icon = 'bank:<CODE>' (vd 'bank:MB').
import { normalizeForSearch } from '@/lib/text';

import { BANK_LOGOS } from './logos';

export type Bank = {
  code: string;
  name: string;
  /** Từ khoá đã bỏ dấu, chữ thường */
  keywords: string[];
  /** Màu thương hiệu (dùng cho huy hiệu chữ khi không có logo) */
  color: string;
  /** Chữ viết tắt cho huy hiệu khi không có logo */
  monogram?: string;
  kind: 'bank' | 'wallet';
};

export const BANKS: readonly Bank[] = [
  { code: 'VCB', name: 'Vietcombank', keywords: ['vietcombank', 'vcb'], color: '#007B40', kind: 'bank' },
  { code: 'ICB', name: 'VietinBank', keywords: ['vietinbank', 'vietin', 'ctg'], color: '#0A4C9E', kind: 'bank' },
  { code: 'BIDV', name: 'BIDV', keywords: ['bidv'], color: '#1F5BA8', kind: 'bank' },
  { code: 'VBA', name: 'Agribank', keywords: ['agribank', 'agri'], color: '#A3203A', kind: 'bank' },
  { code: 'MB', name: 'MB Bank', keywords: ['mb bank', 'mbbank', 'mb', 'quan doi'], color: '#1E3A8A', kind: 'bank' },
  { code: 'TCB', name: 'Techcombank', keywords: ['techcombank', 'techcom', 'tcb'], color: '#E30613', kind: 'bank' },
  { code: 'ACB', name: 'ACB', keywords: ['acb', 'a chau'], color: '#1C4DA1', kind: 'bank' },
  { code: 'VPB', name: 'VPBank', keywords: ['vpbank', 'vp bank', 'vpb'], color: '#00954B', kind: 'bank' },
  { code: 'TPB', name: 'TPBank', keywords: ['tpbank', 'tp bank', 'tpb', 'tien phong'], color: '#5B2C83', kind: 'bank' },
  { code: 'STB', name: 'Sacombank', keywords: ['sacombank', 'sacom', 'stb'], color: '#0A5AA6', kind: 'bank' },
  { code: 'HDB', name: 'HDBank', keywords: ['hdbank', 'hd bank'], color: '#E31E24', kind: 'bank' },
  { code: 'VIB', name: 'VIB', keywords: ['vib'], color: '#00599C', kind: 'bank' },
  { code: 'SHB', name: 'SHB', keywords: ['shb'], color: '#F58220', kind: 'bank' },
  { code: 'EIB', name: 'Eximbank', keywords: ['eximbank', 'exim'], color: '#0060A9', kind: 'bank' },
  { code: 'MSB', name: 'MSB', keywords: ['msb', 'maritime'], color: '#E5202E', kind: 'bank' },
  { code: 'OCB', name: 'OCB', keywords: ['ocb', 'phuong dong'], color: '#009245', kind: 'bank' },
  { code: 'SEAB', name: 'SeABank', keywords: ['seabank', 'sea bank'], color: '#D9232E', kind: 'bank' },
  { code: 'LPB', name: 'LPBank', keywords: ['lpbank', 'lienviet', 'lien viet', 'lpb'], color: '#F68B1F', kind: 'bank' },
  { code: 'NAB', name: 'Nam A Bank', keywords: ['nam a', 'namabank', 'nam a bank'], color: '#00573F', kind: 'bank' },
  { code: 'BAB', name: 'Bac A Bank', keywords: ['bac a', 'bacabank', 'bac a bank'], color: '#C4161C', kind: 'bank' },
  { code: 'VCCB', name: 'BVBank', keywords: ['bvbank', 'ban viet', 'vietcapital'], color: '#0A3E86', kind: 'bank' },
  { code: 'SCB', name: 'SCB', keywords: ['scb'], color: '#003D79', kind: 'bank' },
  { code: 'ABB', name: 'ABBANK', keywords: ['abbank', 'an binh'], color: '#0A6A3E', kind: 'bank' },
  { code: 'PVCB', name: 'PVcomBank', keywords: ['pvcombank', 'pvcom'], color: '#00539F', kind: 'bank' },
  { code: 'NCB', name: 'NCB', keywords: ['ncb', 'quoc dan'], color: '#004A8F', kind: 'bank' },
  { code: 'KLB', name: 'KienLongBank', keywords: ['kienlongbank', 'kienlong', 'kien long'], color: '#0F4C81', kind: 'bank' },
  { code: 'VIETBANK', name: 'VietBank', keywords: ['vietbank'], color: '#00519E', kind: 'bank' },
  { code: 'BVB', name: 'BaoViet Bank', keywords: ['baoviet', 'bao viet'], color: '#0A4DA2', kind: 'bank' },
  { code: 'CAKE', name: 'Cake', keywords: ['cake'], color: '#EF4D8A', kind: 'bank' },
  { code: 'TIMO', name: 'Timo', keywords: ['timo'], color: '#5E2B97', kind: 'bank' },
  { code: 'UBANK', name: 'Ubank', keywords: ['ubank'], color: '#00A859', kind: 'bank' },
  { code: 'VIKKI', name: 'Vikki', keywords: ['vikki'], color: '#2B2E83', kind: 'bank' },
  { code: 'SHBVN', name: 'Shinhan Bank', keywords: ['shinhan'], color: '#0046FF', kind: 'bank' },
  { code: 'HSBC', name: 'HSBC', keywords: ['hsbc'], color: '#DB0011', kind: 'bank' },
  { code: 'SCVN', name: 'Standard Chartered', keywords: ['standard chartered', 'standardchartered'], color: '#0473EA', kind: 'bank' },
  { code: 'UOB', name: 'UOB', keywords: ['uob'], color: '#0B3B8C', kind: 'bank' },
  { code: 'WVN', name: 'Woori', keywords: ['woori'], color: '#0067AC', kind: 'bank' },
  { code: 'MOMO', name: 'MoMo', keywords: ['momo', 'mo mo'], color: '#A50064', monogram: 'MoMo', kind: 'wallet' },
  { code: 'ZALOPAY', name: 'ZaloPay', keywords: ['zalopay', 'zalo pay', 'zalo'], color: '#0068FF', monogram: 'Zalo', kind: 'wallet' },
  { code: 'SHOPEEPAY', name: 'ShopeePay', keywords: ['shopeepay', 'shopee pay', 'shopee', 'shoppe', 'spay', 'spaylater'], color: '#EE4D2D', monogram: 'S', kind: 'wallet' },
  { code: 'VIETTELMONEY', name: 'Viettel Money', keywords: ['viettel money', 'viettelmoney', 'viettel pay', 'viettelpay'], color: '#E60A32', kind: 'wallet' },
  { code: 'VNPTMONEY', name: 'VNPT Money', keywords: ['vnpt money', 'vnptmoney', 'vnpt pay'], color: '#0066B3', kind: 'wallet' },
  { code: 'VNPAY', name: 'VNPay', keywords: ['vnpay', 'vn pay'], color: '#005BAA', monogram: 'VNPay', kind: 'wallet' },
];

const BY_CODE = new Map(BANKS.map((b) => [b.code, b]));

export const BANK_ICON_PREFIX = 'bank:';

export const bankIcon = (code: string) => `${BANK_ICON_PREFIX}${code}`;

export function bankFromIcon(icon: string | null | undefined): Bank | null {
  if (!icon?.startsWith(BANK_ICON_PREFIX)) return null;
  return BY_CODE.get(icon.slice(BANK_ICON_PREFIX.length)) ?? null;
}

export function bankLogo(bank: Bank): number | null {
  return bank.monogram ? null : (BANK_LOGOS[bank.code] ?? null);
}

// Từ khoá dài kiểm tra trước để "mb bank" thắng "mb"
const KEYWORDS = BANKS.flatMap((bank) => bank.keywords.map((keyword) => ({ bank, keyword }))).sort(
  (a, b) => b.keyword.length - a.keyword.length,
);

/** Nhận diện ngân hàng / ví điện tử từ tên ví hoặc văn bản: 'MB bank' → MB, 'Quỹ du lịch Momo' → MoMo */
export function detectBank(text: string | null | undefined): Bank | null {
  const normalized = normalizeForSearch(text ?? '').replace(/[^a-z0-9 ]/g, ' ');
  if (!normalized.trim()) return null;
  const padded = ` ${normalized.replace(/\s+/g, ' ')} `;
  const compact = normalized.replace(/\s+/g, '');
  for (const { bank, keyword } of KEYWORDS) {
    if (padded.includes(` ${keyword} `)) return bank;
    // Tên viết liền dài ("mbbank", "techcombank") — chỉ với từ khoá đủ dài để tránh khớp nhầm
    if (keyword.length >= 5 && !keyword.includes(' ') && compact.includes(keyword)) return bank;
  }
  return null;
}
