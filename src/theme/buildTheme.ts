import { mix, readableOn, withAlpha } from './color';
import {
  ACCENTS,
  amoledPalette,
  darkPalette,
  lightPalette,
  type AccentKey,
  type NeutralPalette,
} from './palettes';
import { fonts, radius, spacing, typography } from './tokens';

export type ThemeColors = NeutralPalette & {
  primary: string;
  onPrimary: string;
  /** Nền nhạt của màu chủ đạo: chip được chọn, icon badge */
  primarySoft: string;
  /** Hai màu gradient cho thẻ số dư */
  gradient: readonly [string, string];
  onGradient: string;
  /** Chuyển khoản hiển thị trung tính */
  transfer: string;
};

export type Theme = {
  dark: boolean;
  amoled: boolean;
  accent: AccentKey;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fonts: typeof fonts;
  typography: typeof typography;
};

export type ThemeOptions = {
  dark: boolean;
  /** Chỉ có tác dụng khi dark = true */
  amoled?: boolean;
  accent: AccentKey;
};

/** Sinh toàn bộ theme từ chế độ sáng/tối + màu chủ đạo. Hàm thuần → test được, memo được. */
export function buildTheme({ dark, amoled = false, accent }: ThemeOptions): Theme {
  const neutral = !dark ? lightPalette : amoled ? amoledPalette : darkPalette;
  const primary = dark ? ACCENTS[accent].dark : ACCENTS[accent].light;
  // Gradient luôn đậm để chữ trắng trên thẻ số dư dễ đọc ở mọi chế độ
  const base = ACCENTS[accent].light;
  const gradient = [base, mix(base, '#000000', dark ? 0.45 : 0.3)] as const;

  return {
    dark,
    amoled: dark && amoled,
    accent,
    colors: {
      ...neutral,
      primary,
      onPrimary: readableOn(primary),
      primarySoft: withAlpha(primary, dark ? 0.2 : 0.12),
      gradient,
      onGradient: readableOn(mix(gradient[0], gradient[1], 0.5)),
      transfer: neutral.text,
    },
    spacing,
    radius,
    fonts,
    typography,
  };
}
