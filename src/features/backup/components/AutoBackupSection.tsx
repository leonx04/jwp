// Mục "Sao lưu tự động" trong màn Sao lưu: bật/tắt, tần suất, thư mục ngoài, sao lưu ngay.
import { t } from '@/lib/i18n';
import { useState } from 'react';
import { View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, Chip, ListRow, SectionTitle, SwitchRow } from '@/components/ui';
import { db } from '@/db';
import { formatDate, toVnDate, toVnTime } from '@/lib/date';

import {
  backupNow,
  getAutoBackupConfig,
  pickBackupFolder,
  setAutoBackupConfig,
  type AutoBackupConfig,
} from '../auto';

const FREQUENCIES = [
  { days: 1, label: 'Mỗi ngày' },
  { days: 3, label: '3 ngày' },
  { days: 7, label: 'Mỗi tuần' },
] as const;

export function AutoBackupSection() {
  const [config, setConfig] = useState<AutoBackupConfig>(getAutoBackupConfig);
  const update = (patch: Partial<AutoBackupConfig>) => setConfig(setAutoBackupConfig(patch));

  const now = () => {
    const result = backupNow(db);
    setConfig(getAutoBackupConfig());
    showSnackbar({
      text: result.ok
        ? t('Đã sao lưu: {name}', { name: result.name })
        : (result.error ?? 'Sao lưu chưa thành công'),
      tone: result.ok ? 'success' : 'error',
    });
  };

  const chooseFolder = async () => {
    const next = await pickBackupFolder();
    if (next) setConfig(next);
  };

  return (
    <>
      <SectionTitle tone="section">Sao lưu tự động</SectionTitle>
      <Card style={{ gap: 12, paddingVertical: 8 }}>
        <SwitchRow
          icon="shield-checkmark-outline"
          title="Tự sao lưu khi mở app"
          subtitle="Lưu file JSON đầy đủ, giữ vài bản gần nhất"
          value={config.enabled}
          onValueChange={(enabled) => {
            update({ enabled });
            if (enabled) now();
          }}
        />
        {config.enabled ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12 }}>
              {FREQUENCIES.map((f) => (
                <Chip
                  key={f.days}
                  label={f.label}
                  selected={config.everyDays === f.days}
                  onPress={() => update({ everyDays: f.days })}
                />
              ))}
            </View>
            <ListRow
              icon="folder-open-outline"
              title="Thư mục lưu bản sao"
              subtitle={
                config.folderName
                  ? t('{folderName} — chạm để đổi', { folderName: config.folderName })
                  : 'Chưa chọn — chọn Drive / thẻ nhớ để mất máy vẫn còn bản sao'
              }
              onPress={chooseFolder}
            />
          </>
        ) : null}
        <View style={{ paddingHorizontal: 12, gap: 8 }}>
          <AppText variant="caption" color={config.lastError ? 'warning' : 'textMuted'}>
            {config.lastError
              ? config.lastError
              : config.lastAt
                ? t('Lần gần nhất: {lastAt} {lastAt2}', {
                    lastAt: formatDate(toVnDate(config.lastAt)),
                    lastAt2: toVnTime(config.lastAt),
                  })
                : 'Chưa sao lưu lần nào.'}
          </AppText>
          <Button
            title="Sao lưu ngay"
            size="sm"
            variant="secondary"
            icon="save-outline"
            onPress={now}
          />
          <AppText variant="caption" color="textMuted">
            Bản sao luôn nằm trong thư mục riêng của app; chọn thêm thư mục ngoài để không mất khi
            gỡ app hoặc đổi máy.
          </AppText>
        </View>
      </Card>
    </>
  );
}
