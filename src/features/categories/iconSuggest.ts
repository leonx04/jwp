// Gợi ý biểu tượng cho danh mục theo tên: bảng chọn tay cho danh mục hay gặp, còn lại dùng bộ tìm icon
// tiếng Việt có sẵn. Chỉ đề xuất đổi khi biểu tượng hiện tại là mặc định / chung chung hoặc trong bảng chọn tay.
import type { AppIcon } from '@/lib/icons';
import { suggestIcons } from '@/lib/icons/search';
import { normalizeForSearch } from '@/lib/text';

/** Khoá = tên danh mục đã bỏ dấu, chữ thường */
const CURATED: Record<string, AppIcon> = {
  luong: 'cash-outline',
  'cho muon': 'hand-left-outline',
  'gui me': 'heart-outline',
  'gop quy c bang': 'people-circle-outline',
  'nap dien thoai': 'phone-portrait-outline',
  'claude code': 'sparkles-outline',
  lazada: 'bag-handle-outline',
  'hoa don': 'receipt-outline',
  'vay no': 'arrow-down-circle-outline',
};

const GENERIC = new Set<string | null | undefined>([null, undefined, '', 'pricetag-outline']);

export type CategoryLike = { id: string; name: string; icon: string | null };
export type IconChange = { id: string; name: string; from: string | null; to: AppIcon };

export function suggestCategoryIcon(name: string): AppIcon | null {
  const key = normalizeForSearch(name);
  if (CURATED[key]) return CURATED[key];
  return suggestIcons(name, { banks: false, limit: 1 })[0] ?? null;
}

/** Các đổi biểu tượng nên làm: danh mục có icon chung chung, hoặc có trong bảng chọn tay mà icon đang khác */
export function proposeIconChanges(categories: readonly CategoryLike[]): IconChange[] {
  const out: IconChange[] = [];
  for (const c of categories) {
    // Logo ngân hàng / ví là lựa chọn có chủ đích → giữ
    if (c.icon?.startsWith('bank:')) continue;
    const curated = CURATED[normalizeForSearch(c.name)];
    if (!curated && !GENERIC.has(c.icon)) continue;
    const to = curated ?? suggestCategoryIcon(c.name);
    if (to && to !== c.icon) out.push({ id: c.id, name: c.name, from: c.icon, to });
  }
  return out;
}
