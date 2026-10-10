// Tiện ích màu dùng để sinh theme từ màu chủ đạo. Màu dạng '#RRGGBB'.

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Trộn hai màu: t = 0 → a, t = 1 → b */
export function mix(a: string, b: string, t: number): string {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * t) as Rgb);
}

/** Thêm độ trong suốt: withAlpha('#5B5BD6', 0.15) → '#5B5BD626' */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hex.slice(0, 7)}${a.toString(16).padStart(2, '0').toUpperCase()}`;
}

/** Độ sáng tương đối theo WCAG (0 = đen, 1 = trắng) */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tỷ lệ tương phản WCAG giữa hai màu (1 → 21). Chữ thường cần ≥ 4.5, chữ lớn ≥ 3. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Chọn chữ trắng hoặc gần đen trên nền màu, cái nào tương phản tốt hơn */
export function readableOn(background: string): string {
  const light = '#FFFFFF';
  const dark = '#111218';
  return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
}
