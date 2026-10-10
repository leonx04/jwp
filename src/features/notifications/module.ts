// Nạp expo-notifications CÓ ĐIỀU KIỆN.
// Lý do (phát hiện ở spike Giai đoạn 0): trên Expo Go Android từ SDK 53, chỉ cần import
// 'expo-notifications' là thư viện tự đăng ký push token và NÉM LỖI → cả app không mở được.
// → Không import tĩnh ở đâu cả (trừ `import type`); luôn đi qua loadNotifications().
// Trong bản dev build / bản cài riêng thì chạy đầy đủ.
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

export type NotificationsModule = typeof import('expo-notifications');

export const notificationsSupported = !(Platform.OS === 'android' && isRunningInExpoGo());

let modulePromise: Promise<NotificationsModule> | null = null;

/** Trả về module, hoặc null nếu môi trường hiện tại không hỗ trợ (Expo Go Android). */
export function loadNotifications(): Promise<NotificationsModule | null> {
  if (!notificationsSupported) return Promise.resolve(null);
  modulePromise ??= import('expo-notifications');
  return modulePromise;
}

export class NotificationsUnsupportedError extends Error {
  constructor() {
    super('Thông báo không chạy trong Expo Go trên Android. Hãy dùng bản cài riêng (dev build).');
  }
}

/** Như loadNotifications() nhưng ném lỗi dễ hiểu khi không hỗ trợ */
export async function requireNotifications(): Promise<NotificationsModule> {
  const module = await loadNotifications();
  if (!module) throw new NotificationsUnsupportedError();
  return module;
}
