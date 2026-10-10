// Dữ liệu khởi đầu cho người mới (không import từ Ivy). Id cố định → chạy lại không tạo trùng.
import { accounts, categories } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { IconName } from '@/lib/icons';

const DEFAULT_CATEGORIES: [string, IconName, string][] = [
  ['Ăn uống', 'restaurant-outline', '#F97316'],
  ['Cà phê', 'cafe-outline', '#A16207'],
  ['Đi chợ', 'basket-outline', '#16A34A'],
  ['Đi lại', 'car-outline', '#0EA5E9'],
  ['Xăng xe', 'speedometer-outline', '#DC2626'],
  ['Mua sắm', 'bag-handle-outline', '#DB2777'],
  ['Hoá đơn', 'receipt-outline', '#64748B'],
  ['Nhà cửa', 'home-outline', '#7C3AED'],
  ['Điện thoại & Internet', 'wifi-outline', '#0891B2'],
  ['Sức khoẻ', 'medkit-outline', '#E11D48'],
  ['Giải trí', 'game-controller-outline', '#9333EA'],
  ['Học tập', 'school-outline', '#2563EB'],
  ['Gia đình', 'people-outline', '#EA580C'],
  ['Quà tặng', 'gift-outline', '#F43F5E'],
  ['Lương', 'briefcase-outline', '#15803D'],
  ['Thưởng', 'star-outline', '#CA8A04'],
  ['Thu khác', 'trending-up-outline', '#059669'],
  ['Khác', 'pricetag-outline', '#6B7280'],
];

export function createDefaultData(db: AppDatabase): void {
  db.transaction((tx) => {
    tx.insert(accounts)
      .values({
        id: 'jwp-default-cash',
        name: 'Tiền mặt',
        color: '#16A34A',
        icon: 'cash-outline',
        orderNum: 0,
      })
      .onConflictDoNothing()
      .run();
    tx.insert(categories)
      .values(
        DEFAULT_CATEGORIES.map(([name, icon, color], index) => ({
          id: `jwp-default-category-${index}`,
          name,
          icon,
          color,
          orderNum: index,
        })),
      )
      .onConflictDoNothing()
      .run();
  });
}
