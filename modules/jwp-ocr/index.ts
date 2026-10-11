// Nhận dạng chữ trên máy (module native riêng của JWP, ML Kit bản đóng gói).
// Không có trong Expo Go → ocrAvailable = false, tính năng quét ảnh tự ẩn.
import { requireOptionalNativeModule } from 'expo';

export type OcrLine = { text: string; left: number; top: number; right: number; bottom: number };
export type OcrResult = { text: string; width: number; height: number; lines: OcrLine[] };

type JwpOcrNative = { recognize(uri: string): Promise<OcrResult> };

const native = requireOptionalNativeModule<JwpOcrNative>('JwpOcr');

export const ocrAvailable = native != null;

export function recognizeText(uri: string): Promise<OcrResult> {
  if (!native) {
    return Promise.reject(new Error('Quét ảnh cần bản cài riêng của JWP (không chạy trong Expo Go).'));
  }
  return native.recognize(uri);
}
