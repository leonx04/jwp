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

/** '#5B5BD6', 0.5 → 'rgba(91,91,214,0.5)' */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Xoay sắc độ (hue) một góc, giữ độ bão hoà / độ sáng — để sinh màu nền hài hoà với màu chủ đạo */
export function shiftHue(hex: string, degrees: number): string {
  const [r, g, b] = toRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + degrees + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return toHex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255]);
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
