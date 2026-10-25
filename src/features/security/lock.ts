// Khoá app bằng vân tay / khuôn mặt / mã PIN của máy (expo-local-authentication).
// Bản cài cũ chưa có module native này → coi như máy không hỗ trợ, không bao giờ khoá người dùng ở ngoài.
import { requireOptionalNativeModule } from 'expo-modules-core';

type LocalAuth = typeof import('expo-local-authentication');

/** Rời app quá ngần này thì quay lại phải mở khoá (đổi app nhanh để copy số tài khoản thì không) */
export const LOCK_GRACE_MS = 30_000;

let cached: LocalAuth | null | undefined;
function localAuth(): LocalAuth | null {
  if (cached === undefined) {
    cached = requireOptionalNativeModule('ExpoLocalAuthentication')
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require('expo-local-authentication') as LocalAuth)
      : null;
  }
  return cached;
}

export type LockSupport = 'ok' | 'not-enrolled' | 'unsupported';

/** Máy có cách mở khoá nào không (vân tay, khuôn mặt hoặc mã PIN / hình vẽ của máy) */
export async function lockSupport(): Promise<LockSupport> {
  const auth = localAuth();
  if (!auth) return 'unsupported';
  try {
    const level = await auth.getEnrolledLevelAsync();
    return level > auth.SecurityLevel.NONE ? 'ok' : 'not-enrolled';
  } catch {
    return 'unsupported';
  }
}

/** Hiện hộp mở khoá của hệ thống. Máy không hỗ trợ → true (không khoá người dùng ở ngoài). */
export async function authenticate(promptMessage: string): Promise<boolean> {
  const auth = localAuth();
  if (!auth || (await lockSupport()) !== 'ok') return true;
  try {
    const result = await auth.authenticateAsync({
      promptMessage,
      cancelLabel: 'Huỷ',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

/** Quay lại app sau khi rời đi lúc `leftAt` → có phải mở khoá lại không */
export function shouldRelock(leftAt: number | null, now: number, grace = LOCK_GRACE_MS): boolean {
  return leftAt != null && now - leftAt >= grace;
}
