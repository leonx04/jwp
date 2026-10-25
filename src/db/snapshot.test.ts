import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  hasPendingMigrations,
  snapshotFileName,
  snapshotsToPrune,
  writeSnapshot,
  type SnapshotDb,
} from './snapshot';

const wrap = (raw: Database.Database): SnapshotDb => ({
  getFirstSync: <T>(source: string) => (raw.prepare(source).get() as T | undefined) ?? null,
  execSync: (source: string) => void raw.exec(source),
});

describe('bản chụp DB trước khi nâng cấp', () => {
  it('chỉ chụp khi DB đã có dữ liệu và còn migration chưa chạy', () => {
    const raw = new Database(':memory:');
    const db = wrap(raw);
    // DB mới tinh: chưa có bảng migration
    expect(hasPendingMigrations(db, 200)).toBe(false);
    raw.exec(
      'CREATE TABLE "__drizzle_migrations" (id INTEGER PRIMARY KEY, hash text, created_at numeric)',
    );
    raw.exec(`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ('a', 100)`);
    expect(hasPendingMigrations(db, 200)).toBe(true);
    raw.exec(`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ('b', 200)`);
    expect(hasPendingMigrations(db, 200)).toBe(false);
  });

  it('VACUUM INTO chép đủ dữ liệu ra file riêng', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jwp-snap-'));
    try {
      const raw = new Database(':memory:');
      raw.exec("CREATE TABLE t (v text); INSERT INTO t VALUES ('Tiền nhà'), ('Lương');");
      const path = join(dir, "bản chụp 'a'.db");
      writeSnapshot(wrap(raw), path);
      const copy = new Database(path, { readonly: true });
      expect(copy.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 2 });
      copy.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tên file theo giờ VN, giữ N bản mới nhất', () => {
    expect(snapshotFileName(123, Date.UTC(2026, 9, 25, 2, 30))).toBe(
      'truoc-nang-cap-202610250930-123.db',
    );
    const names = [
      'truoc-nang-cap-202610200800-1.db',
      'truoc-nang-cap-202610250930-3.db',
      'JWP-auto-x.json',
      'truoc-nang-cap-202610220800-2.db',
    ];
    expect(snapshotsToPrune(names, 2)).toEqual(['truoc-nang-cap-202610200800-1.db']);
  });
});
