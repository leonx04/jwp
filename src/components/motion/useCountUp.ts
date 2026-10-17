// Số "chạy" tới giá trị mới (số dư, thu, chi): lần đầu từ 0 lên, các lần sau từ số cũ sang số mới.
// Chạy trên luồng JS bằng requestAnimationFrame — chỉ dùng cho vài con số nổi bật, không dùng cho cả danh sách.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Giá trị tại thời điểm t (0–1) khi chạy từ `from` tới `to` */
export const countAt = (from: number, to: number, t: number) => from + (to - from) * easeOutCubic(t);

export function useCountUp(target: number, duration = 750): number {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduceMotion.current = v;
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const from = current.current;
    // Không cần chạy (đã đúng số, hoặc người dùng bật "giảm chuyển động") → chốt ngay ở khung hình kế tiếp
    if (reduceMotion.current || from === target) {
      const frame = requestAnimationFrame(() => {
        current.current = target;
        setValue(target);
      });
      return () => cancelAnimationFrame(frame);
    }
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = (Date.now() - start) / duration;
      current.current = t >= 1 ? target : countAt(from, target, t);
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
