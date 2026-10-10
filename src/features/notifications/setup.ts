import { setupChannelsAndCategories } from './config';
import { loadNotifications } from './module';

let ready: Promise<boolean> | null = null;

/**
 * Gắn handler + tạo kênh + nút hành động. Gọi nhiều lần vẫn chỉ chạy một lần.
 * Trả về false nếu môi trường không hỗ trợ thông báo (Expo Go Android).
 */
export function initNotifications(): Promise<boolean> {
  ready ??= (async () => {
    const N = await loadNotifications();
    if (!N) return false;
    // Khi app ĐANG MỞ mà có thông báo đến: vẫn hiện popup + âm thanh.
    // Không có handler này thì thông báo bị ẩn khi app ở tiền cảnh.
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    await setupChannelsAndCategories(N);
    return true;
  })().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPermissionState(): Promise<PermissionState> {
  const N = await loadNotifications();
  if (!N) return 'unsupported';
  const { status, canAskAgain } = await N.getPermissionsAsync();
  // Android 13+ báo 'denied' ngay cả khi CHƯA hỏi lần nào → còn hỏi được thì coi là chưa quyết định
  if (status !== 'granted' && canAskAgain) return 'undetermined';
  return status as PermissionState;
}

/**
 * Xin quyền thông báo (Android 13+ hiện hộp thoại hệ thống).
 * Phải tạo kênh trước, nếu không Android sẽ không hiện hộp thoại.
 */
export async function requestPermission(): Promise<PermissionState> {
  const N = await loadNotifications();
  if (!N || !(await initNotifications())) return 'unsupported';
  const current = await N.getPermissionsAsync();
  if (current.status === 'granted' || !current.canAskAgain) {
    return current.status as PermissionState;
  }
  const { status } = await N.requestPermissionsAsync();
  return status as PermissionState;
}
