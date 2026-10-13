import { and, eq, gte, isNull, ne } from 'drizzle-orm';
import Storage from 'expo-sqlite/kv-store';

import { transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { listSchedules, saveSchedule } from '@/features/schedules/repository';
import { addDays, parseDate, type DateString } from '@/lib/date';

import { detectRecurring, type RecurringSuggestion } from './detect';

const DISMISSED_KEY = 'jwp.recurringDismissed';
/** Chỉ xét giao dịch trong ngần này ngày gần đây */
const HISTORY_DAYS = 300;

export function getDismissed(): Set<string> {
  try {
    const raw = Storage.getItemSync(DISMISSED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(
      Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

/** Ẩn một gợi ý (lần sau không hiện lại) */
export function dismissSuggestion(key: string): void {
  try {
    Storage.setItemSync(DISMISSED_KEY, JSON.stringify([...getDismissed(), key]));
  } catch {
    // bỏ qua: gợi ý sẽ hiện lại
  }
}

export function listRecurringSuggestions(
  db: AppDatabase,
  today: DateString,
): RecurringSuggestion[] {
  const since = Date.parse(addDays(today, -HISTORY_DAYS));
  const rows = db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      title: transactions.title,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .where(
      and(
        ne(transactions.type, 'transfer'),
        eq(transactions.isAdjustment, false),
        isNull(transactions.scheduleId),
        isNull(transactions.debtId),
        isNull(transactions.parentId),
        isNull(transactions.toAccountId),
        gte(transactions.date, since),
      ),
    )
    .all();
  const txs = rows.filter((r) => r.type !== 'transfer') as Parameters<
    typeof detectRecurring
  >[0]['txs'];
  return detectRecurring({
    txs,
    existing: listSchedules(db).map((s) => ({
      title: s.title,
      type: s.type,
      amount: s.amount,
      startDate: s.startDate,
      monthDay: s.monthDay,
    })),
    dismissed: getDismissed(),
    today,
  });
}

/** Tạo lịch hằng tháng từ một gợi ý. Trả về id lịch. */
export function createScheduleFromSuggestion(db: AppDatabase, s: RecurringSuggestion): string {
  const day = parseDate(s.nextDate).day;
  return saveSchedule(db, {
    type: s.type,
    amount: s.amount,
    isEstimate: s.isEstimate,
    accountId: s.accountId,
    categoryId: s.categoryId,
    title: s.title,
    startDate: s.nextDate,
    frequency: 'monthly',
    interval: 1,
    // Ngày cuối tháng (31) → -1 để tháng ngắn vẫn đúng
    monthDay: s.monthDay >= 31 ? -1 : s.monthDay || day,
    endType: 'never',
    autoPost: false,
    active: true,
  });
}
