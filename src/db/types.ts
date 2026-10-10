import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Kiểu DB dùng trong mọi hàm truy vấn / ghi dữ liệu.
 * Cả expo-sqlite (trong app) và better-sqlite3 (khi test trên máy tính) đều là driver ĐỒNG BỘ
 * → cùng một hàm chạy được ở cả hai nơi.
 *
 * Lưu ý với driver đồng bộ: trong db.transaction((tx) => ...) phải gọi .run() / .all() / .get(),
 * KHÔNG dùng await (Drizzle sẽ commit trước khi các lệnh await kịp chạy).
 */
export type AppDatabase = BaseSQLiteDatabase<'sync', any, typeof schema>;
