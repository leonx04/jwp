// Giữ các thông báo nhắc hạn luôn khớp dữ liệu: tính lại khi mở app / dữ liệu đổi, chỉ thay bản đã đổi.
// Định danh cố định 'reminder:<loại>:<khoá>:<before|due>@<ngày>' → hẹn lại không bị trùng.
import { t } from '@/lib/i18n';
import { Platform } from 'react-native';

import type { AppDatabase } from '@/db/types';
import { getAccountBalances } from '@/features/accounts/queries';
import { creditAccountOfBill, creditBillOccurrences, isCreditBill } from '@/features/credit/bills';
import { getCreditSummaries } from '@/features/credit/queries';
import { listDebts } from '@/features/debts/queries';
import { expandOccurrences } from '@/features/schedules/occurrences';
import { listOverrides, listSchedules } from '@/features/schedules/repository';
import { getSettings } from '@/features/settings/store';
import { addDays, todayVn } from '@/lib/date';
import { formatCompact } from '@/lib/money';

import { DEBT_CATEGORY, PAYMENT_CATEGORY } from './config';
import { loadNotifications, notificationsSupported } from './module';
import { REMINDER_PREFIX, buildReminders, type Reminder, type ReminderItem } from './reminders';
import type { NotificationData } from './scheduling';
import { initNotifications } from './setup';

const LOOKAHEAD_DAYS = 14;
/** Khoản quá hạn xa hơn thế này không nhắc nữa */
const LOOKBACK_DAYS = 30;
const SNOOZE_SECONDS = 3600;

const TYPE_FALLBACK = { income: 'Khoản thu', expense: 'Khoản chi', transfer: 'Chuyển khoản' };

/** Đọc DB → các khoản có hạn (lịch, bill ví trả sau, sổ nợ) */
export function loadReminderItems(db: AppDatabase, now = Date.now()): ReminderItem[] {
  const prefs = getSettings().notifications;
  const today = todayVn(now);
  const to = addDays(today, LOOKAHEAD_DAYS);
  const balances = getAccountBalances(db);
  const credit = getCreditSummaries(db, today);
  const creditIds = new Set(credit.map((c) => c.account.id));
  const fallbackPayer =
    balances
      .filter((b) => b.includeInBalance && !creditIds.has(b.id))
      .sort((a, b) => b.balance - a.balance)[0]?.id ?? null;

  const occurrences = [
    ...expandOccurrences(listSchedules(db), listOverrides(db), {
      from: addDays(today, -LOOKBACK_DAYS),
      to,
      today,
    }),
    ...creditBillOccurrences(credit, { today, to, fallbackPayer }),
  ];

  const items: ReminderItem[] = [];
  for (const o of occurrences) {
    if (o.status === 'paid' || o.status === 'skipped') continue;
    items.push({
      key: `${o.scheduleId}~${o.dueDate}`,
      kind: o.type === 'income' ? 'income' : 'payment',
      date: o.date,
      title: o.schedule.title || TYPE_FALLBACK[o.type],
      amount: o.amount,
      overdue: o.status === 'overdue',
      daysBefore: o.schedule.remindDaysBefore ?? prefs.daysBefore,
      time: o.schedule.remindTime || prefs.time,
      url: isCreditBill(o.scheduleId)
        ? `/account/${creditAccountOfBill(o.scheduleId)}`
        : `/schedule/occurrence?scheduleId=${encodeURIComponent(o.scheduleId)}&dueDate=${o.dueDate}`,
    });
  }

  for (const d of listDebts(db, today)) {
    if (d.status === 'closed' || d.status === 'settled' || !d.debt.dueDate) continue;
    items.push({
      key: d.debt.id,
      kind: 'debt',
      date: d.debt.dueDate,
      title:
        d.direction === 'lent'
          ? t('{name} hẹn trả', { name: d.person.name })
          : t('Trả nợ {name}', { name: d.person.name }),
      amount: d.remaining,
      overdue: d.status === 'overdue',
      daysBefore: prefs.daysBefore,
      time: prefs.time,
      url: `/debt/${d.debt.id}`,
      actionUrl: `/debt/record?debtId=${encodeURIComponent(d.debt.id)}&type=repay`,
    });
  }
  return items;
}

/** Nhóm nút hành động của một nhắc (null = không có nút) */
const categoryOf = (r: Reminder): string | null =>
  r.withActions ? (r.channel === 'debts' ? DEBT_CATEGORY : PAYMENT_CATEGORY) : null;

async function syncReminders(db: AppDatabase): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const N = await loadNotifications();
  if (!N) return 0;

  const settings = getSettings();
  const prefs = settings.notifications;
  const granted = prefs.enabled && (await N.getPermissionsAsync()).status === 'granted';
  const now = Date.now();
  const wanted = new Map(
    (granted
      ? buildReminders({
          now,
          today: todayVn(now),
          quietStart: prefs.quietStart,
          quietEnd: prefs.quietEnd,
          flags: {
            payments: prefs.payments,
            income: prefs.income,
            overdue: prefs.overdue,
            debts: prefs.debts,
          },
          items: loadReminderItems(db, now),
          money: (amount) => formatCompact(amount, { symbol: settings.currencySymbol }),
          horizonDays: LOOKAHEAD_DAYS,
        })
      : []
    ).map((r) => [r.id, r]),
  );

  // Huỷ bản cũ đã đổi / không còn cần; giữ nguyên bản giống hệt (cùng nội dung và giờ)
  const existing = (await N.getAllScheduledNotificationsAsync()).filter((r) =>
    r.identifier.startsWith(REMINDER_PREFIX),
  );
  const keep = new Set<string>();
  for (const request of existing) {
    const next = wanted.get(request.identifier);
    if (
      next &&
      request.content.title === next.title &&
      request.content.body === next.body &&
      (request.content.categoryIdentifier ?? null) === categoryOf(next)
    ) {
      keep.add(request.identifier);
    } else {
      await N.cancelScheduledNotificationAsync(request.identifier);
    }
  }
  if (!wanted.size) return 0;

  await initNotifications();
  for (const [identifier, r] of wanted) {
    if (keep.has(identifier)) continue;
    const data: NotificationData = {
      url: r.url,
      channel: r.channel,
      snoozeSeconds: SNOOZE_SECONDS,
      ...(r.actionUrl ? { actionUrl: r.actionUrl } : {}),
    };
    await N.scheduleNotificationAsync({
      identifier,
      content: {
        title: r.title,
        body: r.body,
        sound: 'default',
        data,
        ...(categoryOf(r) ? { categoryIdentifier: categoryOf(r)! } : {}),
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: r.fireAt,
        channelId: r.channel,
      },
    });
  }
  return wanted.size;
}

let queue: Promise<unknown> = Promise.resolve();

/** Tính lại và hẹn lại ngay (các lần gọi chồng nhau chạy lần lượt). Trả về số nhắc đang hẹn. */
export function refreshReminders(db: AppDatabase): Promise<number> {
  const run = queue.then(() => syncReminders(db));
  queue = run.catch(() => {});
  return run;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Gộp nhiều thay đổi liên tiếp thành một lần tính lại */
export function requestReminderRefresh(db: AppDatabase, delayMs = 4000): void {
  if (!notificationsSupported || Platform.OS === 'web') return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    refreshReminders(db).catch((error: unknown) =>
      console.warn('[notifications] nhắc hạn lỗi:', error),
    );
  }, delayMs);
}
