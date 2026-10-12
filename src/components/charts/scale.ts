// Tiện ích tính toán cho biểu đồ SVG: thang tuyến tính, vạch chia "đẹp", chọn nhãn trục X, đường cột bo góc.
// Hàm thuần (không React) → test được, dùng chung cho mọi biểu đồ.

export type Scale = (value: number) => number;

/** Thang tuyến tính: ánh xạ [d0, d1] → [r0, r1] */
export function linearScale(
  [d0, d1]: readonly [number, number],
  [r0, r1]: readonly [number, number],
): Scale {
  const span = d1 - d0 || 1;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

export type NiceDomain = { min: number; max: number; ticks: number[] };

/**
 * Miền giá trị trục Y làm tròn theo bước 1 · 2 · 2,5 · 5 × 10ⁿ và các vạch chia tương ứng.
 * vd 0 → 4,7 Tr với 4 vạch → 0 · 2 Tr · 4 Tr · 6 Tr
 */
export function niceDomain(min: number, max: number, count = 4): NiceDomain {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0] };
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (lo === hi) {
    if (hi === 0) return { min: 0, max: 1, ticks: [0] };
    // Một giá trị duy nhất: mở rộng để đường không nằm sát mép
    const pad = Math.abs(hi) * 0.5;
    lo = lo >= 0 ? 0 : lo - pad;
    hi = hi <= 0 ? 0 : hi + pad;
  }
  const rawStep = (hi - lo) / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = factor * magnitude;
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Làm tròn để tránh sai số dấu phẩy động (0,30000000000000004)
  for (let i = 0; niceMin + i * step <= niceMax + step / 2; i++) {
    ticks.push(Math.round((niceMin + i * step) * 1e6) / 1e6);
  }
  return { min: niceMin, max: niceMax, ticks };
}

/**
 * Chọn chỉ số các điểm sẽ hiện nhãn trục X: luôn có điểm đầu và cuối, các điểm giữa cách đều,
 * bỏ điểm giữa nếu quá sát điểm cuối (tránh chữ đè lên nhau).
 */
export function pickTickIndices(count: number, maxTicks: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count <= maxTicks) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil((count - 1) / Math.max(1, maxTicks - 1));
  const result: number[] = [];
  for (let i = 0; i < count - 1; i += step) {
    if (i === 0 || count - 1 - i >= step * 0.6) result.push(i);
  }
  result.push(count - 1);
  return result;
}

/**
 * Đường (path) của cột bo góc phía trên, đáy vuông nằm trên đường gốc.
 * (x, y) là góc trên bên trái, h chiều cao tính xuống tới đường gốc.
 */
export function roundedTopBarPath(x: number, y: number, w: number, h: number, radius = 4): string {
  if (w <= 0 || h <= 0) return '';
  const r = Math.max(0, Math.min(radius, w / 2, h));
  const bottom = y + h;
  return [
    `M${x},${bottom}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${bottom}`,
    'Z',
  ].join(' ');
}

/** Ước lượng bề rộng chữ (px) để chừa lề trục Y — đủ chính xác cho chữ số cỡ nhỏ */
export function estimateTextWidth(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.62);
}

/** Giới hạn giá trị trong [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
