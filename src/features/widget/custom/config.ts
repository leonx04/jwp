// Cấu hình của TỪNG widget "JWP · Tùy chỉnh": hiện gì, kỳ nào, ví / ngân sách / quỹ nào, màu và kiểu hiển thị.
// Lưu theo widgetId trong kv-store (đọc đồng bộ, dùng được cả khi app đang đóng — tác vụ nền của widget).
import Storage from 'expo-sqlite/kv-store';

export const METRICS = [
  'safe_today',
  'balance',
  'cashflow',
  'budget',
  'goal',
  'credit',
  'upcoming',
  'debt',
] as const;
export type Metric = (typeof METRICS)[number];

export const PERIODS = ['today', 'week', 'month', 'cycle', 'year'] as const;
export type Period = (typeof PERIODS)[number];

export const CASH_MODES = ['expense', 'income', 'net', 'both'] as const;
export type CashMode = (typeof CASH_MODES)[number];

export const PALETTES = ['auto', 'purple', 'blue', 'green', 'orange', 'rose', 'dark'] as const;
export type Palette = (typeof PALETTES)[number];

export type WidgetConfig = {
  metric: Metric;
  /** Thu chi: kỳ nào (theo ngày bắt đầu tháng trong cài đặt nếu là "cycle") */
  period: Period;
  cash: CashMode;
  /** Số dư / thu chi / ví trả sau: ví nào (trống = mặc định: mọi ví tính vào tổng) */
  accountIds: string[];
  /** Ngân sách: null = cái sát hạn mức nhất */
  budgetId: string | null;
  /** Quỹ tiết kiệm: null = quỹ đầu tiên chưa đạt */
  goalId: string | null;
  palette: Palette;
  showBar: boolean;
  /** Ẩn số tiền (hiện •••) khi để màn hình chính ở nơi công cộng */
  hideAmounts: boolean;
  /** Nhãn riêng; trống = nhãn tự động */
  title: string;
};

export const DEFAULT_CONFIG: WidgetConfig = {
  metric: 'safe_today',
  period: 'month',
  cash: 'both',
  accountIds: [],
  budgetId: null,
  goalId: null,
  palette: 'auto',
  showBar: true,
  hideAmounts: false,
  title: '',
};

const oneOf = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : fallback;

/** Làm sạch dữ liệu đọc từ kho (có thể thiếu trường / phiên bản cũ) */
export function sanitizeConfig(raw: unknown): WidgetConfig {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    metric: oneOf(METRICS, r.metric, DEFAULT_CONFIG.metric),
    period: oneOf(PERIODS, r.period, DEFAULT_CONFIG.period),
    cash: oneOf(CASH_MODES, r.cash, DEFAULT_CONFIG.cash),
    accountIds: Array.isArray(r.accountIds) ? r.accountIds.filter((x): x is string => typeof x === 'string') : [],
    budgetId: typeof r.budgetId === 'string' ? r.budgetId : null,
    goalId: typeof r.goalId === 'string' ? r.goalId : null,
    palette: oneOf(PALETTES, r.palette, DEFAULT_CONFIG.palette),
    showBar: typeof r.showBar === 'boolean' ? r.showBar : DEFAULT_CONFIG.showBar,
    hideAmounts: typeof r.hideAmounts === 'boolean' ? r.hideAmounts : DEFAULT_CONFIG.hideAmounts,
    title: typeof r.title === 'string' ? r.title.slice(0, 24) : '',
  };
}

const keyOf = (widgetId: number) => `jwp-widget:${widgetId}`;

export function getWidgetConfig(widgetId: number): WidgetConfig {
  try {
    const text = Storage.getItemSync(keyOf(widgetId));
    return sanitizeConfig(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveWidgetConfig(widgetId: number, config: WidgetConfig): void {
  try {
    Storage.setItemSync(keyOf(widgetId), JSON.stringify(sanitizeConfig(config)));
  } catch {
    // Kho không ghi được thì widget dùng cấu hình mặc định — không làm hỏng app
  }
}

export function deleteWidgetConfig(widgetId: number): void {
  try {
    Storage.removeItemSync(keyOf(widgetId));
  } catch {
    // bỏ qua
  }
}

/** Màu nền theo bảng màu (auto = theo trạng thái, xem tone) */
export const PALETTE_COLORS: Record<Exclude<Palette, 'auto'>, { from: string; to: string }> = {
  purple: { from: '#6B4AF1', to: '#2563EB' },
  blue: { from: '#0EA5E9', to: '#2563EB' },
  green: { from: '#16A34A', to: '#0F766E' },
  orange: { from: '#F59E0B', to: '#EA580C' },
  rose: { from: '#EC4899', to: '#BE123C' },
  dark: { from: '#1F2937', to: '#0B1020' },
};

export const TONE_COLORS = {
  info: PALETTE_COLORS.purple,
  ok: PALETTE_COLORS.purple,
  low: PALETTE_COLORS.orange,
  over: { from: '#E11D48', to: '#9F1239' },
} as const;
