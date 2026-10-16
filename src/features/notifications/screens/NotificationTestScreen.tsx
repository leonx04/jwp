// Màn "Kiểm tra thông báo" (spike Giai đoạn 0): thử popup, nút hành động, hẹn giờ khi app đã tắt.
import { t } from '@/lib/i18n';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  ListRow,
  Screen,
  SectionTitle,
  SwitchRow,
} from '@/components/ui';
import { db } from '@/db';
import { useSettings } from '@/features/settings';
import { sendMorningBriefingPreview } from '../morningBriefing';

import { notificationsSupported } from '../module';
import { useResponseLog } from '../responseLog';
import {
  cancelAllScheduled,
  getScheduledCount,
  samplePaymentReminder,
  scheduleAt,
  scheduleIn,
} from '../scheduling';
import { getPermissionState, requestPermission, type PermissionState } from '../setup';

const PERMISSION_TEXT: Record<PermissionState, string> = {
  granted: 'Đã cho phép',
  denied: 'Đã bị chặn — mở Cài đặt để bật lại',
  undetermined: 'Chưa cho phép — bấm Cấp quyền',
  unsupported: 'Không hỗ trợ trong Expo Go',
};

const scheduleQuickTest = () => scheduleIn(5, samplePaymentReminder(30));

const scheduleExactTest = () =>
  scheduleAt(new Date(Date.now() + 120_000), {
    title: '💰 Hôm nay nhận lương 15.000.000 ₫',
    body: 'Thử thông báo hẹn giờ khi app đã tắt hẳn',
    channel: 'income',
    data: { url: '/settings/notifications' },
  });

function formatTime(ms: number) {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => n.toString().padStart(2, '0'))
    .join(':');
}

export function NotificationTestScreen() {
  if (!notificationsSupported) return <UnsupportedNotice />;
  return <NotificationTester />;
}

/** Expo Go Android không chạy được expo-notifications (SDK 53+) */
function UnsupportedNotice() {
  return (
    <Screen title="Thông báo">
      <Card>
        <EmptyState
          icon="notifications-off-outline"
          title="Cần bản cài riêng (dev build)"
          description={
            'Từ SDK 53, Expo Go trên Android không chạy được thư viện thông báo.\n' +
            'Các phần khác của JWP vẫn dùng bình thường trong Expo Go. ' +
            'Để thử thông báo, cài bản JWP riêng: npx expo run:android'
          }
        />
      </Card>
    </Screen>
  );
}

function NotificationTester() {
  const prefs = useSettings((s) => s.notifications);
  const updateNotifications = useSettings((s) => s.updateNotifications);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [scheduled, setScheduled] = useState(0);
  const entries = useResponseLog((s) => s.entries);

  const refresh = useCallback(() => {
    getPermissionState()
      .then(setPermission)
      .catch(() => {});
    getScheduledCount()
      .then(setScheduled)
      .catch(() => {});
  }, []);

  useFocusEffect(refresh);

  const ensurePermission = async () => {
    const state = await requestPermission();
    setPermission(state);
    if (state !== 'granted') {
      Alert.alert('Chưa có quyền thông báo', 'Mở Cài đặt → Thông báo → bật cho Expo Go / JWP.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Mở Cài đặt', onPress: () => Linking.openSettings() },
      ]);
    }
    return state === 'granted';
  };

  const run = (task: () => Promise<unknown>, message: string) => async () => {
    if (!(await ensurePermission())) return;
    try {
      await task();
      refresh();
      Alert.alert('Đã hẹn', message);
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen title="Thông báo">
      <Card>
        <ListRow
          icon="notifications-outline"
          title="Quyền thông báo"
          subtitle={PERMISSION_TEXT[permission]}
          right={
            permission === 'granted' ? null : (
              <Button title="Cấp quyền" onPress={ensurePermission} style={{ minHeight: 36 }} />
            )
          }
        />
        <ListRow
          icon="time-outline"
          title="Đang chờ gửi"
          subtitle={t('{scheduled} thông báo đã hẹn', { scheduled })}
          right={
            scheduled > 0 ? (
              <Button
                title="Huỷ hết"
                variant="secondary"
                style={{ minHeight: 36 }}
                onPress={async () => {
                  await cancelAllScheduled();
                  refresh();
                }}
              />
            ) : null
          }
        />
      </Card>

      <SectionTitle>Báo cáo buổi sáng</SectionTitle>
      <Card style={{ gap: 12 }}>
        <SwitchRow
          icon="sunny-outline"
          title="Báo cáo mỗi sáng"
          subtitle="Số dư các ví, hôm nay được tiêu bao nhiêu, bill sắp đến hạn"
          value={prefs.enabled && prefs.morningBriefing}
          onValueChange={(on) => {
            updateNotifications(
              on ? { enabled: true, morningBriefing: true } : { morningBriefing: false },
            );
            if (on && permission !== 'granted') void ensurePermission();
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['06:30', '07:00', '07:30', '08:00', '09:00'].map((t) => (
            <Chip
              key={t}
              label={t}
              selected={prefs.morningBriefingTime === t}
              onPress={() => updateNotifications({ morningBriefingTime: t })}
            />
          ))}
        </View>
        <Button
          title="Gửi thử sau 3 giây"
          variant="secondary"
          onPress={() => sendMorningBriefingPreview(db, 3).catch(() => {})}
        />
      </Card>

      <SectionTitle>Nhắc hạn</SectionTitle>
      <Card style={{ gap: 12 }}>
        <SwitchRow
          icon="card-outline"
          title="Khoản phải trả & bill trả sau"
          subtitle="Nhắc trước hạn và đúng ngày, có nút Đã thanh toán"
          value={prefs.payments}
          onValueChange={(on) => updateNotifications({ payments: on })}
        />
        <SwitchRow
          icon="cash-outline"
          title="Khoản thu dự kiến"
          subtitle="Lương, tiền nhận định kỳ"
          value={prefs.income}
          onValueChange={(on) => updateNotifications({ income: on })}
        />
        <SwitchRow
          icon="people-outline"
          title="Hạn trả / đòi nợ"
          subtitle="Khoản trong Sổ nợ có đặt hạn"
          value={prefs.debts}
          onValueChange={(on) => updateNotifications({ debts: on })}
        />
        <SwitchRow
          icon="alert-circle-outline"
          title="Khoản quá hạn"
          subtitle="Một thông báo gộp mỗi ngày"
          value={prefs.overdue}
          onValueChange={(on) => updateNotifications({ overdue: on })}
        />
        <AppText variant="label" color="textMuted">
          NHẮC TRƯỚC HẠN
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[0, 1, 2, 3, 5].map((d) => (
            <Chip
              key={d}
              label={d === 0 ? 'Chỉ đúng ngày' : t('{d} ngày', { d })}
              selected={prefs.daysBefore === d}
              onPress={() => updateNotifications({ daysBefore: d })}
            />
          ))}
        </View>
        <AppText variant="label" color="textMuted">
          GIỜ NHẮC
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['08:00', '09:00', '12:00', '18:00', '20:00'].map((t) => (
            <Chip
              key={t}
              label={t}
              selected={prefs.time === t}
              onPress={() => updateNotifications({ time: t })}
            />
          ))}
        </View>
        <AppText variant="caption" color="textMuted">
          Không gửi trong {prefs.quietStart}–{prefs.quietEnd}. Khoản trong Lịch có thể đặt riêng số
          ngày và giờ nhắc.
        </AppText>
      </Card>

      <SectionTitle>Thử nghiệm</SectionTitle>
      <Card>
        <AppText color="textMuted">
          Bấm nút rồi về màn hình chính (hoặc khoá máy) để xem popup. Kéo thông báo xuống để thấy
          các nút: Đã thanh toán · Nhắc lại sau · Mở.
        </AppText>
        <Button
          icon="flash-outline"
          title="Gửi sau 5 giây (có nút hành động)"
          onPress={run(
            scheduleQuickTest,
            'Thông báo sẽ đến sau 5 giây. "Nhắc lại sau" sẽ hẹn lại sau 30 giây.',
          )}
        />
        <Button
          icon="alarm-outline"
          variant="secondary"
          title="Hẹn đúng giờ sau 2 phút"
          onPress={run(
            scheduleExactTest,
            'Hãy vuốt tắt hẳn app (xoá khỏi đa nhiệm) rồi chờ 2 phút.',
          )}
        />
      </Card>

      <SectionTitle>Phản hồi đã nhận</SectionTitle>
      <Card>
        {entries.length === 0 ? (
          <AppText color="textMuted">
            Chưa có. Bấm vào thông báo hoặc một nút trên thông báo.
          </AppText>
        ) : (
          entries.map((entry) => (
            <View key={`${entry.at}-${entry.action}`}>
              <AppText variant="bodyMedium">
                {formatTime(entry.at)} · {entry.action}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {entry.source === 'cold-start' ? 'Mở app từ trạng thái tắt · ' : ''}
                {entry.title}
              </AppText>
            </View>
          ))
        )}
      </Card>

      <SectionTitle>Máy Huawei (EMUI)</SectionTitle>
      <Card>
        <AppText color="textMuted">
          1. Cài đặt → Thông báo → Expo Go/JWP → bật Cho phép, Biểu ngữ, Màn hình khoá.{'\n'}
          2. Cài đặt → Pin → Khởi chạy ứng dụng → Expo Go/JWP → Quản lý thủ công, bật cả 3 mục.
          {'\n'}
          3. Nếu thông báo đến trễ vài phút: bình thường với Expo Go; bản cài riêng (dev build) sẽ
          báo đúng giờ.
        </AppText>
        <Button
          icon="settings-outline"
          variant="secondary"
          title="Mở cài đặt của app"
          onPress={() => Linking.openSettings()}
        />
      </Card>
    </Screen>
  );
}
