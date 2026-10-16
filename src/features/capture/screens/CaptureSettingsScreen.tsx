// Cài đặt "Tự đọc thông báo": bật, cấp quyền, chọn app, hướng dẫn Huawei, thử mẫu, nhật ký thông báo.
import { t } from '@/lib/i18n';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import {
  AppText,
  Button,
  Card,
  ListRow,
  Screen,
  SectionTitle,
  SwitchRow,
  TextField,
} from '@/components/ui';
import { db } from '@/db';
import { listAccounts } from '@/features/accounts/repository';
import { BANKS } from '@/lib/banks';
import { formatDate, toVnDate, toVnTime } from '@/lib/date';

import {
  captureAvailable,
  isListenerEnabled,
  openListenerSettings,
} from '../../../../modules/jwp-notif';
import { getCaptureConfig, setCaptureConfig, type CaptureConfig } from '../config';
import { syncCaptures, usePendingCaptureCount, useRecentCaptures } from '../hooks';
import { KNOWN_PACKAGES, type RawCapture } from '../parse';
import { clearCaptureLog, ingestCaptures } from '../repository';

const SAMPLES: RawCapture[] = [
  {
    source: 'sms',
    sender: 'MBBANK',
    title: '',
    text: 'TK 0123456789 | GD: +500,000VND | SD: 1,234,567VND | ND: NGUYEN VAN A chuyen tien',
    postedAt: Date.now(),
  },
  {
    source: 'notification',
    sender: 'com.mservice.momotransfer',
    title: 'Thanh toán thành công',
    text: 'Thanh toán 35.000đ cho Highlands Coffee',
    postedAt: Date.now() - 60_000,
  },
];

const STATUS_LABEL = {
  pending: 'Chờ xác nhận',
  accepted: 'Đã ghi',
  dismissed: 'Đã bỏ qua',
  unparsed: 'Không đọc được',
} as const;

export function CaptureSettingsScreen() {
  const [config, setConfig] = useState<CaptureConfig>(getCaptureConfig);
  const [granted, setGranted] = useState(isListenerEnabled);
  const pending = usePendingCaptureCount();
  const { data: log = [] } = useRecentCaptures();

  // Quay lại từ màn cài đặt hệ thống → đọc lại trạng thái quyền
  useEffect(() => {
    const sub = AppState.addEventListener(
      'change',
      (s) => s === 'active' && setGranted(isListenerEnabled()),
    );
    return () => sub.remove();
  }, []);

  const update = useCallback(
    (patch: Partial<CaptureConfig>) => setConfig(setCaptureConfig(patch)),
    [],
  );

  const toggleEnabled = (value: boolean) => {
    update({ enabled: value });
    if (value) {
      syncCaptures();
      if (!isListenerEnabled()) {
        Alert.alert(
          'Cấp quyền truy cập thông báo',
          'Android sẽ mở danh sách ứng dụng được đọc thông báo. Chọn JWP và bật lên.',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Mở cài đặt', onPress: openListenerSettings },
          ],
        );
      }
    }
  };

  const toggleSms = async (value: boolean) => {
    if (value && Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        showSnackbar({ text: 'Chưa được cấp quyền đọc SMS', tone: 'error' });
        return;
      }
    }
    update({ sms: value });
    syncCaptures();
  };

  const togglePackage = (pkg: string, on: boolean) =>
    update({
      packages: on
        ? [...new Set([...config.packages, pkg])]
        : config.packages.filter((p) => p !== pkg),
    });

  const addSamples = () => {
    const r = ingestCaptures(
      db,
      SAMPLES.map((s) => ({ ...s, postedAt: s.postedAt })),
      listAccounts(db),
    );
    showSnackbar({
      text: t('Đã thêm {pending} giao dịch mẫu vào hộp chờ', { pending: r.pending }),
      tone: 'success',
    });
  };

  const copyAll = async () => {
    const text = log
      .map((c) => `[${c.source} · ${c.sender} · ${STATUS_LABEL[c.status]}]\n${c.title}\n${c.body}`)
      .join('\n\n---\n\n');
    await Clipboard.setStringAsync(text);
    showSnackbar({ text: 'Đã chép nhật ký — dán cho mình để chỉnh bộ đọc', tone: 'success' });
  };

  return (
    <Screen title="Tự đọc thông báo">
      <AppText color="textMuted">
        App đọc thông báo (và SMS) biến động số dư của ngân hàng / ví điện tử ngay trên máy, rồi gợi
        ý ghi giao dịch. Không gửi đi đâu, không cần mật khẩu ngân hàng.
      </AppText>

      {!captureAvailable ? (
        <Card>
          <AppText color="warning">
            Bản app này chưa có module đọc thông báo (đang chạy Expo Go hoặc bản cài cũ). Cần cài
            bản JWP mới build.
          </AppText>
        </Card>
      ) : null}

      <Card style={{ gap: 0, paddingVertical: 6 }}>
        <SwitchRow
          icon="notifications-outline"
          title="Bật tự đọc"
          subtitle="Bắt thông báo của các app ngân hàng bên dưới"
          value={config.enabled}
          onValueChange={toggleEnabled}
          disabled={!captureAvailable}
        />
        <ListRow
          icon="shield-checkmark-outline"
          title="Quyền truy cập thông báo"
          subtitle={granted ? 'Đã bật' : 'Chưa bật — bấm để mở cài đặt hệ thống'}
          onPress={openListenerSettings}
        />
        <SwitchRow
          icon="chatbubble-ellipses-outline"
          title="Đọc cả SMS biến động số dư"
          subtitle="Chỉ tin nhắn từ tên chữ (MBBANK, TPBank…), không đọc số điện thoại cá nhân"
          value={config.sms}
          onValueChange={toggleSms}
          disabled={!captureAvailable}
        />
      </Card>

      <Button
        title={
          pending ? t('Xem {pending} giao dịch chờ xác nhận', { pending }) : 'Xem hộp chờ xác nhận'
        }
        variant={pending ? 'primary' : 'secondary'}
        icon="mail-unread-outline"
        onPress={() => router.push('/inbox')}
      />

      <Card style={{ gap: 0, paddingVertical: 6 }}>
        <ListRow
          icon="funnel-outline"
          title="Quy tắc phân loại"
          subtitle="Tự gán danh mục theo nội dung, tuỳ chọn tự ghi luôn"
          onPress={() => router.push('/capture-rules')}
        />
      </Card>

      <SectionTitle>Chuyển tiền giữa ví của bạn</SectionTitle>
      <Card style={{ gap: 4, paddingVertical: 6 }}>
        <TextField
          label="Tên của bạn"
          icon="person-outline"
          value={config.ownerName}
          onChangeText={(ownerName) => update({ ownerName })}
          placeholder="vd: Nguyễn Xuân Dũng"
        />
        <AppText variant="caption" color="textMuted" style={{ paddingHorizontal: 4 }}>
          Thông báo có tên này được gợi ý là chuyển giữa các ví của bạn. Khi một ngân hàng báo trừ
          và ngân hàng khác báo cộng đúng số tiền trong vòng 2 phút, app luôn gộp thành một lần
          chuyển tiền.
        </AppText>
        <SwitchRow
          icon="swap-horizontal-outline"
          title="Tự ghi khi đã gộp thành chuyển tiền"
          subtitle="Không cần bấm xác nhận cho các cặp trừ/cộng khớp nhau"
          value={config.autoTransfer}
          onValueChange={(autoTransfer) => update({ autoTransfer })}
        />
      </Card>

      <SectionTitle>App được đọc</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 6 }}>
        {Object.entries(KNOWN_PACKAGES).map(([pkg, code]) => (
          <SwitchRow
            key={pkg}
            title={BANKS.find((b) => b.code === code)?.name ?? code}
            subtitle={pkg}
            value={config.packages.includes(pkg)}
            onValueChange={(on) => togglePackage(pkg, on)}
          />
        ))}
      </Card>

      <Card style={{ gap: 6 }}>
        <AppText variant="bodyMedium">Máy Huawei: để app không bị tắt nền</AppText>
        <AppText variant="caption" color="textMuted">
          Cài đặt › Ứng dụng › Khởi chạy ứng dụng › JWP › chọn “Quản lý thủ công” rồi bật Tự động
          khởi chạy, Khởi chạy phụ, Chạy trong nền. Nếu không, hệ thống có thể giết dịch vụ đọc
          thông báo.
        </AppText>
      </Card>

      <SectionTitle>{t('Nhật ký ({length})', { length: log.length })}</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Thử bằng tin mẫu"
            size="sm"
            variant="secondary"
            icon="flask-outline"
            onPress={addSamples}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Chép nhật ký"
            size="sm"
            variant="secondary"
            icon="copy-outline"
            onPress={copyAll}
            disabled={!log.length}
          />
        </View>
      </View>
      {log.length ? (
        <Card style={{ gap: 12 }}>
          {log.slice(0, 20).map((c) => (
            <View key={c.id} style={{ gap: 2 }}>
              <AppText variant="caption" color={c.status === 'unparsed' ? 'warning' : 'textMuted'}>
                {c.source === 'sms' ? 'SMS' : 'Thông báo'} · {c.sender} ·{' '}
                {formatDate(toVnDate(c.postedAt))} {toVnTime(c.postedAt)} · {STATUS_LABEL[c.status]}
              </AppText>
              <AppText variant="caption" selectable>
                {[c.title, c.body].filter(Boolean).join('\n')}
              </AppText>
            </View>
          ))}
          <Button
            title="Xoá nhật ký"
            size="sm"
            variant="secondary"
            icon="trash-outline"
            onPress={() => clearCaptureLog(db)}
          />
        </Card>
      ) : (
        <AppText variant="caption" color="textMuted">
          Chưa bắt được thông báo nào. Khi có, nội dung gốc hiện ở đây để chỉnh bộ đọc nếu cần.
        </AppText>
      )}
    </Screen>
  );
}
