// Kết nối SQLite duy nhất của app. Mọi truy vấn đi qua `db` (Drizzle, có kiểu TypeScript).
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'jwp.db';

// enableChangeListener: cần cho useLiveQuery (màn hình tự cập nhật khi dữ liệu đổi)
export const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

// WAL: ghi nhanh hơn, đọc không bị chặn khi đang ghi. foreign_keys: SQLite mặc định TẮT ràng buộc khoá ngoại.
sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;
