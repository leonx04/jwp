// Công tắc "Khoá app" trong Cài đặt. Bật phải xác thực trước, để chắc máy mở khoá được.
import { useEffect, useState } from 'react';

import { SwitchRow } from '@/components/ui';
import { showDialog } from '@/components/feedback/dialogStore';
import { useSettings } from '@/features/settings/store';
import { t } from '@/lib/i18n';

import { authenticate, lockSupport, type LockSupport } from './lock';

const UNAVAILABLE: Record<Exclude<LockSupport, 'ok'>, string> = {
  'not-enrolled':
    'Máy chưa cài vân tay, khuôn mặt hay mã PIN. Cài trong Cài đặt của máy rồi bật lại.',
  unsupported: 'Bản cài này chưa có khoá app. Cập nhật app lên bản mới rồi bật lại.',
};

export function AppLockRow() {
  const enabled = useSettings((s) => s.appLock);
  const update = useSettings((s) => s.update);
  const [support, setSupport] = useState<LockSupport | null>(null);

  useEffect(() => {
    void lockSupport().then(setSupport);
  }, []);

  const toggle = async (next: boolean) => {
    if (!next) {
      if (await authenticate(t('Xác nhận tắt khoá app'))) update({ appLock: false });
      return;
    }
    const now = await lockSupport();
    setSupport(now);
    if (now !== 'ok') {
      showDialog({ title: 'Chưa bật được khoá app', message: UNAVAILABLE[now] });
      return;
    }
    if (await authenticate(t('Xác nhận bật khoá app'))) update({ appLock: true });
  };

  return (
    <SwitchRow
      icon="finger-print"
      title="Khoá app"
      subtitle={
        support && support !== 'ok' && !enabled
          ? 'Máy chưa hỗ trợ — chạm để xem cách bật'
          : 'Mở app bằng vân tay, khuôn mặt hoặc mã PIN của máy'
      }
      value={enabled}
      onValueChange={(next) => void toggle(next)}
    />
  );
}
