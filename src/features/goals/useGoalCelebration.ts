// Ăn mừng khi một quỹ tiết kiệm vừa đạt mục tiêu: pháo giấy + rung nhẹ, mỗi lần đạt chỉ một lần.
// Nhớ các quỹ đã ăn mừng trong kv-store; quỹ tụt khỏi mức đạt rồi đạt lại thì được ăn mừng lại.
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useState } from 'react';

import * as Haptics from '@/lib/haptics';

const KEY = 'jwp-goals-celebrated';

/** Các id cần ăn mừng: đang đạt mà chưa từng ăn mừng */
export function newlyReached(doneIds: readonly string[], celebrated: readonly string[]): string[] {
  const seen = new Set(celebrated);
  return doneIds.filter((id) => !seen.has(id));
}

function load(): string[] {
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function useGoalCelebration(
  items: readonly { done: boolean; goal: { id: string } }[] | undefined,
) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!items) return;
    const done = items.filter((g) => g.done).map((g) => g.goal.id);
    const fresh = newlyReached(done, load());
    try {
      Storage.setItemSync(KEY, JSON.stringify(done)); // chỉ giữ quỹ đang đạt
    } catch {
      // không ghi được thì lần sau có thể ăn mừng lại — chấp nhận
    }
    if (!fresh.length) return;
    // Đặt trạng thái ở khung hình kế tiếp (không đồng bộ trong effect)
    const timer = setTimeout(() => {
      setShow(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [items]);

  const hide = useCallback(() => setShow(false), []);
  return { show, hide };
}
