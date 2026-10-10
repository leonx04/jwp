// Chạy migration trước khi hiển thị app: DB luôn đúng cấu trúc mới nhất khi màn hình truy vấn.
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';

import migrations from '../../drizzle/migrations';
import { db } from './client';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  const { colors, spacing } = useTheme();

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: spacing.xl,
          gap: spacing.md,
          backgroundColor: colors.background,
        }}
      >
        <AppText variant="title">Không mở được dữ liệu</AppText>
        <AppText color="textMuted">
          Cập nhật cấu trúc cơ sở dữ liệu thất bại. Dữ liệu cũ vẫn còn nguyên trong máy.
        </AppText>
        <AppText variant="caption" color="expense" selectable>
          {error.message}
        </AppText>
      </View>
    );
  }

  if (!success) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return children;
}
