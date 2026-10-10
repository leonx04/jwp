// Bảng màu nền (sáng / tối / AMOLED) và các màu chủ đạo người dùng chọn được.

export type NeutralPalette = {
  background: string;
  surface: string;
  /** Nền phụ: ô nhập, chip, hàng được chọn */
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  income: string;
  expense: string;
  warning: string;
};

export const lightPalette: NeutralPalette = {
  background: '#F4F5F9',
  surface: '#FFFFFF',
  surfaceAlt: '#ECEEF4',
  text: '#14151A',
  textMuted: '#626777',
  border: '#E1E3EA',
  income: '#15803D',
  expense: '#D92D3A',
  warning: '#B45309',
};

export const darkPalette: NeutralPalette = {
  background: '#0E0F14',
  surface: '#181A21',
  surfaceAlt: '#22252E',
  text: '#EDEFF5',
  textMuted: '#9AA0AE',
  border: '#2A2D37',
  income: '#4ADE80',
  expense: '#FF6B6B',
  warning: '#FBBF24',
};

/** Đen tuyền: điểm ảnh tắt hẳn trên màn OLED → tiết kiệm pin */
export const amoledPalette: NeutralPalette = {
  ...darkPalette,
  background: '#000000',
  surface: '#0C0C0F',
  surfaceAlt: '#18191D',
  border: '#1F2026',
};

export type Accent = {
  name: string;
  /** Dùng trên nền sáng */
  light: string;
  /** Dùng trên nền tối (sáng hơn để đủ tương phản) */
  dark: string;
};

export const ACCENTS = {
  indigo: { name: 'Chàm', light: '#5B5BD6', dark: '#8E8EF7' },
  violet: { name: 'Tím', light: '#7C3AED', dark: '#A78BFA' },
  blue: { name: 'Xanh dương', light: '#2563EB', dark: '#60A5FA' },
  sky: { name: 'Xanh trời', light: '#0369A1', dark: '#38BDF8' },
  teal: { name: 'Xanh ngọc', light: '#0F766E', dark: '#2DD4BF' },
  green: { name: 'Xanh lá', light: '#15803D', dark: '#4ADE80' },
  amber: { name: 'Vàng nghệ', light: '#B45309', dark: '#FBBF24' },
  orange: { name: 'Cam', light: '#C2410C', dark: '#FB923C' },
  rose: { name: 'Hồng đỏ', light: '#E11D48', dark: '#FB7185' },
  pink: { name: 'Hồng', light: '#DB2777', dark: '#F472B6' },
  slate: { name: 'Xám than', light: '#475569', dark: '#94A3B8' },
} as const satisfies Record<string, Accent>;

export type AccentKey = keyof typeof ACCENTS;
export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];
export const DEFAULT_ACCENT: AccentKey = 'indigo';
