// Hằng số / hàm thuần của hiệu ứng xuất hiện lần lượt (tách riêng để test mà không cần thư viện hoạt hình).
export const REVEAL_STEP_MS = 60;
export const REVEAL_MAX_STEPS = 8;

/** Độ trễ của khối thứ `index`: mỗi bậc trễ thêm 60ms, tối đa 8 bậc */
export const revealDelay = (index: number) =>
  Math.min(Math.max(index, 0), REVEAL_MAX_STEPS) * REVEAL_STEP_MS;
