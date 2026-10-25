// Chạy migration trước khi hiển thị app: DB luôn đúng cấu trúc mới nhất khi màn hình truy vấn.
// Có bản nâng cấp mới → chụp lại DB trước (backups/db), lỡ migration hỏng vẫn gửi được file cũ đi.
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { File } from 'expo-file-system';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { shareFile } from '@/features/backup/fileIO';
import { exportEmergencyBackup } from '@/features/startup/SafeModeScreen';
import { useTheme } from '@/theme';

import migrations from '../../drizzle/migrations';
import { db } from './client';
import { takePreMigrationSnapshot } from './preMigrationSnapshot';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  // Chụp đúng một lần, trước khi useMigrations chạy (effect chạy sau lần render đầu)
  const [snapshot] = useState(() => takePreMigrationSnapshot());
  const { success, error } = useMigrations(db, migrations);
  const { colors } = useTheme();

  if (error) return <MigrationFailed message={error.message} snapshot={snapshot} />;

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

function MigrationFailed({ message, snapshot }: { message: string; snapshot: File | null }) {
  const { colors, spacing } = useTheme();
  const [status, setStatus] = useState('');

  const run = async (task: () => Promise<void>) => {
    setStatus('');
    try {
      await task();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };

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
      {snapshot ? (
        <Button
          title="Gửi bản chụp dữ liệu"
          icon="share-outline"
          onPress={() =>
            void run(() => shareFile(snapshot, 'application/x-sqlite3', 'Bản chụp dữ liệu JWP'))
          }
        />
      ) : null}
      <Button
        title="Xuất bản sao lưu"
        icon="save-outline"
        variant="secondary"
        onPress={() => void run(exportEmergencyBackup)}
      />
      {status ? <AppText color="expense">{status}</AppText> : null}
      <AppText variant="caption" color="expense" selectable>
        {message}
      </AppText>
    </View>
  );
}
