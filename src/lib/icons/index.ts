// Bộ icon (Ionicons) cho ví / danh mục / tag. Lưu tên icon trực tiếp trong DB.
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Icon lưu trong DB: tên Ionicons, hoặc logo ngân hàng / ví điện tử dạng 'bank:<CODE>' */
export type AppIcon = IconName | `bank:${string}`;

/** Đọc icon từ DB (chuỗi tự do) → AppIcon, rỗng thì dùng icon mặc định */
export function toAppIcon(value: string | null | undefined, fallback: IconName): AppIcon {
  return (value || fallback) as AppIcon;
}

export const DEFAULT_ACCOUNT_ICON: IconName = 'wallet-outline';
export const DEFAULT_CATEGORY_ICON: IconName = 'pricetag-outline';
export const UNCATEGORIZED_ICON: IconName = 'help-circle-outline';

/** Icon cho người dùng chọn, xếp theo nhóm hay dùng */
export const ICON_CHOICES: readonly IconName[] = [
  // Tiền & ví
  'wallet-outline',
  'cash-outline',
  'card-outline',
  'business-outline',
  'phone-portrait-outline',
  'trending-up-outline',
  'save-outline',
  'diamond-outline',
  // Ăn uống & mua sắm
  'restaurant-outline',
  'fast-food-outline',
  'cafe-outline',
  'beer-outline',
  'pizza-outline',
  'ice-cream-outline',
  'cart-outline',
  'bag-handle-outline',
  'basket-outline',
  'shirt-outline',
  'gift-outline',
  // Đi lại
  'car-outline',
  'bus-outline',
  'bicycle-outline',
  'airplane-outline',
  'train-outline',
  'speedometer-outline',
  // Nhà & hoá đơn
  'home-outline',
  'receipt-outline',
  'flash-outline',
  'water-outline',
  'wifi-outline',
  'tv-outline',
  'construct-outline',
  // Sức khoẻ & cá nhân
  'medkit-outline',
  'fitness-outline',
  'barbell-outline',
  'cut-outline',
  'color-palette-outline',
  'heart-outline',
  'paw-outline',
  // Học tập & công việc
  'school-outline',
  'book-outline',
  'briefcase-outline',
  'laptop-outline',
  'code-slash-outline',
  // Giải trí
  'game-controller-outline',
  'film-outline',
  'musical-notes-outline',
  'football-outline',
  'planet-outline',
  // Gia đình & xã hội
  'people-outline',
  'person-outline',
  'happy-outline',
  'chatbubble-ellipses-outline',
  'swap-horizontal-outline',
  'document-text-outline',
  'pricetag-outline',
  'star-outline',
];
