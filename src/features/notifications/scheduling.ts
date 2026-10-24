import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

import { PAYMENT_CATEGORY, type ChannelId } from './config';
import { loadNotifications, requireNotifications } from './module';
import { initNotifications } from './setup';

/** Dữ liệu đính kèm thông báo: khi bấm vào sẽ mở đường dẫn `url` trong app */
export type NotificationData = {
  url?: string;
  /** Kênh gốc — dùng lại khi hẹn nhắc lại */
  channel?: ChannelId;
  /** Số giây hẹn lại khi bấm "Nhắc lại sau" */
  snoozeSeconds?: number;
  /** Đường dẫn riêng cho nút hành động chính (vd sổ nợ: mở màn ghi lần trả) */
  actionUrl?: string;
};

type ReminderInput = {
  title: string;
  body: string;
  channel: ChannelId;
  /** Có nút Đã thanh toán / Nhắc lại sau / Mở */
  withActions?: boolean;
  data?: NotificationData;
};

function buildContent({ title, body, channel, withActions, data }: ReminderInput) {
  return {
    title,
    body,
    sound: 'default',
    data: { ...data, channel },
    ...(withActions ? { categoryIdentifier: PAYMENT_CATEGORY } : {}),
  };
}

export async function scheduleIn(seconds: number, input: ReminderInput): Promise<string> {
  const N = await requireNotifications();
  await initNotifications();
  return N.scheduleNotificationAsync({
    content: buildContent(input),
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(seconds)),
      channelId: input.channel,
    },
  });
}

export async function scheduleAt(date: Date, input: ReminderInput): Promise<string> {
  const N = await requireNotifications();
  await initNotifications();
  return N.scheduleNotificationAsync({
    content: buildContent(input),
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: input.channel,
    },
  });
}

/** Thông báo mẫu cho màn kiểm tra — dùng đúng định dạng tiền thật của app */
export function samplePaymentReminder(snoozeSeconds: number): ReminderInput {
  return {
    title: t('💸 Ngày mai: Tiền nhà {amount}', { amount: formatMoney(3_000_000) }),
    body: t('MB bank còn {amount} — có thể không đủ ⚠', { amount: formatMoney(60_279) }),
    channel: 'payments',
    withActions: true,
    data: { url: '/settings/notifications', snoozeSeconds },
  };
}

export async function getScheduledCount(): Promise<number> {
  const N = await loadNotifications();
  return N ? (await N.getAllScheduledNotificationsAsync()).length : 0;
}

export async function cancelAllScheduled(): Promise<void> {
  const N = await loadNotifications();
  await N?.cancelAllScheduledNotificationsAsync();
}
