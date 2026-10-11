// Ngôn ngữ thiết kế "Calm Glass" (JWP v3):
// - Nền tĩnh một tông + một quầng sáng rất nhẹ ở đỉnh theo màu chủ đạo (không loang lổ).
// - Phân tầng bằng bậc sắc độ: nền → thẻ → nổi (cách Copilot Money làm), hạn chế viền.
// - Kính (làm mờ) CHỈ cho lớp điều hướng nổi: thanh tab, header, bảng trượt (nguyên tắc Liquid Glass).
// - Màu dữ liệu dịu: xanh cho thu, đỏ cam cho chi — tránh đỏ gắt gây áp lực khi xem tài chính.

export type NeutralPalette = {
  /** Nền màn hình */
  background: string;
  /** Thẻ nội dung */
  surface: string;
  /** Nền lõm: ô nhập, chip, phím số, rãnh nút chọn */
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  income: string;
  expense: string;
  warning: string;
};

/** Lớp kính / phụ trợ (tên giữ "glass" để các component cũ dùng được) */
export type GlassPalette = {
  /** Nền chip / ô nhập / phím số / nút tròn (bậc lõm) */
  glassFill: string;
  /** Nền lớp điều hướng nổi có làm mờ: thanh tab, header, bảng trượt */
  glassChrome: string;
  /** Viền mảnh */
  glassBorder: string;
  /** Vệt phản chiếu trên lớp kính điều hướng */
  glassSheen: string;
  /** Viên đánh dấu mục đang chọn (bậc nổi) */
  glassActive: string;
  shadow: string;
  /** Độ đậm quầng sáng màu chủ đạo ở đỉnh nền (0–1) */
  glowOpacity: number;
  blurTint: 'light' | 'dark';
};

export const lightPalette: NeutralPalette = {
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF0F6',
  text: '#0E1320',
  textMuted: '#5F687C',
  border: '#E3E7EF',
  income: '#13803F',
  expense: '#C9372C',
  warning: '#A95A06',
};

export const darkPalette: NeutralPalette = {
  background: '#060A12',
  surface: '#0E1522',
  surfaceAlt: '#151E30',
  text: '#E9EDF5',
  textMuted: '#8C97AD',
  border: '#1C2639',
  income: '#2FD27A',
  expense: '#FF6B57',
  warning: '#FECE4C',
};

/** Đen tuyền: điểm ảnh tắt hẳn trên màn OLED → tiết kiệm pin */
export const amoledPalette: NeutralPalette = {
  ...darkPalette,
  background: '#000000',
  surface: '#0B0F17',
  surfaceAlt: '#131926',
  border: '#1A2130',
};

export const lightGlass: GlassPalette = {
  glassFill: '#EDF0F6',
  glassChrome: 'rgba(255,255,255,0.74)',
  glassBorder: 'rgba(16,24,40,0.07)',
  glassSheen: 'rgba(255,255,255,0.55)',
  glassActive: '#FFFFFF',
  shadow: 'rgba(16,24,40,0.08)',
  glowOpacity: 0.13,
  blurTint: 'light',
};

export const darkGlass: GlassPalette = {
  glassFill: '#151E30',
  glassChrome: 'rgba(14,21,34,0.72)',
  glassBorder: 'rgba(255,255,255,0.06)',
  glassSheen: 'rgba(255,255,255,0.06)',
  glassActive: '#22304A',
  shadow: 'rgba(0,0,0,0.45)',
  glowOpacity: 0.2,
  blurTint: 'dark',
};

export const amoledGlass: GlassPalette = {
  ...darkGlass,
  glassFill: '#131926',
  glassChrome: 'rgba(0,0,0,0.72)',
  glassActive: '#1F2A40',
  glowOpacity: 0.1,
};

export type Accent = {
  name: string;
  /** Dùng trên nền sáng */
  light: string;
  /** Dùng trên nền tối (sáng hơn để đủ tương phản) */
  dark: string;
};

export const ACCENTS = {
  indigo: { name: 'Chàm', light: '#4F46E5', dark: '#8B93FF' },
  blue: { name: 'Xanh dương', light: '#1C6CFF', dark: '#5B9BFF' },
  violet: { name: 'Tím', light: '#7C3AED', dark: '#A78BFA' },
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
