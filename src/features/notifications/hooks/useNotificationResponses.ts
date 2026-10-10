// Xử lý khi người dùng bấm thông báo hoặc nút hành động. Gắn MỘT lần ở root layout.
import type { NotificationResponse } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { ACTIONS } from '../config';
import { loadNotifications, type NotificationsModule } from '../module';
import { useResponseLog, type ResponseLogEntry } from '../responseLog';
import type { NotificationData } from '../scheduling';
import { initNotifications } from '../setup';

const ACTION_LABEL: Record<string, string> = {
  [ACTIONS.markPaid]: 'Đã thanh toán',
  [ACTIONS.snooze]: 'Nhắc lại sau',
  [ACTIONS.open]: 'Mở',
};

// Một phản hồi có thể đến từ cả hai đường (mở app nguội + listener) → chỉ xử lý một lần
const handled = new Set<string>();

const logError = (error: unknown) => console.warn('[notifications] xử lý phản hồi lỗi:', error);

async function handleResponse(
  N: NotificationsModule,
  response: NotificationResponse,
  source: ResponseLogEntry['source'],
) {
  const { actionIdentifier, notification } = response;
  const { content, identifier } = notification.request;
  const key = `${identifier}:${actionIdentifier}:${notification.date}`;
  if (handled.has(key)) return;
  handled.add(key);

  const data = (content.data ?? {}) as NotificationData;
  useResponseLog.getState().add({
    at: Date.now(),
    action:
      actionIdentifier === N.DEFAULT_ACTION_IDENTIFIER
        ? 'Bấm vào thông báo'
        : (ACTION_LABEL[actionIdentifier] ?? actionIdentifier),
    title: content.title ?? '',
    source,
  });

  // Android không tự ẩn thông báo khi bấm nút hành động → ẩn thủ công
  await N.dismissNotificationAsync(identifier).catch(() => {});

  if (actionIdentifier === ACTIONS.snooze) {
    await N.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data: content.data,
        sound: 'default',
        categoryIdentifier: content.categoryIdentifier ?? undefined,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: data.snoozeSeconds ?? 3600,
        channelId: data.channel,
      },
    });
    return;
  }

  if (data.url) router.push(data.url as Href);
}

export function useNotificationResponses() {
  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const N = await loadNotifications();
      if (!N || cancelled) return;
      await initNotifications();

      // App đang tắt hẳn, người dùng bấm thông báo để mở → phản hồi có trước khi listener kịp gắn
      const coldStart = N.getLastNotificationResponse();
      if (coldStart) {
        await handleResponse(N, coldStart, 'cold-start');
        N.clearLastNotificationResponse();
      }

      subscription = N.addNotificationResponseReceivedListener((response) => {
        handleResponse(N, response, 'listener').catch(logError);
      });
    })().catch(logError);

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);
}
