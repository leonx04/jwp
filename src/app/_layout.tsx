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
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DatabaseProvider } from '@/db';
import { useNotificationResponses } from '@/features/notifications';
import { AppThemeProvider } from '@/features/settings';
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

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <DatabaseProvider>
          <RootNavigator />
        </DatabaseProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const theme = useTheme();
  useNotificationResponses();

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
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontFamily: theme.fonts.semibold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings/appearance" options={{ title: 'Giao diện' }} />
        <Stack.Screen name="settings/notifications" options={{ title: 'Kiểm tra thông báo' }} />
        <Stack.Screen
          name="transaction/new"
          options={{ title: 'Thêm giao dịch', presentation: 'modal' }}
        />
      </Stack>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
