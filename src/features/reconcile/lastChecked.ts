// Ngày đối chiếu số dư gần nhất của từng ví. Lưu riêng trong kv-store (không đụng vào cài đặt / file sao lưu).
import Storage from 'expo-sqlite/kv-store';

const KEY = 'jwp.reconciledAt';

function read(): Record<string, number> {
  try {
    const raw = Storage.getItemSync(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function getLastReconciled(accountId: string): number | null {
  return read()[accountId] ?? null;
}

export function markReconciled(accountId: string, at = Date.now()): void {
  try {
    Storage.setItemSync(KEY, JSON.stringify({ ...read(), [accountId]: at }));
  } catch {
    // không quan trọng: chỉ để hiện "đối chiếu lần cuối"
  }
}
