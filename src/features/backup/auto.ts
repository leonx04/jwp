// Sao lưu tự động: khi mở app mà đã quá hạn thì xuất file JSON đầy đủ vào thư mục riêng của app
// và (nếu bạn chọn) một thư mục ngoài — Drive, thẻ nhớ… — để mất máy / gỡ app vẫn còn bản sao.
// Giữ N bản gần nhất, tự xoá bản cũ. Không bao giờ ném lỗi ra ngoài (sao lưu hỏng không được làm hỏng app).
import { Directory } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';

import type { AppDatabase } from '@/db/types';
import { getSettings } from '@/features/settings/store';
import { toVnDate, toVnTime } from '@/lib/date';

import { backupDirectory, writeTextFile } from './fileIO';
import { collectBackupData, createJwpBackup, serializeJwpBackup } from './jwp/export';

const KEY = 'jwp.autoBackup';
const AUTO_PREFIX = 'JWP-auto-';
const DAY_MS = 86_400_000;

export type AutoBackupConfig = {
  enabled: boolean;
  /** Cách mấy ngày sao lưu một lần */
  everyDays: number;
  /** Giữ bao nhiêu bản gần nhất */
  keep: number;
  /** Thư mục ngoài đã chọn (URI từ trình chọn thư mục của hệ thống) */
  folderUri: string | null;
  /** Tên thư mục để hiển thị */
  folderName: string | null;
  lastAt: number | null;
  lastError: string | null;
};

export const DEFAULT_AUTO_BACKUP: AutoBackupConfig = {
  enabled: false,
  everyDays: 3,
  keep: 7,
  folderUri: null,
  folderName: null,
  lastAt: null,
  lastError: null,
};

export function getAutoBackupConfig(): AutoBackupConfig {
  try {
    const raw = Storage.getItemSync(KEY);
    const p = raw ? (JSON.parse(raw) as Partial<AutoBackupConfig>) : {};
    return {
      enabled: typeof p.enabled === 'boolean' ? p.enabled : DEFAULT_AUTO_BACKUP.enabled,
      everyDays:
        typeof p.everyDays === 'number' && p.everyDays >= 1
          ? p.everyDays
          : DEFAULT_AUTO_BACKUP.everyDays,
      keep: typeof p.keep === 'number' && p.keep >= 1 ? p.keep : DEFAULT_AUTO_BACKUP.keep,
      folderUri: typeof p.folderUri === 'string' ? p.folderUri : null,
      folderName: typeof p.folderName === 'string' ? p.folderName : null,
      lastAt: typeof p.lastAt === 'number' ? p.lastAt : null,
      lastError: typeof p.lastError === 'string' ? p.lastError : null,
    };
  } catch {
    return DEFAULT_AUTO_BACKUP;
  }
}

export function setAutoBackupConfig(patch: Partial<AutoBackupConfig>): AutoBackupConfig {
  const next = { ...getAutoBackupConfig(), ...patch };
  try {
    Storage.setItemSync(KEY, JSON.stringify(next));
  } catch {
    // bỏ qua
  }
  return next;
}

/** Đã đến lúc sao lưu chưa */
export function isBackupDue(lastAt: number | null, now: number, everyDays: number): boolean {
  return lastAt == null || now - lastAt >= everyDays * DAY_MS;
}

/** Tên file sao lưu tự động theo giờ Việt Nam: JWP-auto-20261012-2015.json */
export function autoBackupName(now: number): string {
  return `${AUTO_PREFIX}${toVnDate(now).replaceAll('-', '')}-${toVnTime(now).replace(':', '')}.json`;
}

/** Các tên file cần xoá để chỉ còn `keep` bản mới nhất (tên có dấu thời gian nên sắp theo chữ là đúng thứ tự) */
export function namesToPrune(names: readonly string[], keep: number): string[] {
  return names
    .filter((n) => n.startsWith(AUTO_PREFIX) && n.endsWith('.json'))
    .sort()
    .reverse()
    .slice(Math.max(1, keep));
}

function prune(dir: Directory, keep: number) {
  const entries = dir.list();
  const byName = new Map(entries.map((e) => [e.name, e]));
  for (const name of namesToPrune([...byName.keys()], keep)) {
    try {
      byName.get(name)?.delete();
    } catch {
      // không xoá được một bản cũ thì bỏ qua
    }
  }
}

export type AutoBackupResult = { ok: boolean; name?: string; error?: string };

/** Sao lưu ngay (bỏ qua việc kiểm tra hạn). */
export function backupNow(db: AppDatabase, now = Date.now()): AutoBackupResult {
  const config = getAutoBackupConfig();
  try {
    const json = serializeJwpBackup(createJwpBackup(collectBackupData(db, getSettings()), { now }));
    const name = autoBackupName(now);

    const local = backupDirectory();
    writeTextFile(name, json, local);
    prune(local, config.keep);

    let externalError: string | null = null;
    if (config.folderUri) {
      try {
        const external = new Directory(config.folderUri);
        const file = external.createFile(name, 'application/json');
        file.write(json);
        prune(external, config.keep);
      } catch (error) {
        externalError = `Không ghi được vào thư mục đã chọn (${
          error instanceof Error ? error.message : String(error)
        }). Chọn lại thư mục.`;
      }
    }
    setAutoBackupConfig({ lastAt: now, lastError: externalError });
    return { ok: externalError == null, name, error: externalError ?? undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setAutoBackupConfig({ lastError: message });
    return { ok: false, error: message };
  }
}

/** Gọi khi mở app / quay lại app: sao lưu nếu đã bật và đến hạn. */
export function runAutoBackupIfDue(db: AppDatabase, now = Date.now()): AutoBackupResult | null {
  const config = getAutoBackupConfig();
  if (!config.enabled || !isBackupDue(config.lastAt, now, config.everyDays)) return null;
  return backupNow(db, now);
}

/** Mở trình chọn thư mục của hệ thống và nhớ lại lựa chọn. Trả về null nếu huỷ. */
export async function pickBackupFolder(): Promise<AutoBackupConfig | null> {
  try {
    const dir = await Directory.pickDirectoryAsync();
    return setAutoBackupConfig({
      folderUri: dir.uri,
      folderName: dir.name || 'Thư mục đã chọn',
      lastError: null,
    });
  } catch {
    return null;
  }
}
