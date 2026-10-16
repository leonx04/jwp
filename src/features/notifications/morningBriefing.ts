// Báo cáo buổi sáng: hẹn sẵn thông báo cho BRIEFING_DAYS buổi sáng tới với nội dung tính lúc này
// (số dư từng ví, hôm nay được tiêu bao nhiêu, còn mấy ngày tới lương, khoản / bill trong ngày).
// Định danh cố định 'morning-briefing:<ngày>@<giờ>' → mỗi lần tính lại chỉ thay bản đã đổi.
// An toàn trong Expo Go / web: không có module thông báo thì không làm gì.
import { t } from '@/lib/i18n';
import { Platform } from 'react-native';

import type { AppDatabase } from '@/db/types';
import { getAccountBalances, totalBalance } from '@/features/accounts/queries';
import { creditBillOccurrences, isCreditBill } from '@/features/credit/bills';
import { getCreditSummaries } from '@/features/credit/queries';
import { listDebts } from '@/features/debts/queries';
import { computeForecast } from '@/features/forecast/forecast';
import { expandOccurrences } from '@/features/schedules/occurrences';
import { listOverrides, listSchedules } from '@/features/schedules/repository';
import { getSettings } from '@/features/settings/store';
import { computeToday, projectAllowances } from '@/features/today/compute';
import { getDaySpending } from '@/features/today/queries';
import { addDays, todayVn } from '@/lib/date';
import { formatCompact } from '@/lib/money';

import {
  briefingForDay,
  buildMorningBriefings,
  type BriefingBill,
  type BriefingInput,
} from './briefing';
import { loadNotifications, notificationsSupported, requireNotifications } from './module';
import type { NotificationData } from './scheduling';
import { initNotifications } from './setup';

export const BRIEFING_PREFIX = 'morning-briefing:';
/** Số buổi sáng hẹn trước (mở app ít nhất 3 ngày một lần là luôn có báo cáo) */
export const BRIEFING_DAYS = 3;
const FORECAST_DAYS = 30;

const TYPE_FALLBACK = { income: 'Khoản thu', expense: 'Khoản chi', transfer: 'Chuyển khoản' };

/** Đọc DB + cài đặt → dữ liệu cho briefing.ts. null nếu chưa có ví nào. */
export function loadBriefingInput(
  db: AppDatabase,
  { now = Date.now(), count = BRIEFING_DAYS }: { now?: number; count?: number } = {},
): BriefingInput | null {
  const settings = getSettings();
  const today = todayVn(now);
  const balances = getAccountBalances(db);
  if (!balances.length) return null;

  // Giống useScheduleOverview (schedules/hooks.ts) nhưng chạy ngoài React
  const credit = getCreditSummaries(db, today);
  const creditIds = new Set(credit.map((c) => c.account.id));
  const fallbackPayer =
    balances
      .filter((b) => b.includeInBalance && !creditIds.has(b.id))
      .sort((a, b) => b.balance - a.balance)[0]?.id ?? null;
  const to = addDays(today, FORECAST_DAYS);
  const occurrences = [
    ...expandOccurrences(listSchedules(db), listOverrides(db), { from: today, to, today }),
    ...creditBillOccurrences(credit, { today, to, fallbackPayer }),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.scheduleId.localeCompare(b.scheduleId));
  const forecast = computeForecast({
    today,
    days: FORECAST_DAYS,
    startBalance: totalBalance(balances),
    accountBalances: new Map(balances.map((b) => [b.id, b.balance])),
    includedAccounts: new Set(balances.filter((b) => b.includeInBalance).map((b) => b.id)),
    occurrences,
    safetyThreshold: settings.safetyThreshold,
  });

  const status = computeToday({
    today,
    forecast,
    spending: getDaySpending(db, today),
    safetyThreshold: settings.safetyThreshold,
  });
  const days = projectAllowances({
    today,
    forecast,
    status,
    count: count + 1,
    safetyThreshold: settings.safetyThreshold,
  });

  const bills: BriefingBill[] = [];
  for (const { account, status: s } of credit) {
    if (s.current && s.current.dueAmount > 0) {
      bills.push({
        name: account.name,
        amount: s.current.dueAmount,
        dueDate: s.current.dueDate,
        overdue: s.current.overdue,
        estimate: false,
      });
    }
    if (s.next && s.next.estimatedAmount > 0) {
      bills.push({
        name: account.name,
        amount: s.next.estimatedAmount,
        dueDate: s.next.dueDate,
        overdue: false,
        estimate: true,
      });
    }
  }

  // Khoản nợ tới hạn (đòi / trả) trong thời gian tới → coi như khoản theo lịch trong báo cáo
  const debtItems = listDebts(db, today)
    .filter(
      (d) =>
        (d.status === 'overdue' || d.status === 'due-soon' || d.status === 'open') &&
        d.debt.dueDate &&
        d.debt.dueDate <= to,
    )
    .map((d) => ({
      date: d.status === 'overdue' ? today : d.debt.dueDate!,
      title:
        d.direction === 'lent'
          ? t('{name} trả nợ', { name: d.person.name })
          : t('Trả nợ {name}', { name: d.person.name }),
      amount: d.remaining,
      type: d.direction === 'lent' ? ('income' as const) : ('expense' as const),
      overdue: d.status === 'overdue',
    }));

  const symbol = settings.currencySymbol;
  return {
    now,
    today,
    time: settings.notifications.morningBriefingTime,
    count,
    wallets: balances
      .filter((b) => !creditIds.has(b.id))
      .map((b) => ({ name: b.name, balance: b.balance })),
    days,
    items: [
      ...occurrences
        .filter((o) => !isCreditBill(o.scheduleId))
        .map((o) => ({
          date: o.date,
          title: o.schedule.title || TYPE_FALLBACK[o.type],
          amount: o.amount,
          type: o.type,
          overdue: o.status === 'overdue',
        })),
      ...debtItems,
    ],
    bills,
    money: (amount) => formatCompact(amount, { symbol }),
  };
}

const briefingData: NotificationData = { url: '/', channel: 'daily' };

async function syncBriefings(db: AppDatabase): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const N = await loadNotifications();
  if (!N) return 0;

  const prefs = getSettings().notifications;
  const enabled = prefs.enabled && prefs.morningBriefing;
  const granted = enabled && (await N.getPermissionsAsync()).status === 'granted';
  const input = granted ? loadBriefingInput(db) : null;
  const wanted = new Map(
    (input ? buildMorningBriefings(input) : []).map((b) => [
      `${BRIEFING_PREFIX}${b.date}@${input!.time}`,
      b,
    ]),
  );

  // Huỷ bản cũ đã đổi nội dung / không còn cần; giữ nguyên bản giống hệt
  const existing = (await N.getAllScheduledNotificationsAsync()).filter((r) =>
    r.identifier.startsWith(BRIEFING_PREFIX),
  );
  const keep = new Set<string>();
  for (const request of existing) {
    const next = wanted.get(request.identifier);
    if (next && request.content.title === next.title && request.content.body === next.body) {
      keep.add(request.identifier);
    } else {
      await N.cancelScheduledNotificationAsync(request.identifier);
    }
  }
  if (!wanted.size) return 0;

  await initNotifications();
  for (const [identifier, briefing] of wanted) {
    if (keep.has(identifier)) continue;
    await N.scheduleNotificationAsync({
      identifier,
      content: { title: briefing.title, body: briefing.body, data: briefingData },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: briefing.fireAt,
        channelId: 'daily',
      },
    });
  }
  return wanted.size;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Tính lại và hẹn lại báo cáo buổi sáng ngay (các lần gọi chồng nhau chạy lần lượt).
 * Trả về số báo cáo đang hẹn. Không ném lỗi khi môi trường không hỗ trợ thông báo.
 */
export function refreshMorningBriefing(db: AppDatabase): Promise<number> {
  const run = queue.then(() => syncBriefings(db));
  queue = run.catch(() => {});
  return run;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Gộp nhiều thay đổi liên tiếp (nhập nhiều giao dịch, import) thành một lần tính lại */
export function requestMorningBriefingRefresh(db: AppDatabase, delayMs = 4000): void {
  if (!notificationsSupported || Platform.OS === 'web') return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    refreshMorningBriefing(db).catch((error: unknown) =>
      console.warn('[notifications] báo cáo buổi sáng lỗi:', error),
    );
  }, delayMs);
}

/** Gửi thử báo cáo của hôm nay sau vài giây (màn cài đặt thông báo) */
export async function sendMorningBriefingPreview(db: AppDatabase, seconds = 3): Promise<void> {
  const N = await requireNotifications();
  await initNotifications();
  const input = loadBriefingInput(db);
  if (!input) throw new Error('Chưa có ví nào để báo cáo.');
  const { title, body } = briefingForDay(input, 0);
  await N.scheduleNotificationAsync({
    content: { title, body, data: briefingData },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: 'daily',
    },
  });
}

/** Số báo cáo buổi sáng đang hẹn */
export async function getScheduledBriefingCount(): Promise<number> {
  const N = await loadNotifications();
  if (!N) return 0;
  return (await N.getAllScheduledNotificationsAsync()).filter((r) =>
    r.identifier.startsWith(BRIEFING_PREFIX),
  ).length;
}
