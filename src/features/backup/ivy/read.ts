// Đọc file backup Ivy: .zip (Ivy xuất ra) hoặc .json đã giải nén, mọi kiểu mã hoá.
import { unzipSync } from 'fflate';

import { decodeText, type TextEncoding } from '@/lib/encoding';

import { ivyBackupSchema, type IvyBackup } from './schema';

export class IvyReadError extends Error {}

export type IvyReadResult = {
  backup: IvyBackup;
  encoding: TextEncoding;
  /** Tên file JSON bên trong zip (nếu đọc từ zip) */
  entryName?: string;
};

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b; // 'PK'

function extractJson(bytes: Uint8Array): { bytes: Uint8Array; entryName?: string } {
  if (!isZip(bytes)) return { bytes };
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new IvyReadError('File zip bị hỏng, không giải nén được.');
  }
  const entry = Object.keys(files)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort((a, b) => files[b].length - files[a].length)[0];
  if (!entry) throw new IvyReadError('Trong file zip không có file .json nào.');
  return { bytes: files[entry], entryName: entry };
}

export function readIvyBackup(raw: Uint8Array): IvyReadResult {
  const { bytes, entryName } = extractJson(raw);
  const { text, encoding } = decodeText(bytes);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new IvyReadError('File không phải JSON hợp lệ (có thể không phải file backup của Ivy).');
  }

  const parsed = ivyBackupSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new IvyReadError(
      `Không đúng cấu trúc backup Ivy Wallet: ${issue.path.join('.') || '(gốc)'} — ${issue.message}`,
    );
  }
  return { backup: parsed.data, encoding, entryName };
}
