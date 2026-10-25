// Màn lỗi an toàn: một màn hình bị lỗi khi hiển thị thì hiện màn này thay vì trắng trơn.
// Không phụ thuộc cây React đã hỏng: tự dựng theme, đọc DB trực tiếp để xuất bản sao lưu ngay.
import type { ErrorBoundaryProps } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { db } from '@/db/client';
import { shareFile, writeTextFile } from '@/features/backup/fileIO';
import {
  collectBackupData,
  createJwpBackup,
  serializeJwpBackup,
} from '@/features/backup/jwp/export';
import { AppThemeProvider } from '@/features/settings/components/AppThemeProvider';
import { getSettings } from '@/features/settings/store';
import { createStyles } from '@/theme';

const stamp = () =>
  new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '');

/** Ghi toàn bộ dữ liệu ra file JSON rồi mở hộp chia sẻ (Drive, Zalo, email…) */
export async function exportEmergencyBackup(): Promise<void> {
  const data = collectBackupData(db, getSettings());
  const file = writeTextFile(
    `JWP-backup-${stamp()}.json`,
    serializeJwpBackup(createJwpBackup(data)),
  );
  await shareFile(file, 'application/json', 'Sao lưu JWP');
}

type BackupState = 'idle' | 'working' | 'done' | 'failed';

function SafeMode({ error, retry }: ErrorBoundaryProps) {
  const styles = useStyles();
  const [backup, setBackup] = useState<BackupState>('idle');
  const [backupError, setBackupError] = useState('');

  const runBackup = async () => {
    setBackup('working');
    try {
      await exportEmergencyBackup();
      setBackup('done');
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : String(e));
      setBackup('failed');
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <AppText variant="title">Có lỗi khi hiển thị</AppText>
      <AppText color="textMuted">
        Dữ liệu của bạn vẫn nằm nguyên trong máy. Bấm Thử lại; nếu vẫn lỗi, hãy xuất một bản sao lưu
        trước khi cập nhật hoặc cài lại app.
      </AppText>
      <View style={styles.actions}>
        <Button title="Thử lại" icon="refresh" onPress={() => void retry()} />
        <Button
          title={backup === 'working' ? 'Đang sao lưu…' : 'Xuất bản sao lưu'}
          icon="save-outline"
          variant="secondary"
          disabled={backup === 'working'}
          onPress={() => void runBackup()}
        />
      </View>
      {backup === 'done' ? (
        <AppText color="income">Đã tạo bản sao lưu.</AppText>
      ) : backup === 'failed' ? (
        <AppText color="expense">Chưa sao lưu được: {backupError}</AppText>
      ) : null}
      <View style={styles.detail}>
        <AppText variant="label" color="textMuted">
          Chi tiết lỗi (gửi cho người phát triển)
        </AppText>
        <AppText variant="caption" selectable>
          {error.message}
        </AppText>
      </View>
    </ScrollView>
  );
}

/** Dùng làm `export { SafeModeBoundary as ErrorBoundary }` trong file layout của expo-router */
export function SafeModeBoundary(props: ErrorBoundaryProps) {
  console.error('[safe-mode]', props.error);
  return (
    <AppThemeProvider>
      <SafeMode {...props} />
    </AppThemeProvider>
  );
}

const useStyles = createStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: t.spacing.xl, paddingTop: 72, gap: t.spacing.md },
  actions: { gap: t.spacing.sm, marginTop: t.spacing.sm },
  detail: {
    marginTop: t.spacing.lg,
    padding: t.spacing.md,
    gap: t.spacing.xs,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceAlt,
  },
}));
