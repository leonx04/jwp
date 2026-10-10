import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { buildTheme, type Theme } from './buildTheme';
import { DEFAULT_ACCENT, type AccentKey } from './palettes';

export type ThemePreference = 'system' | 'light' | 'dark';

const ThemeContext = createContext<Theme>(buildTheme({ dark: false, accent: DEFAULT_ACCENT }));

type ThemeProviderProps = {
  preference: ThemePreference;
  amoled: boolean;
  accent: AccentKey;
  children: ReactNode;
};

export function ThemeProvider({ preference, amoled, accent, children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const dark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';
  const theme = useMemo(() => buildTheme({ dark, amoled, accent }), [dark, amoled, accent]);

  // Màu nền native phía sau React (lộ ra khi chuyển màn / bàn phím mở) → tránh nháy trắng ở chế độ tối
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
  }, [theme.colors.background]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Tạo hook style phụ thuộc theme. Khai báo ngoài component:
 *   const useStyles = createStyles((t) => ({ box: { backgroundColor: t.colors.surface } }));
 * rồi trong component: const styles = useStyles();
 */
export function createStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
