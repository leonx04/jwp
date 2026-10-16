import { asc, count, eq } from 'drizzle-orm';

import { tags, transactionTags, type Tag } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { createId } from '@/lib/id';
import { normalizeForSearch } from '@/lib/text';

export type TagWithCount = Tag & { usage: number };

export function listTags(db: AppDatabase): TagWithCount[] {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      nameKey: tags.nameKey,
      color: tags.color,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
      usage: count(transactionTags.transactionId),
    })
    .from(tags)
    .leftJoin(transactionTags, eq(transactionTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(asc(tags.name))
    .all();
}

/** Bỏ dấu '#' ở đầu, gộp khoảng trắng */
export function cleanTagName(name: string): string {
  return name.replace(/^#+/, '').replace(/\s+/g, ' ').trim();
}

/** Tìm tag theo tên (không phân biệt dấu/hoa thường), chưa có thì tạo. Trả về id. */
export function ensureTag(db: AppDatabase, rawName: string, color?: string | null): string {
  const name = cleanTagName(rawName);
  const nameKey = normalizeForSearch(name);
  if (!nameKey) throw new Error('Tên tag không được trống.');
  const existing = db.select({ id: tags.id }).from(tags).where(eq(tags.nameKey, nameKey)).get();
  if (existing) return existing.id;
  const id = createId();
  db.insert(tags)
    .values({ id, name, nameKey, color: color ?? null })
    .run();
  return id;
}

export function saveTag(
  db: AppDatabase,
  input: { id?: string; name: string; color?: string | null },
) {
  if (!input.id) return ensureTag(db, input.name, input.color);
  const name = cleanTagName(input.name);
  const nameKey = normalizeForSearch(name);
  if (!nameKey) throw new Error('Tên tag không được trống.');
  const clash = db.select({ id: tags.id }).from(tags).where(eq(tags.nameKey, nameKey)).get();
  if (clash && clash.id !== input.id) throw new Error(`Đã có tag "${name}".`);
  db.update(tags)
    .set({ name, nameKey, color: input.color ?? null })
    .where(eq(tags.id, input.id))
    .run();
  return input.id;
}

export function deleteTag(db: AppDatabase, id: string): void {
  db.delete(tags).where(eq(tags.id, id)).run();
}

/** Gắn tag vào nhiều giao dịch (bỏ qua giao dịch đã có tag). Trả về số giao dịch được gắn mới. */
export function attachTag(
  db: AppDatabase,
  tagId: string,
  transactionIds: readonly string[],
): number {
  let added = 0;
  db.transaction((tx) => {
    for (const transactionId of transactionIds) {
      const res = tx
        .insert(transactionTags)
        .values({ transactionId, tagId })
        .onConflictDoNothing()
        .run();
      added += res.changes;
    }
  });
  return added;
}
