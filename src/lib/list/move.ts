/** Đưa phần tử ở `index` lên (−1) hoặc xuống (+1) một bậc; ra ngoài biên thì giữ nguyên. Không sửa mảng gốc. */
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  const next = [...items];
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
