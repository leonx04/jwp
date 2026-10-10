import { asc, eq, sql } from 'drizzle-orm';

import { categories, type Category } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { createId } from '@/lib/id';

export type CategoryInput = { id?: string; name: string; color: string; icon: string };

/** Danh mục đặc biệt cho phí chuyển khoản (tạo khi cần) */
export const FEE_CATEGORY_ID = 'jwp-category-fee';

export function listCategories(db: AppDatabase): Category[] {
  return db.select().from(categories).orderBy(asc(categories.orderNum), asc(categories.name)).all();
}

export function saveCategory(db: AppDatabase, input: CategoryInput): string {
  const name = input.name.trim();
  if (!name) throw new Error('Tên danh mục không được trống.');
  if (input.id) {
    db.update(categories)
      .set({ name, color: input.color, icon: input.icon })
      .where(eq(categories.id, input.id))
      .run();
    return input.id;
  }
  const id = createId();
  const max = db
    .select({ v: sql<number>`coalesce(max(${categories.orderNum}), -1)` })
    .from(categories)
    .get();
  db.insert(categories)
    .values({ id, name, color: input.color, icon: input.icon, orderNum: (max?.v ?? -1) + 1 })
    .run();
  return id;
}

/** Xoá danh mục: giao dịch thuộc danh mục này trở thành "Chưa phân loại" (khoá ngoại SET NULL) */
export function deleteCategory(db: AppDatabase, id: string): void {
  db.delete(categories).where(eq(categories.id, id)).run();
}

export function ensureFeeCategory(db: AppDatabase): string {
  db.insert(categories)
    .values({
      id: FEE_CATEGORY_ID,
      name: 'Phí giao dịch',
      color: '#94A3B8',
      icon: 'receipt-outline',
      orderNum: 999,
    })
    .onConflictDoNothing()
    .run();
  return FEE_CATEGORY_ID;
}

/** Đổi thứ tự theo danh sách id */
export function reorderCategories(db: AppDatabase, orderedIds: string[]): void {
  db.transaction((tx) => {
    orderedIds.forEach((id, index) =>
      tx.update(categories).set({ orderNum: index }).where(eq(categories.id, id)).run(),
    );
  });
}
