// Đọc thông báo / SMS biến động số dư trên máy (module native riêng của JWP, Android).
// Không có trong Expo Go / bản chưa build native → captureAvailable = false và các hàm trả giá trị rỗng.
import { requireOptionalNativeModule } from 'expo';

export type NativeCapture = {
  /** 'notification' | 'sms' */
  source: string;
  /** Gói app (thông báo) hoặc tên người gửi (SMS) */
  sender: string;
  title: string;
  text: string;
  postedAt: number;
};

type JwpNotifNative = {
  /** Quyền "Truy cập thông báo" đã bật cho JWP chưa */
  isListenerEnabled(): boolean;
  /** Mở màn cài đặt hệ thống để bật quyền truy cập thông báo */
  openListenerSettings(): void;
  /** App nào được đọc thông báo (đọc bởi service nền, kể cả khi app đóng) */
  setAllowedPackages(packages: string[]): void;
  /** Bật / tắt đọc SMS (cần quyền RECEIVE_SMS đã cấp) */
  setSmsEnabled(enabled: boolean): void;
  /** Lấy và xoá các mục đã bắt được từ lần trước */
  drainQueue(): NativeCapture[];
};

const native = requireOptionalNativeModule<JwpNotifNative>('JwpNotif');

export const captureAvailable = native != null;

export const isListenerEnabled = (): boolean => native?.isListenerEnabled() ?? false;
export const openListenerSettings = (): void => native?.openListenerSettings();
export const setAllowedPackages = (packages: string[]): void =>
  native?.setAllowedPackages(packages);
export const setSmsEnabled = (enabled: boolean): void => native?.setSmsEnabled(enabled);
export const drainQueue = (): NativeCapture[] => native?.drainQueue() ?? [];
