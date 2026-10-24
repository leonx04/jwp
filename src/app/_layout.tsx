// Root layout: bọc toàn bộ app. Thứ tự Provider quan trọng:
// font → cử chỉ → theme → cơ sở dữ liệu (chạy migration) → điều hướng.
// File trong src/app/ chỉ "ghép" màn hình; logic nằm trong src/features/.
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
  useFonts,
} from '@expo-google-fonts/be-vietnam-pro';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppIntro } from '@/components/brand/AppIntro';
import { DialogHost } from '@/components/feedback/DialogHost';
import { Snackbar } from '@/components/feedback/Snackbar';
import { DatabaseProvider } from '@/db';
import { useNotificationResponses } from '@/features/notifications';
import { AppThemeProvider } from '@/features/settings';
import { useAutoBackup } from '@/features/backup/hooks';
import { useCaptureSync } from '@/features/capture/hooks';
import { useMorningBriefingSync } from '@/features/notifications/hooks/useMorningBriefingSync';
import { useWidgetSync } from '@/features/widget/useWidgetSync';
import { useStartupTasks } from '@/features/startup/useStartupTasks';
import { useLanguage } from '@/lib/i18n';
import '@/lib/i18n/patchAlert';
import { useTheme } from '@/theme';

// Giữ màn hình chờ đến khi font sẵn sàng → không bị nháy font mặc định
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  });
  const ready = fontsLoaded || fontError != null;
  // Đổi ngôn ngữ → dựng lại toàn bộ cây để mọi chuỗi t() được tính lại
  const language = useLanguage();

  if (!ready) return null;

  return (
    <GestureHandlerRootView key={language} style={{ flex: 1 }}>
      <AppThemeProvider>
        <DatabaseProvider>
          <RootNavigator />
        </DatabaseProvider>
        {/* Logo phủ lên đúng lúc ẩn màn chờ native → nối liền, không nháy */}
        <AppIntro onShown={() => SplashScreen.hideAsync().catch(() => {})} />
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const theme = useTheme();
  useNotificationResponses();
  useStartupTasks();
  useMorningBriefingSync();
  useWidgetSync();
  useCaptureSync();
  useAutoBackup();

  // Theme của thanh điều hướng / hiệu ứng chuyển màn theo theme của app
  const navigationTheme = useMemo(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.expense,
      },
    };
  }, [theme]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      {/* Mỗi màn tự vẽ header kính (components/ui/Screen) → tắt header mặc định */}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="transaction/new"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        {/* Các màn "tạo nhanh" trượt từ dưới lên như tờ giấy mới, khác với màn xem chi tiết trượt ngang */}
        <Stack.Screen
          name="quick-add"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="settings/widgets"
          options={{ animation: 'fade_from_bottom' }}
        />
      </Stack>
      <Snackbar />
      <DialogHost />
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
