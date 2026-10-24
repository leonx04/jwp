// Màu dữ liệu (lưu vào DB cùng danh mục / ví / quỹ…), không đổi theo sáng / tối.
// Màu giao diện thì lấy từ useTheme().colors — file .tsx không được viết mã màu cứng (eslint.config.js).
export const SWATCH = {
  indigo: '#5B5BD6',
  violet: '#7C3AED',
  blue: '#2563EB',
  sky: '#0EA5E9',
  teal: '#0D9488',
  green: '#16A34A',
  amber: '#F59E0B',
  orange: '#F97316',
  red: '#EF4444',
  rose: '#E11D48',
  pink: '#DB2777',
  gray: '#8A8FA0',
} as const;

/** Mục chưa phân loại / nhóm "Khác" trên biểu đồ */
export const NEUTRAL_MARK = SWATCH.gray;
