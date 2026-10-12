// Bộ icon (Ionicons) cho ví / danh mục / tag. Lưu tên icon trực tiếp trong DB.
// Tìm kiếm / gợi ý icon (kể cả logo ngân hàng) nằm ở '@/lib/icons/search' để barrel này không kéo theo ảnh logo.
import type { AppIcon, IconName } from './types';

export type { AppIcon, IconName, McIcon } from './types';
export { ICON_CHOICES, ICON_GROUPS, iconInfo, type IconEntry, type IconGroup } from './catalog';

/** Đọc icon từ DB (chuỗi tự do) → AppIcon, rỗng thì dùng icon mặc định */
export function toAppIcon(value: string | null | undefined, fallback: IconName): AppIcon {
  return (value || fallback) as AppIcon;
}

export const DEFAULT_ACCOUNT_ICON: IconName = 'wallet-outline';
export const DEFAULT_CATEGORY_ICON: IconName = 'pricetag-outline';
export const UNCATEGORIZED_ICON: IconName = 'help-circle-outline';
