// Bảng màu nền (sáng / tối / AMOLED) và các màu chủ đạo người dùng chọn được.

export type NeutralPalette = {
  background: string;
  /** Màu đặc gần đúng của một thẻ kính phủ trên nền (dùng tính độ tương phản chữ) */
  surface: string;
  /** Nền phụ: ô nhập, chip, phím số */
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  income: string;
  expense: string;
  warning: string;
};

/** Lớp kính (Liquid Glass) — màu có độ trong suốt */
export type GlassPalette = {
  /** Nền thẻ nội dung (kính mỏng) */
  glassFill: string;
  /** Nền lớp điều hướng nổi: thanh tab, header, bảng trượt (kính dày hơn) */
  glassChrome: string;
  /** Viền sáng quanh mép kính */
  glassBorder: string;
  /** Vệt sáng phía trên (phản chiếu) */
  glassSheen: string;
  /** Viên thuốc đánh dấu mục đang chọn trên kính */
  glassActive: string;
  shadow: string;
  /** Độ đậm của các khối màu nhoè phía sau (0–1) */
  blobOpacity: number;
  blurTint: 'light' | 'dark';
};

export const lightPalette: NeutralPalette = {
  background: '#EEF0F7',
  surface: '#F8F9FC',
  surfaceAlt: '#E6E9F2',
  text: '#11131A',
  textMuted: '#5D6272',
  border: '#DADEEA',
  income: '#15803D',
  expense: '#D92D3A',
  warning: '#B45309',
};

export const darkPalette: NeutralPalette = {
  background: '#07080D',
  surface: '#14161E',
  surfaceAlt: '#1E212B',
  text: '#F1F3F9',
  textMuted: '#9BA1B0',
  border: '#272A35',
  income: '#4ADE80',
  expense: '#FF6B6B',
  warning: '#FBBF24',
};

/** Đen tuyền: điểm ảnh tắt hẳn trên màn OLED → tiết kiệm pin */
export const amoledPalette: NeutralPalette = {
  ...darkPalette,
  background: '#000000',
  surface: '#0D0E12',
  surfaceAlt: '#17181D',
  border: '#1F2026',
};

export const lightGlass: GlassPalette = {
  glassFill: 'rgba(255,255,255,0.58)',
  glassChrome: 'rgba(255,255,255,0.55)',
  glassBorder: 'rgba(255,255,255,0.85)',
  glassSheen: 'rgba(255,255,255,0.55)',
  glassActive: 'rgba(255,255,255,0.9)',
  shadow: 'rgba(40,48,90,0.14)',
  blobOpacity: 0.55,
  blurTint: 'light',
};

export const darkGlass: GlassPalette = {
  glassFill: 'rgba(255,255,255,0.055)',
  glassChrome: 'rgba(22,24,32,0.55)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassSheen: 'rgba(255,255,255,0.07)',
  glassActive: 'rgba(255,255,255,0.14)',
  shadow: 'rgba(0,0,0,0.55)',
  blobOpacity: 0.42,
  blurTint: 'dark',
};

export const amoledGlass: GlassPalette = {
  ...darkGlass,
  glassFill: 'rgba(255,255,255,0.045)',
  glassChrome: 'rgba(10,10,12,0.6)',
  // Giữ nền gần như đen để tiết kiệm pin, chỉ còn chút ánh màu
  blobOpacity: 0.18,
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
