// Dữ liệu khởi đầu cho người mới (không import từ Ivy). Id cố định → chạy lại không tạo trùng.
import { accounts, categories } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { FEE_CATEGORY, FEE_CATEGORY_ID } from '@/features/categories/repository';
import type { IconName, McIcon } from '@/lib/icons';
import { normalizeForSearch } from '@/lib/text';

type DefaultCategory = { name: string; icon: IconName | McIcon; color: string; id?: string };

/**
 * Danh mục mặc định theo thói quen chi tiêu của người Việt: chi hằng ngày trước, thu nhập sau.
 * Id = 'jwp-default-category-<vị trí>' (riêng danh mục phí dùng FEE_CATEGORY_ID để phí chuyển khoản
 * tự gắn vào đây) → chỉ thêm mục mới ở CUỐI danh sách để không đổi id của mục cũ.
 */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  // ── Chi ──
  { name: 'Ăn uống', icon: 'restaurant-outline', color: '#F97316' },
  { name: 'Cà phê', icon: 'cafe-outline', color: '#A16207' },
  { name: 'Đi chợ', icon: 'basket-outline', color: '#16A34A' },
  { name: 'Đi lại', icon: 'car-outline', color: '#0EA5E9' },
  { name: 'Xăng xe', icon: 'mci:gas-station', color: '#DC2626' },
  { name: 'Gửi xe', icon: 'key-outline', color: '#0F766E' },
  { name: 'Hoá đơn', icon: 'receipt-outline', color: '#0891B2' },
  { name: 'Nhà cửa', icon: 'home-outline', color: '#7C3AED' },
  { name: 'Mua sắm', icon: 'bag-handle-outline', color: '#DB2777' },
  { name: 'Shopee', icon: 'cart-outline', color: '#EE4D2D' },
  { name: 'Sức khoẻ', icon: 'medkit-outline', color: '#E11D48' },
  { name: 'Giáo dục', icon: 'school-outline', color: '#2563EB' },
  { name: 'Hiếu hỉ', icon: 'mail-outline', color: '#BE185D' },
  { name: 'Biếu bố mẹ', icon: 'people-circle-outline', color: '#EA580C' },
  { name: 'Giải trí', icon: 'game-controller-outline', color: '#9333EA' },
  { name: 'Du lịch', icon: 'airplane-outline', color: '#0D9488' },
  { name: 'Trả góp & trả sau', icon: 'calendar-number-outline', color: '#475569' },
  { ...FEE_CATEGORY, id: FEE_CATEGORY_ID },
  // ── Thu ──
  { name: 'Lương', icon: 'briefcase-outline', color: '#15803D' },
  { name: 'Thưởng', icon: 'star-outline', color: '#CA8A04' },
  { name: 'Thu nhập phụ', icon: 'rocket-outline', color: '#0284C7' },
  { name: 'Hoàn tiền', icon: 'refresh-circle-outline', color: '#059669' },
  { name: 'Lãi', icon: 'analytics-outline', color: '#65A30D' },
  { name: 'Khác', icon: 'ellipsis-horizontal-circle-outline', color: '#6B7280' },
];

/** Số danh mục có sẵn khi "Bắt đầu mới" (dùng cho lời giới thiệu ở màn Tổng quan) */
export const DEFAULT_CATEGORY_COUNT = DEFAULT_CATEGORIES.length;

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

    // Bỏ qua danh mục đã có cùng tên (không phân biệt dấu / hoa thường) → không tạo "Lương" thứ hai
    const existing = new Set(
      tx
        .select({ name: categories.name })
        .from(categories)
        .all()
        .map((c) => normalizeForSearch(c.name)),
    );
    const rows = DEFAULT_CATEGORIES.map(({ id, name, icon, color }, index) => ({
      id: id ?? `jwp-default-category-${index}`,
      name,
      icon,
      color,
      orderNum: index,
    })).filter((row) => !existing.has(normalizeForSearch(row.name)));
    if (rows.length > 0) tx.insert(categories).values(rows).onConflictDoNothing().run();
  });
}
