// Tìm kiếm & gợi ý icon không phân biệt dấu, gộp cả logo ngân hàng / ví điện tử ('bank:<CODE>').
// Tách khỏi barrel '@/lib/icons' vì kéo theo danh sách logo (ảnh).
import { BANKS, bankFromIcon, bankIcon, detectBank, type Bank } from '@/lib/banks';
import { normalizeForSearch } from '@/lib/text';

import { ICON_GROUPS, iconInfo } from './catalog';
import type { AppIcon } from './types';

export const BANK_GROUP_KEY = 'banks';

/** Một ô trong bộ chọn: icon Ionicons hoặc logo ngân hàng */
export type IconOption = {
  icon: AppIcon;
  /** Tên tiếng Việt (icon) hoặc tên ngân hàng */
  label: string;
  bank: Bank | null;
  /** Chuỗi đã chuẩn hoá để so khớp, có khoảng trắng hai đầu */
  haystack: string;
};

export type IconOptionGroup = { key: string; label: string; options: readonly IconOption[] };

/** Đối tượng đang chọn icon: ví ưu tiên logo ngân hàng & nhóm tài chính */
export type IconPickerKind = 'category' | 'account';

/** Ngân hàng / ví điện tử hay dùng nhất ở VN — đứng đầu nhóm logo */
const POPULAR_BANKS = [
  'MB',
  'TCB',
  'VCB',
  'TPB',
  'BIDV',
  'ICB',
  'ACB',
  'VPB',
  'MOMO',
  'SHOPEEPAY',
  'ZALOPAY',
  'CAKE',
  'TIMO',
  'VBA',
  'STB',
];

/** Ngân hàng theo thứ tự hiển thị: phổ biến trước, còn lại theo danh sách gốc */
export const BANKS_ORDERED: readonly Bank[] = [
  ...POPULAR_BANKS.map((code) => BANKS.find((b) => b.code === code)).filter(
    (b): b is Bank => !!b,
  ),
  ...BANKS.filter((b) => !POPULAR_BANKS.includes(b.code)),
];

/** Chuẩn hoá cho so khớp: bỏ dấu, chữ thường, bỏ dấu câu (giữ '/' và '+' cho "8/3", "k+") */
function clean(text: string): string {
  return normalizeForSearch(text)
    .replace(/[^a-z0-9/+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const haystackOf = (...parts: string[]) => ` ${clean(parts.join(' '))} `;

const ICON_OPTION_GROUPS: readonly IconOptionGroup[] = ICON_GROUPS.map((group) => ({
  key: group.key,
  label: group.label,
  options: group.icons.map((entry) => ({
    icon: entry.name,
    label: entry.label,
    bank: null,
    haystack: haystackOf(entry.label, entry.keywords),
  })),
}));

const BANK_OPTION_GROUP: IconOptionGroup = {
  key: BANK_GROUP_KEY,
  label: 'Ngân hàng & ví',
  options: BANKS_ORDERED.map((bank) => ({
    icon: bankIcon(bank.code),
    label: bank.name,
    bank,
    haystack: haystackOf(
      bank.name,
      bank.code,
      bank.keywords.join(' '),
      bank.kind === 'wallet' ? 'vi dien tu e-wallet' : 'ngan hang bank',
    ),
  })),
};

const FINANCE_KEY = 'finance';

const GROUPS_FOR: Record<IconPickerKind, readonly IconOptionGroup[]> = {
  // Danh mục: nhóm chi tiêu trước, logo ngân hàng sau nhóm tài chính
  category: ICON_OPTION_GROUPS.flatMap((g) => (g.key === FINANCE_KEY ? [g, BANK_OPTION_GROUP] : [g])),
  // Ví: logo ngân hàng → tài chính → còn lại
  account: [
    BANK_OPTION_GROUP,
    ...ICON_OPTION_GROUPS.filter((g) => g.key === FINANCE_KEY),
    ...ICON_OPTION_GROUPS.filter((g) => g.key !== FINANCE_KEY),
  ],
};

/** Toàn bộ nhóm của bộ chọn (kể cả nhóm logo ngân hàng & ví), sắp theo đối tượng */
export function iconOptionGroups(kind: IconPickerKind = 'category'): readonly IconOptionGroup[] {
  return GROUPS_FOR[kind];
}

/**
 * Lọc nhóm theo truy vấn: mọi từ trong truy vấn phải khớp ĐẦU một từ trong tên / từ khoá
 * ('ca phe' → Cà phê, 'xang' → Xăng xe, 'vcb' → Vietcombank). Truy vấn rỗng → giữ nguyên.
 * Nhóm có kết quả khớp tốt hơn lên trước; trong nhóm, khớp tên trước khớp từ khoá.
 */
export function filterIconGroups(
  groups: readonly IconOptionGroup[],
  query: string,
): readonly IconOptionGroup[] {
  const q = clean(query);
  if (!q) return groups;
  const tokens = q.split(' ');
  const scored = groups
    .map((group) => {
      const options = group.options
        .map((option) => ({ option, score: matchScore(option, q, tokens) }))
        .filter((x) => x.score >= 0)
        .sort((a, b) => a.score - b.score);
      return {
        group: { ...group, options: options.map((x) => x.option) },
        best: options[0]?.score ?? Infinity,
      };
    })
    .filter((x) => x.group.options.length > 0)
    .sort((a, b) => a.best - b.best);
  return scored.map((x) => x.group);
}

/** -1: không khớp · 0: tên bắt đầu bằng truy vấn · 1: khớp nguyên cụm · 2: khớp từng từ */
function matchScore(option: IconOption, q: string, tokens: string[]): number {
  if (clean(option.label).startsWith(q)) return 0;
  if (option.haystack.includes(` ${q} `)) return 1;
  return tokens.every((t) => option.haystack.includes(` ${t}`)) ? 2 : -1;
}

/**
 * Gợi ý icon theo văn bản (thường là tên danh mục / ví): 'Cà phê' → cafe, 'Gửi xe' → key,
 * 'Shopee' → logo ShopeePay + giỏ hàng. banks = false: bỏ gợi ý logo ngân hàng.
 */
export function suggestIcons(
  text: string,
  { limit = 6, banks = true }: { limit?: number; banks?: boolean } = {},
): AppIcon[] {
  const q = clean(text);
  if (!q) return [];
  const tokens = q.split(' ');
  const out: AppIcon[] = [];
  const bank = banks ? detectBank(text) : null;
  if (bank) out.push(bankIcon(bank.code));

  const strong: { icon: AppIcon; score: number; index: number }[] = [];
  const weak: { icon: AppIcon; score: number; index: number }[] = [];
  ICON_OPTION_GROUPS.flatMap((g) => g.options).forEach((option, index) => {
    const score = matchScore(option, q, tokens);
    if (score >= 0) {
      strong.push({ icon: option.icon, score, index });
      return;
    }
    // Khớp lỏng: đếm số từ (≥ 3 ký tự) trùng nguyên từ — chỉ dùng khi không có kết quả khớp chặt
    const hits = new Set(tokens.filter((t) => t.length >= 3 && option.haystack.includes(` ${t} `)));
    if (hits.size > 0) weak.push({ icon: option.icon, score: -hits.size, index });
  });
  const ranked = (strong.length ? strong : weak).sort(
    (a, b) => a.score - b.score || a.index - b.index,
  );
  for (const { icon } of ranked) {
    if (out.length >= limit) break;
    out.push(icon);
  }
  return out;
}

/** Tên hiển thị của icon: tên ngân hàng (logo) hoặc tên tiếng Việt trong bộ chọn */
export function iconOptionLabel(icon: string | null | undefined): string | null {
  return bankFromIcon(icon)?.name ?? iconInfo(icon)?.label ?? null;
}

/** Gợi ý logo theo tên ví — chỉ khi ví chưa dùng đúng logo đó */
export function suggestedBank(name: string, icon: string): Bank | null {
  const bank = detectBank(name);
  return bank && icon !== bankIcon(bank.code) ? bank : null;
}
