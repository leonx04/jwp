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
import { NEUTRAL_MARK } from './swatches';
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
    /** Chữ / icon trên nền màu chi (nút xoá, vuốt xoá) */
    onDanger: string;
    /** Lớp đảo màu so với nền: dock thanh tab (nền sáng → dock tối và ngược lại) */
    inverseSurface: string;
    onInverseSurface: string;
    /** Icon chưa chọn trên lớp đảo màu */
    inverseMuted: string;
    /** Thông báo ngắn (snackbar): luôn tối, chữ sáng */
    toast: string;
    onToast: string;
    /** Nút hành động trên snackbar */
    toastAction: string;
    /** Màu trung tính cho mục chưa phân loại / nhóm "Khác" trên biểu đồ */
    neutralMark: string;
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
      onDanger: '#FFFFFF',
      inverseSurface: dark ? '#E9EDF5' : '#0E1320',
      onInverseSurface: dark ? '#0E1320' : '#F3F4F8',
      inverseMuted: dark ? '#5F687C' : '#8C97AD',
      toast: dark ? 'rgba(36,38,48,0.96)' : 'rgba(22,24,32,0.94)',
      onToast: '#F3F4F8',
      // Nền snackbar luôn tối → dùng bản sáng của màu chủ đạo cho dễ đọc
      toastAction: ACCENTS[accent].dark,
      neutralMark: NEUTRAL_MARK,
      dark,
    },
    spacing,
    radius,
    fonts,
    typography,
  };
}
