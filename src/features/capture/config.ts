// Cài đặt "Tự đọc thông báo". Lưu riêng trong kv-store (không đụng vào cài đặt chung / file sao lưu).
import Storage from 'expo-sqlite/kv-store';

import { KNOWN_PACKAGES } from './parse';

const KEY = 'jwp.capture';

export type CaptureConfig = {
  /** Bật tự đọc */
  enabled: boolean;
  /** Các app được đọc thông báo */
  packages: string[];
  /** Đọc cả SMS biến động số dư (chỉ tin nhắn từ tên chữ như MBBANK, không đọc số điện thoại cá nhân) */
  sms: boolean;
  /** Tên của chính bạn: thông báo có tên này được gợi ý là chuyển tiền giữa ví của mình */
  ownerName: string;
  /** Tự ghi khi hai thông báo ghép thành đúng một lần chuyển giữa 2 ví của bạn */
  autoTransfer: boolean;
};

export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  enabled: false,
  packages: Object.keys(KNOWN_PACKAGES),
  sms: false,
  ownerName: '',
  autoTransfer: false,
};

export function getCaptureConfig(): CaptureConfig {
  try {
    const raw = Storage.getItemSync(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CaptureConfig>) : {};
    return {
      enabled:
        typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_CAPTURE_CONFIG.enabled,
      packages: Array.isArray(parsed.packages)
        ? parsed.packages.filter((p): p is string => typeof p === 'string')
        : DEFAULT_CAPTURE_CONFIG.packages,
      sms: typeof parsed.sms === 'boolean' ? parsed.sms : DEFAULT_CAPTURE_CONFIG.sms,
      ownerName: typeof parsed.ownerName === 'string' ? parsed.ownerName : '',
      autoTransfer: typeof parsed.autoTransfer === 'boolean' ? parsed.autoTransfer : false,
    };
  } catch {
    return DEFAULT_CAPTURE_CONFIG;
  }
}

export function setCaptureConfig(patch: Partial<CaptureConfig>): CaptureConfig {
  const next = { ...getCaptureConfig(), ...patch };
  try {
    Storage.setItemSync(KEY, JSON.stringify(next));
  } catch {
    // bỏ qua: lần sau đọc lại mặc định
  }
  return next;
}
