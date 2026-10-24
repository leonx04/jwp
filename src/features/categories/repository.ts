import { asc, eq, sql } from 'drizzle-orm';

import { categories, type Category } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { IconName } from '@/lib/icons';
import { createId } from '@/lib/id';

export type CategoryInput = { id?: string; name: string; color: string; icon: string };

/** Danh mục đặc biệt cho phí chuyển khoản (tạo khi cần, hoặc có sẵn trong dữ liệu mặc định) */
export const FEE_CATEGORY_ID = 'jwp-category-fee';

/** Tên / màu / icon của danh mục phí — dùng chung cho ensureFeeCategory và dữ liệu mặc định */
export const FEE_CATEGORY = {
  name: 'Phí giao dịch',
  color: '#94A3B8',
  icon: 'remove-circle-outline',
} as const satisfies { name: string; color: string; icon: IconName };

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
      ...FEE_CATEGORY,
      orderNum: 999,
    })
    .onConflictDoNothing()
    .run();
  return FEE_CATEGORY_ID;
}

/** Danh mục cho tiền lãi + phí của khoản vay (tôi đi vay: chi) và tiền lãi nhận được (tôi cho vay: thu) */
export const LOAN_INTEREST_CATEGORY_ID = 'jwp-category-loan-interest';
export const LOAN_INCOME_CATEGORY_ID = 'jwp-category-loan-income';

export function ensureLoanCategory(db: AppDatabase, kind: 'expense' | 'income'): string {
  const id = kind === 'expense' ? LOAN_INTEREST_CATEGORY_ID : LOAN_INCOME_CATEGORY_ID;
  db.insert(categories)
    .values(
      kind === 'expense'
        ? {
            id,
            name: 'Lãi & phí vay',
            color: '#B45309',
            icon: 'trending-down-outline',
            orderNum: 998,
          }
        : { id, name: 'Lãi cho vay', color: '#65A30D', icon: 'trending-up-outline', orderNum: 998 },
    )
    .onConflictDoNothing()
    .run();
  return id;
}

/** Đổi thứ tự theo danh sách id */
export function reorderCategories(db: AppDatabase, orderedIds: string[]): void {
  db.transaction((tx) => {
    orderedIds.forEach((id, index) =>
      tx.update(categories).set({ orderNum: index }).where(eq(categories.id, id)).run(),
    );
  });
}
