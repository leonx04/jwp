// Đọc file sao lưu JWP: byte (mọi kiểu mã hoá) → JSON → kiểm tra cấu trúc.
import { decodeText } from '@/lib/encoding';

import { BackupReadError, parseJwpBackup, type JwpBackup } from './format';

export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new BackupReadError(
      'File không phải JSON hợp lệ — có thể file bị hỏng hoặc tải về chưa xong.',
    );
  }
}

export function readJwpBackup(bytes: Uint8Array): JwpBackup {
  return parseJwpBackup(parseJsonText(decodeText(bytes).text));
}
