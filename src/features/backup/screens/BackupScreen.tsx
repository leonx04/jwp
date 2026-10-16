// Sao lưu: xuất JSON (JWP) / CSV, khôi phục từ file JSON (gộp hoặc thay thế).
import { t } from '@/lib/i18n';
import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
import { Alert } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { Card, ListRow, Screen, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { getSettings, useSettings } from '@/features/settings';

import { AutoBackupSection } from '../components/AutoBackupSection';
import { transactionsToCsv } from '../csv';
import { backupDirectory, pickFile, shareFile, writeTextFile } from '../fileIO';
import { collectBackupData, createJwpBackup, serializeJwpBackup } from '../jwp/export';
import { settingsPatchFromBackup } from '../jwp/format';
import { readJwpBackup } from '../jwp/read';
import { previewRestore, restoreBackup, type RestoreMode } from '../jwp/restore';

const stamp = () =>
  new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '');

export function BackupScreen() {
  const [busy, setBusy] = useState<string | null>(null);
  const update = useSettings((s) => s.update);

  const run = async (key: string, job: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await job();
    } catch (error) {
      Alert.alert('Chưa hoàn tất', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const exportJson = () =>
    run('json', async () => {
      const data = collectBackupData(db, getSettings());
      const file = writeTextFile(
        `JWP-backup-${stamp()}.json`,
        serializeJwpBackup(createJwpBackup(data)),
      );
      await shareFile(file, 'application/json', 'Sao lưu JWP');
    });

  const exportCsv = () =>
    run('csv', async () => {
      const data = collectBackupData(db, getSettings());
      const file = writeTextFile(`JWP-giao-dich-${stamp()}.csv`, transactionsToCsv(data));
      await shareFile(file, 'text/csv', 'Giao dịch (CSV)');
    });

  const restore = () =>
    run('restore', async () => {
      const picked = await pickFile(['application/json', '*/*']);
      if (!picked) return;
      const backup = readJwpBackup(picked.bytes);
      const preview = previewRestore(db, backup);
      const types = preview.transactionTypes;
      const summary = t(
        '{length} ví · {length2} giao dịch ({expense} chi, {income} thu, {transfer} chuyển)',
        {
          length: backup.data.accounts.length,
          length2: backup.data.transactions.length,
          expense: types.expense,
          income: types.income,
          transfer: types.transfer,
        },
      );
      const apply = (mode: RestoreMode) => {
        try {
          restoreBackup(db, backup, mode, {
            beforeReplace: () => {
              const current = createJwpBackup(collectBackupData(db, getSettings()));
              writeTextFile(
                `truoc-khi-khoi-phuc-${stamp()}.json`,
                serializeJwpBackup(current),
                backupDirectory(),
              );
            },
          });
          if (mode === 'replace') update(settingsPatchFromBackup(backup.data.settings));
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSnackbar({ text: 'Đã khôi phục dữ liệu', tone: 'success' });
        } catch (error) {
          Alert.alert('Khôi phục lỗi', error instanceof Error ? error.message : String(error));
        }
      };
      Alert.alert('Khôi phục từ file?', `${picked.name}\n${summary}`, [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Gộp thêm vào hiện tại', onPress: () => apply('merge') },
        {
          text: 'Thay thế toàn bộ',
          style: 'destructive',
          onPress: () => apply('replace'),
        },
      ]);
    });

  return (
    <Screen title="Sao lưu & xuất dữ liệu">
      <SectionTitle tone="section">Xuất</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 6 }}>
        <ListRow
          icon="cloud-upload-outline"
          title="Sao lưu đầy đủ (JSON)"
          subtitle="Ví, danh mục, giao dịch, lịch, cài đặt — gửi qua Zalo / Drive"
          onPress={exportJson}
        />
        <ListRow
          icon="document-text-outline"
          title="Xuất giao dịch (CSV)"
          subtitle="Mở bằng Excel / Google Sheets"
          onPress={exportCsv}
        />
      </Card>
      <AutoBackupSection />
      <SectionTitle tone="section">Khôi phục</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 6 }}>
        <ListRow
          icon="cloud-download-outline"
          title="Khôi phục từ file JSON"
          subtitle="Chọn file sao lưu JWP. Khi thay thế, dữ liệu hiện tại được lưu lại trước"
          onPress={restore}
        />
      </Card>
    </Screen>
  );
}
