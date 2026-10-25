// Bản chụp DB trước khi nâng cấp cấu trúc: có migration mới chưa chạy → chép nguyên file DB ra
// thư mục sao lưu (VACUUM INTO: bản chép nhất quán, kể cả khi đang bật WAL). Lỡ migration làm hỏng
// dữ liệu thì vẫn còn bản ngay trước đó để gửi đi / khôi phục. Giữ vài bản gần nhất.

/** Phần nhỏ của kết nối SQLite cần dùng (expo-sqlite trong app, better-sqlite3 trong test) */
export type SnapshotDb = {
  getFirstSync<T>(source: string): T | null;
  execSync(source: string): void;
};

const MIGRATIONS_TABLE = '__drizzle_migrations';
export const SNAPSHOT_PREFIX = 'truoc-nang-cap-';

/**
 * Có migration chưa chạy trên một DB đã có dữ liệu không. DB mới tinh (chưa từng migrate) thì
 * không cần chụp.
 */
export function hasPendingMigrations(db: SnapshotDb, latestMigrationAt: number): boolean {
  const table = db.getFirstSync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${MIGRATIONS_TABLE}'`,
  );
  if (!table) return false;
  const last = db.getFirstSync<{ at: number | null }>(
    `SELECT MAX(created_at) AS at FROM "${MIGRATIONS_TABLE}"`,
  );
  return last?.at == null || Number(last.at) < latestMigrationAt;
}

export function snapshotFileName(latestMigrationAt: number, now: number): string {
  const stamp = new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `${SNAPSHOT_PREFIX}${stamp}-${latestMigrationAt}.db`;
}

/** Chép DB ra `path` (đường dẫn file thường, không phải URI file://) */
export function writeSnapshot(db: SnapshotDb, path: string): void {
  db.execSync(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
}

/** Các bản cần xoá để chỉ giữ `keep` bản mới nhất (tên có dấu thời gian nên sắp theo tên là đủ) */
export function snapshotsToPrune(names: readonly string[], keep: number): string[] {
  return names
    .filter((n) => n.startsWith(SNAPSHOT_PREFIX))
    .sort()
    .reverse()
    .slice(keep);
}
