// Chọn / đọc / ghi / chia sẻ file trên máy.
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type PickedFile = { name: string; uri: string; size: number | null; bytes: Uint8Array };

/** Mở trình chọn file của hệ thống. Trả về null nếu người dùng huỷ. */
export async function pickFile(mimeTypes: string[] = ['*/*']): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: mimeTypes,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const bytes = await new File(asset.uri).bytes();
  return { name: asset.name, uri: asset.uri, size: asset.size ?? null, bytes };
}

/** Ghi chuỗi ra file trong thư mục `dir` (mặc định: bộ nhớ đệm), ghi đè nếu đã có */
export function writeTextFile(name: string, content: string, dir: Directory = Paths.cache): File {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  return file;
}

/** Mở bảng chia sẻ của hệ thống (Zalo, Drive, Email...) */
export async function shareFile(file: File, mimeType: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Máy không hỗ trợ chia sẻ file.');
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle, UTI: mimeType });
}

/** Thư mục lưu bản sao lưu tự động (không bị hệ thống xoá như bộ nhớ đệm) */
export const backupDirectory = () => new Directory(Paths.document, 'backups');
