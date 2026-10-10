import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { ThemeProvider } from '@/theme';

import { useSettings } from '../store';

/** Nối cài đặt người dùng (store) vào ThemeProvider. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { themePreference, amoled, accent } = useSettings(
    useShallow((s) => ({ themePreference: s.themePreference, amoled: s.amoled, accent: s.accent })),
  );
  return (
    <ThemeProvider preference={themePreference} amoled={amoled} accent={accent}>
      {children}
    </ThemeProvider>
  );
}
