// Design tokens: khoảng cách, bo góc, font, cỡ chữ. Không hard-code số rải rác trong component.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Bo góc theo nguyên tắc "đồng tâm" của Liquid Glass: góc bên trong = góc bên ngoài − khoảng đệm.
 * Thẻ (xl = 28) chứa phần tử cách mép 16 → phần tử bên trong bo 12 (md).
 */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 34,
  full: 999,
} as const;

/** Be Vietnam Pro: font thiết kế cho tiếng Việt. Tên phải khớp key nạp trong useFonts (src/app/_layout.tsx). */
export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

// Với font tuỳ chỉnh trên Android: chọn độ đậm bằng fontFamily, KHÔNG dùng fontWeight.
export const typography = {
  /** Số tiền lớn nhất màn hình (tổng số dư, ô nhập tiền) */
  hero: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 50, letterSpacing: -1 },
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 42, letterSpacing: -0.8 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  // Không dùng letterSpacing dương: Android đo thiếu chiều rộng → mất ký tự cuối (vd "Ví" → "V")
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
} as const;

export type TypographyVariant = keyof typeof typography;
