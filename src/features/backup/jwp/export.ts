// Xuất toàn bộ dữ liệu JWP thành bản sao lưu JSON (đầy đủ, khôi phục không mất gì).
import type { AppDatabase } from '@/db/types';
import type { SettingsState } from '@/features/settings/store';

import {
  BACKUP_APP,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  DATA_KEYS,
  exportableSettings,
  type BackupData,
  type JwpBackup,
} from './format';

/** Đọc mọi bảng (đồng bộ) → dữ liệu sao lưu. Dùng chung cho JSON JWP, JSON Ivy và CSV. */
export function collectBackupData(db: AppDatabase, settings: Partial<SettingsState>): BackupData {
  const data = {} as Record<string, unknown>;
  for (const key of DATA_KEYS) data[key] = db.select().from(BACKUP_TABLES[key]).all();
  data.settings = exportableSettings(settings);
  return data as BackupData;
}

export function createJwpBackup(
  data: BackupData,
  { now = Date.now(), appVersion }: { now?: number; appVersion?: string } = {},
): JwpBackup {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    ...(appVersion ? { appVersion } : {}),
    data,
  };
}

/** JSON gọn (không thụt lề) — file nhỏ, máy đọc nhanh */
export function serializeJwpBackup(backup: JwpBackup): string {
  return JSON.stringify(backup);
}
