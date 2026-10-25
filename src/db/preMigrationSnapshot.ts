// Nối snapshot.ts với file thật trên máy (expo-file-system). Không bao giờ ném lỗi: chụp hỏng thì vẫn
// cho app chạy migration như bình thường.
import { Directory, File, Paths } from 'expo-file-system';

import migrations from '../../drizzle/migrations';
import { sqlite } from './client';
import {
  hasPendingMigrations,
  snapshotFileName,
  snapshotsToPrune,
  writeSnapshot,
} from './snapshot';

const KEEP = 3;

export const snapshotDirectory = () => new Directory(Paths.document, 'backups', 'db');

const latestMigrationAt = () =>
  Math.max(0, ...migrations.journal.entries.map((e: { when: number }) => e.when));

/** Trả về file bản chụp vừa tạo, hoặc null khi không cần / không chụp được */
export function takePreMigrationSnapshot(now = Date.now()): File | null {
  try {
    const latest = latestMigrationAt();
    if (!hasPendingMigrations(sqlite, latest)) return null;
    const dir = snapshotDirectory();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, snapshotFileName(latest, now));
    if (file.exists) file.delete();
    writeSnapshot(sqlite, decodeURIComponent(file.uri.replace(/^file:\/\//, '')));
    const names = dir.list().map((entry) => entry.name);
    for (const name of snapshotsToPrune(names, KEEP)) new File(dir, name).delete();
    return file;
  } catch (error) {
    console.warn('[db] không chụp được DB trước khi nâng cấp:', error);
    return null;
  }
}
