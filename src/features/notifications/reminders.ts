// Nhắc hạn: khoản phải trả (kể cả bill ví trả sau), khoản thu dự kiến, hạn trả / đòi nợ.
// Phần tính là hàm thuần (test được): từ danh sách khoản sắp tới → các thông báo cần hẹn.
import { t } from '@/lib/i18n';
import { addDays, formatDate, vnDateToMs, type DateString } from '@/lib/date';

import type { ChannelId } from './config';

export type ReminderKind = 'payment' | 'income' | 'debt';

export type ReminderItem = {
  /** Khoá ổn định của khoản (dùng làm định danh thông báo) */
  key: string;
  kind: ReminderKind;
  /** Ngày đến hạn */
  date: DateString;
  title: string;
  amount: number;
  overdue: boolean;
  /** Nhắc trước bao nhiêu ngày (0 = chỉ nhắc đúng ngày) */
  daysBefore: number;
  /** Giờ nhắc 'HH:mm' */
  time: string;
  /** Mở đường dẫn này khi bấm thông báo */
  url: string;
};

export type ReminderFlags = {
  payments: boolean;
  income: boolean;
  overdue: boolean;
  debts: boolean;
};

export type ReminderInput = {
  now: number;
  today: DateString;
  /** Giờ yên lặng 'HH:mm': không gửi trong khoảng này, dồn sang cuối khoảng */
  quietStart: string;
  quietEnd: string;
  flags: ReminderFlags;
  items: readonly ReminderItem[];
  /** Định dạng tiền rút gọn */
  money: (amount: number) => string;
  /** Chỉ hẹn các khoản trong N ngày tới (mặc định 14) */
  horizonDays?: number;
};

export type Reminder = {
  id: string;
  fireAt: number;
  title: string;
  body: string;
  url: string;
  channel: ChannelId;
  /** Có nút Đã thanh toán / Nhắc lại sau / Mở */
  withActions: boolean;
};

export const REMINDER_PREFIX = 'reminder:';
const DEFAULT_HORIZON_DAYS = 14;
/** Số ngày tới có thông báo "quá hạn" gộp */
const OVERDUE_DAYS = 2;
const MAX_OVERDUE_LINES = 3;

const ICON: Record<ReminderKind, string> = { payment: '💸', income: '💰', debt: '🤝' };
const CHANNEL: Record<ReminderKind, ChannelId> = {
  payment: 'payments',
  income: 'income',
  debt: 'debts',
};

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Đẩy giờ nhắc ra khỏi khoảng yên lặng (giờ VN). Khoảng có thể vắt qua nửa đêm (22:00–07:00). */
export function avoidQuietHours(
  date: DateString,
  time: string,
  quietStart: string,
  quietEnd: string,
): number {
  const t = minutes(time);
  const start = minutes(quietStart);
  const end = minutes(quietEnd);
  if (start === end) return vnDateToMs(date, time);
  const wraps = start > end;
  const inQuiet = wraps ? t >= start || t < end : t >= start && t < end;
  if (!inQuiet) return vnDateToMs(date, time);
  // Sau nửa đêm của khoảng vắt đêm → cuối khoảng cùng ngày; trước nửa đêm → sáng hôm sau
  const sameDay = wraps ? t < end : true;
  return vnDateToMs(sameDay ? date : addDays(date, 1), quietEnd);
}

const dayWord = (days: number) => (days === 1 ? 'Ngày mai' : t('{days} ngày nữa', { days }));

export function buildReminders(input: ReminderInput): Reminder[] {
  const { now, today, flags, money } = input;
  const horizon = addDays(today, input.horizonDays ?? DEFAULT_HORIZON_DAYS);
  const enabled: Record<ReminderKind, boolean> = {
    payment: flags.payments,
    income: flags.income,
    debt: flags.debts,
  };
  const out: Reminder[] = [];
  const at = (date: DateString, time: string) =>
    avoidQuietHours(date, time, input.quietStart, input.quietEnd);

  const upcoming = input.items.filter((i) => !i.overdue && i.date >= today && i.date <= horizon);
  for (const item of upcoming) {
    if (!enabled[item.kind]) continue;
    const icon = ICON[item.kind];
    const channel = CHANNEL[item.kind];
    const url = item.url;
    const withActions = item.kind === 'payment';
    const body = `${money(item.amount)} · ${formatDate(item.date, false)}`;

    // Nhắc trước hạn
    if (item.daysBefore > 0) {
      const date = addDays(item.date, -item.daysBefore);
      const fireAt = at(date, item.time);
      if (date >= today && fireAt > now) {
        out.push({
          id: `${REMINDER_PREFIX}${item.kind}:${item.key}:before@${date}`,
          fireAt,
          title: `${icon} ${dayWord(item.daysBefore)}: ${item.title}`,
          body,
          url,
          channel,
          withActions,
        });
      }
    }
    // Nhắc đúng ngày
    const dayOf = at(item.date, item.time);
    if (dayOf > now) {
      out.push({
        id: `${REMINDER_PREFIX}${item.kind}:${item.key}:due@${item.date}`,
        fireAt: dayOf,
        title: t('{icon} Hôm nay: {title}', { icon, title: item.title }),
        body: money(item.amount),
        url,
        channel,
        withActions,
      });
    }
  }

  // Quá hạn: gộp một thông báo mỗi ngày trong vài ngày tới
  if (flags.overdue) {
    const overdue = input.items.filter((i) => i.overdue && enabled[i.kind]);
    if (overdue.length) {
      const time = overdue[0].time;
      const lines = overdue
        .slice(0, MAX_OVERDUE_LINES)
        .map((i) => `${i.title} ${money(i.amount)}`)
        .join('\n');
      const more =
        overdue.length > MAX_OVERDUE_LINES
          ? t('\n…và {MAX_OVERDUE_LINES} khoản nữa', {
              MAX_OVERDUE_LINES: overdue.length - MAX_OVERDUE_LINES,
            })
          : '';
      for (let d = 0; d <= OVERDUE_DAYS; d++) {
        const date = addDays(today, d);
        const fireAt = at(date, time);
        if (fireAt <= now) continue;
        out.push({
          id: `${REMINDER_PREFIX}overdue:${date}`,
          fireAt,
          title: t('⚠️ {length} khoản quá hạn', { length: overdue.length }),
          body: lines + more,
          url: overdue[0].url,
          channel: 'payments',
          withActions: false,
        });
      }
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt || a.id.localeCompare(b.id));
}
