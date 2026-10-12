// Chạy lại truy vấn mỗi khi một trong các bảng liên quan thay đổi.
// Khác useLiveQuery của Drizzle (chỉ theo dõi MỘT bảng chính): số dư phụ thuộc cả accounts lẫn transactions.
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useRef, useState, type DependencyList } from 'react';

/** Kết quả giống hệt lần trước thì giữ nguyên tham chiếu → không vẽ lại màn hình */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

type LiveState<T> = { data: T | undefined; error: Error | undefined };

/** Gộp nhiều thay đổi liên tiếp (vd import 500 dòng) thành một lần tải lại */
const DEBOUNCE_MS = 60;

export function useLiveData<T>(
  tables: readonly string[],
  load: () => Promise<T> | T,
  deps: DependencyList = [],
): LiveState<T> {
  const [state, setState] = useState<LiveState<T>>({ data: undefined, error: undefined });
  // Luôn gọi bản `load` mới nhất mà không phải đăng ký lại listener mỗi lần render
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const tablesKey = tables.join(',');

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      Promise.resolve()
        .then(() => loadRef.current())
        .then(
          (data) =>
            active &&
            setState((prev) =>
              prev.error === undefined && sameData(prev.data, data) ? prev : { data, error: undefined },
            ),
          (error: unknown) =>
            active &&
            setState((prev) => ({
              data: prev.data,
              error: error instanceof Error ? error : new Error(String(error)),
            })),
        );
    };

    run();
    const watched = new Set(tablesKey.split(','));
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (!watched.has(tableName)) return;
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    });

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps do người gọi truyền vào
  }, [tablesKey, ...deps]);

  return state;
}
