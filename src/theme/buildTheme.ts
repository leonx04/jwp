import { mix, readableOn, shiftHue, withAlpha } from './color';
import {
  ACCENTS,
  amoledGlass,
  amoledPalette,
  darkGlass,
  darkPalette,
  lightGlass,
  lightPalette,
  type AccentKey,
  type GlassPalette,
  type NeutralPalette,
} from './palettes';
import { fonts, radius, spacing, typography } from './tokens';

export type ThemeColors = NeutralPalette &
  GlassPalette & {
    primary: string;
    onPrimary: string;
    /** Nền nhạt của màu chủ đạo: chip được chọn, icon badge */
    primarySoft: string;
    /** Hai màu gradient cho nút chính / thẻ số dư */
    gradient: readonly [string, string];
    onGradient: string;
    /** Chuyển khoản hiển thị trung tính */
    transfer: string;
    /** Bảng màu tối (tiện cho các quyết định màu trong component) */
    dark: boolean;
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
  const isAmoled = dark && amoled;
  const neutral = !dark ? lightPalette : isAmoled ? amoledPalette : darkPalette;
  const glass = !dark ? lightGlass : isAmoled ? amoledGlass : darkGlass;
  const primary = dark ? ACCENTS[accent].dark : ACCENTS[accent].light;
  // Gradient luôn đậm để chữ trắng trên nút / thẻ số dư dễ đọc ở mọi chế độ
  const base = ACCENTS[accent].light;
  const gradient = [
    mix(base, shiftHue(base, 25), 0.35),
    mix(base, '#000000', dark ? 0.35 : 0.18),
  ] as const;

  return {
    dark,
    amoled: isAmoled,
    accent,
    colors: {
      ...neutral,
      ...glass,
      primary,
      onPrimary: readableOn(primary),
      primarySoft: withAlpha(primary, dark ? 0.2 : 0.12),
      gradient,
      onGradient: readableOn(mix(gradient[0], gradient[1], 0.5)),
      transfer: neutral.text,
      dark,
    },
    spacing,
    radius,
    fonts,
    typography,
  };
}
