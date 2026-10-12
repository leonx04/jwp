// Cài đặt người dùng. Lưu bằng kv-store của expo-sqlite.
// Đọc ĐỒNG BỘ khi tạo store → theme đúng ngay khung hình đầu tiên, không nháy sáng/tối khi mở app.
// Thêm trường mới: chỉ cần thêm vào SettingsState + DEFAULT_SETTINGS (persist tự gộp giá trị mặc định).
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { CurrencySymbol } from '@/lib/money';
import { DEFAULT_ACCENT, type AccentKey, type ThemePreference } from '@/theme';

const syncStorage: StateStorage = {
  getItem: (name) => Storage.getItemSync(name),
  setItem: (name, value) => Storage.setItemSync(name, value),
  removeItem: (name) => {
    Storage.removeItemSync(name);
  },
};

export type NotificationPrefs = {
  enabled: boolean;
  /** Giờ nhắc mặc định 'HH:mm' */
  time: string;
  /** Nhắc trước hạn chi bao nhiêu ngày (0 = chỉ nhắc đúng ngày) */
  daysBefore: number;
  payments: boolean;
  income: boolean;
  overdue: boolean;
  debts: boolean;
  budgets: boolean;
  /** (cũ, chưa dùng) — thay bằng morningBriefing */
  morningSummary: boolean;
  /** Báo cáo buổi sáng: số dư từng ví, hôm nay được tiêu bao nhiêu, còn mấy ngày tới lương, bill */
  morningBriefing: boolean;
  /** Giờ gửi báo cáo buổi sáng 'HH:mm' */
  morningBriefingTime: string;
  dailyLog: boolean;
  dailyLogTime: string;
  /** Giờ yên lặng: không gửi thông báo trong khoảng này */
  quietStart: string;
  quietEnd: string;
};

export type SettingsState = {
  themePreference: ThemePreference;
  amoled: boolean;
  accent: AccentKey;
  currencySymbol: CurrencySymbol;
  userName: string;
  /** Ngưỡng an toàn (đồng) cho dự trù dòng tiền — số dư dự kiến dưới mức này sẽ bị cảnh báo */
  safetyThreshold: number;
  /** Tháng thống kê bắt đầu từ ngày nào (1–31) */
  startDayOfMonth: number;
  /** Tính chuyển khoản như thu/chi trong thống kê (tuỳ chọn giống Ivy) */
  transfersAsIncomeExpense: boolean;
  hideBalance: boolean;
  suggestionsEnabled: boolean;
  notifications: NotificationPrefs;
  /** Đã hoàn tất màn bắt đầu (tạo dữ liệu mặc định hoặc import) */
  onboarded: boolean;
};

type SettingsActions = {
  update: (patch: Partial<SettingsState>) => void;
  updateNotifications: (patch: Partial<NotificationPrefs>) => void;
  setThemePreference: (value: ThemePreference) => void;
  setAmoled: (value: boolean) => void;
  setAccent: (value: AccentKey) => void;
  setCurrencySymbol: (value: CurrencySymbol) => void;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  time: '09:00',
  daysBefore: 1,
  payments: true,
  income: true,
  overdue: true,
  debts: true,
  budgets: true,
  morningSummary: false,
  morningBriefing: true,
  morningBriefingTime: '07:30',
  dailyLog: false,
  dailyLogTime: '21:00',
  quietStart: '22:00',
  quietEnd: '07:00',
};

export const DEFAULT_SETTINGS: SettingsState = {
  themePreference: 'system',
  amoled: false,
  accent: DEFAULT_ACCENT,
  currencySymbol: '₫',
  userName: '',
  safetyThreshold: 0,
  startDayOfMonth: 1,
  transfersAsIncomeExpense: false,
  hideBalance: false,
  suggestionsEnabled: true,
  notifications: DEFAULT_NOTIFICATION_PREFS,
  onboarded: false,
};

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof SettingsState)[];

/** Lấy phần dữ liệu (bỏ các hàm) — dùng khi lưu và khi xuất file sao lưu */
export function pickSettings(state: SettingsState): SettingsState {
  return Object.fromEntries(SETTING_KEYS.map((key) => [key, state[key]])) as SettingsState;
}

export const useSettings = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      updateNotifications: (patch) =>
        set((state) => ({ notifications: { ...state.notifications, ...patch } })),
      setThemePreference: (themePreference) => set({ themePreference }),
      setAmoled: (amoled) => set({ amoled }),
      setAccent: (accent) => set({ accent }),
      setCurrencySymbol: (currencySymbol) => set({ currencySymbol }),
    }),
    {
      name: 'jwp-settings',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
      partialize: (state) => pickSettings(state),
      // Gộp sâu cho object lồng nhau (notifications) để trường mới có giá trị mặc định
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...saved,
          notifications: { ...DEFAULT_NOTIFICATION_PREFS, ...saved.notifications },
        };
      },
    },
  ),
);

/** Đọc cài đặt ngoài React (trong hàm xử lý, scheduler thông báo...) */
export const getSettings = (): SettingsState => pickSettings(useSettings.getState());
