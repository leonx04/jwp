// Cài đặt người dùng (theme, ký hiệu tiền...). Lưu bằng kv-store của expo-sqlite.
// Đọc ĐỒNG BỘ khi tạo store → theme đúng ngay khung hình đầu tiên, không nháy sáng/tối khi mở app.
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

export type SettingsState = {
  themePreference: ThemePreference;
  amoled: boolean;
  accent: AccentKey;
  currencySymbol: CurrencySymbol;
};

type SettingsActions = {
  setThemePreference: (value: ThemePreference) => void;
  setAmoled: (value: boolean) => void;
  setAccent: (value: AccentKey) => void;
  setCurrencySymbol: (value: CurrencySymbol) => void;
};

export const DEFAULT_SETTINGS: SettingsState = {
  themePreference: 'system',
  amoled: false,
  accent: DEFAULT_ACCENT,
  currencySymbol: '₫',
};

export const useSettings = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setThemePreference: (themePreference) => set({ themePreference }),
      setAmoled: (amoled) => set({ amoled }),
      setAccent: (accent) => set({ accent }),
      setCurrencySymbol: (currencySymbol) => set({ currencySymbol }),
    }),
    {
      name: 'jwp-settings',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
      // Chỉ lưu dữ liệu, không lưu các hàm set...
      partialize: ({ themePreference, amoled, accent, currencySymbol }) => ({
        themePreference,
        amoled,
        accent,
        currencySymbol,
      }),
    },
  ),
);
