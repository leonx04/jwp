// Lịch thu chi: lưu quy tắc + trạng thái các kỳ đã xử lý (đã trả / bỏ qua / dời ngày).
import { and, asc, desc, eq, ne } from 'drizzle-orm';

import {
  scheduleOccurrences,
  schedules,
  type NewSchedule,
  type Schedule,
  type ScheduleOccurrence,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { saveTransaction } from '@/features/transactions/repository';
import { addDays, todayVn, vnDateToMs, type DateString } from '@/lib/date';
import { createId } from '@/lib/id';
import { MAX_AMOUNT } from '@/lib/money';

import { expandOccurrences, OVERDUE_LOOKBACK_DAYS } from './occurrences';

export type ScheduleInput = Omit<NewSchedule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

/**
 * Lịch thu chi. Mặc định bỏ kế hoạch trả góp (kind = 'installment'): đó chỉ là thông tin để tính
 * bill ví trả sau — khoản mua đã ghi chi một lần, tiền ra thật là lúc trả bill.
 */
export function listSchedules(db: AppDatabase, { includeInstallments = false } = {}): Schedule[] {
  return db
    .select()
    .from(schedules)
    .where(includeInstallments ? undefined : ne(schedules.kind, 'installment'))
    .orderBy(desc(schedules.active), asc(schedules.startDate))
    .all();
}

export function getSchedule(db: AppDatabase, id: string): Schedule | undefined {
  return db.select().from(schedules).where(eq(schedules.id, id)).get();
}

export function listOverrides(db: AppDatabase, scheduleId?: string): ScheduleOccurrence[] {
  return db
    .select()
    .from(scheduleOccurrences)
    .where(scheduleId ? eq(scheduleOccurrences.scheduleId, scheduleId) : undefined)
    .orderBy(desc(scheduleOccurrences.dueDate))
    .all();
}

export function saveSchedule(db: AppDatabase, input: ScheduleInput): string {
  if (!Number.isInteger(input.amount) || input.amount < 0 || input.amount > MAX_AMOUNT) {
    throw new Error('Số tiền không hợp lệ.');
  }
  if (!input.accountId) throw new Error('Chưa chọn ví.');
  if (input.type === 'transfer') {
    if (!input.toAccountId) throw new Error('Chưa chọn ví nhận.');
    if (input.toAccountId === input.accountId)
      throw new Error('Ví chuyển và ví nhận phải khác nhau.');
  }
  const { id, ...values } = input;
  const row = {
    ...values,
    title: (values.title ?? '').trim(),
    toAccountId: values.type === 'transfer' ? values.toAccountId : null,
    categoryId: values.type === 'transfer' ? null : values.categoryId,
  };
  if (id) {
    db.update(schedules).set(row).where(eq(schedules.id, id)).run();
    return id;
  }
  const newId = createId();
  db.insert(schedules)
    .values({ id: newId, ...row })
    .run();
  return newId;
}

/** Xoá lịch. Giao dịch đã ghi từ lịch vẫn giữ nguyên (chỉ bỏ liên kết). */
export function deleteSchedule(db: AppDatabase, id: string): void {
  db.delete(schedules).where(eq(schedules.id, id)).run();
}

export function setScheduleActive(db: AppDatabase, id: string, active: boolean): void {
  db.update(schedules).set({ active }).where(eq(schedules.id, id)).run();
}

function upsertOccurrence(db: AppDatabase, row: Omit<ScheduleOccurrence, 'updatedAt'>) {
  db.insert(scheduleOccurrences)
    .values(row)
    .onConflictDoUpdate({
      target: [scheduleOccurrences.scheduleId, scheduleOccurrences.dueDate],
      set: {
        status: row.status,
        newDate: row.newDate,
        amount: row.amount,
        transactionId: row.transactionId,
        updatedAt: Date.now(),
      },
    })
    .run();
}

export function skipOccurrence(db: AppDatabase, scheduleId: string, dueDate: DateString): void {
  upsertOccurrence(db, {
    scheduleId,
    dueDate,
    status: 'skipped',
    newDate: null,
    amount: null,
    transactionId: null,
  });
}

export function rescheduleOccurrence(
  db: AppDatabase,
  scheduleId: string,
  dueDate: DateString,
  newDate: DateString,
): void {
  upsertOccurrence(db, {
    scheduleId,
    dueDate,
    status: 'rescheduled',
    newDate,
    amount: null,
    transactionId: null,
  });
}

/** Đưa kỳ về trạng thái chưa xử lý (hoàn tác bỏ qua / dời ngày) */
export function clearOccurrence(db: AppDatabase, scheduleId: string, dueDate: DateString): void {
  db.delete(scheduleOccurrences)
    .where(
      and(eq(scheduleOccurrences.scheduleId, scheduleId), eq(scheduleOccurrences.dueDate, dueDate)),
    )
    .run();
}

/**
 * Tự ghi nhận các kỳ đã đến hạn của lịch bật "Tự ghi nhận" (vd lương vào thẳng ví).
 * Gọi khi mở app. Trả về số giao dịch đã tạo.
 */
export function processAutoPost(db: AppDatabase, today: DateString = todayVn()): number {
  const auto = listSchedules(db).filter((s) => s.active && s.autoPost);
  if (!auto.length) return 0;
  const pending = expandOccurrences(auto, listOverrides(db), {
    from: addDays(today, -OVERDUE_LOOKBACK_DAYS),
    to: today,
    today,
  }).filter((o) => o.status === 'due' || o.status === 'overdue');
  for (const o of pending) {
    const s = o.schedule;
    saveTransaction(db, {
      type: s.type,
      amount: o.amount,
      accountId: s.accountId,
      toAccountId: s.toAccountId,
      categoryId: s.categoryId,
      title: s.title,
      date: vnDateToMs(o.date, s.remindTime || '09:00'),
      scheduleId: s.id,
      scheduleDueDate: o.dueDate,
    });
  }
  return pending.length;
}
