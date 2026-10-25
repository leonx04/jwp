// Thẻ ở Hôm nay: nhắc bật sao lưu tự động khi đã có dữ liệu đáng giữ, hoặc báo sao lưu đang hỏng.
// Mất máy / gỡ app mà chưa có bản sao thì mất hết, nên nhắc ngay trên màn hay mở nhất.
import { count } from 'drizzle-orm';
import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useState } from 'react';
import { View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, IconBadge } from '@/components/ui';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { SWATCH } from '@/theme';

import {
  backupNow,
  backupNudge,
  getAutoBackupConfig,
  NUDGE_SNOOZE_DAYS,
  setAutoBackupConfig,
} from '../auto';

const SNOOZE_KEY = 'jwp.backupNudgeSnoozedUntil';

const readSnooze = (): number | null => {
  try {
    const raw = Storage.getItemSync(SNOOZE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
};

const COPY = {
  enable: {
    title: 'Bật sao lưu tự động',
    body: 'Dữ liệu chỉ nằm trong máy này. Bật để app tự lưu bản sao vài ngày một lần.',
    color: SWATCH.amber,
    icon: 'shield-checkmark-outline',
  },
  failing: {
    title: 'Sao lưu tự động đang lỗi',
    body: 'Lần sao lưu gần nhất chưa thành công. Mở để xem lỗi và chọn lại thư mục.',
    color: SWATCH.red,
    icon: 'alert-circle-outline',
  },
  stale: {
    title: 'Lâu rồi chưa sao lưu',
    body: 'Đã quá hạn sao lưu nhiều lần. Mở để sao lưu ngay.',
    color: SWATCH.orange,
    icon: 'time-outline',
  },
} as const;

export function BackupNudge() {
  const [config, setConfig] = useState(getAutoBackupConfig);
  const [snoozedUntil, setSnoozedUntil] = useState(readSnooze);
  // Mốc thời gian lúc mở màn (Date.now() trong render không thuần)
  const [now] = useState(() => Date.now());
  const { data: total } = useLiveData(
    ['transactions'],
    () => db.select({ n: count() }).from(transactions).get()?.n ?? 0,
  );
  if (total == null) return null;
  const nudge = backupNudge(config, { transactions: total, now, snoozedUntil });
  if (!nudge) return null;
  const copy = COPY[nudge];

  const enable = () => {
    setAutoBackupConfig({ enabled: true });
    const result = backupNow(db);
    setConfig(getAutoBackupConfig());
    showSnackbar(
      result.ok
        ? {
            text: 'Đã bật sao lưu tự động',
            tone: 'success',
            actionLabel: 'Chọn thư mục',
            onAction: () => router.push('/backup'),
          }
        : { text: 'Sao lưu chưa thành công', tone: 'error' },
    );
  };

  const snooze = () => {
    const until = now + NUDGE_SNOOZE_DAYS * 86_400_000;
    try {
      Storage.setItemSync(SNOOZE_KEY, String(until));
    } catch {
      // bỏ qua: thẻ sẽ hiện lại lần sau
    }
    setSnoozedUntil(until);
  };

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBadge icon={copy.icon} color={copy.color} size={40} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium">{copy.title}</AppText>
          <AppText variant="caption" color="textMuted">
            {copy.body}
          </AppText>
        </View>
      </View>
      {nudge === 'enable' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Để sau" variant="secondary" style={{ flex: 1 }} onPress={snooze} />
          <Button title="Bật ngay" style={{ flex: 1 }} onPress={enable} />
        </View>
      ) : (
        <Button title="Mở sao lưu" variant="secondary" onPress={() => router.push('/backup')} />
      )}
    </Card>
  );
}
