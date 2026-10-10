// Design tokens: khoảng cách, bo góc, font, cỡ chữ. Không hard-code số rải rác trong component.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
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
  display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 44 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
} as const;

export type TypographyVariant = keyof typeof typography;
