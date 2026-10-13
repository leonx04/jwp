// Lưu và xử lý các thông báo / SMS đã bắt được: chống trùng, đoán ví, xác nhận hoặc bỏ qua.
import { and, desc, eq, gte, inArray, lt, lte, notInArray, sql } from 'drizzle-orm';

import { captures, transactions, type Account, type Capture } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { bankIcon } from '@/lib/banks';
import { createId } from '@/lib/id';

import { captureFingerprint, parseCapture, type RawCapture } from './parse';

/** Giữ tối đa bấy nhiêu dòng đã xử lý (đã ghi / bỏ qua / không đọc được) */
const KEEP_HANDLED = 200;
const KEEP_DAYS = 30;
/** Khoảng thời gian (ms) tìm giao dịch trùng quanh thời điểm thông báo */
const DUPLICATE_WINDOW_MS = 3 * 3_600_000;

type AccountLike = Pick<Account, 'id' | 'icon' | 'archived' | 'isCredit'>;

/** Ví ứng với một ngân hàng (theo logo ngân hàng đã chọn cho ví) */
export function guessAccount(
  accounts: readonly AccountLike[],
  bankCode: string | null,
): string | null {
  if (!bankCode) return null;
  const icon = bankIcon(bankCode);
  return accounts.find((a) => a.icon === icon && !a.archived && !a.isCredit)?.id ?? null;
}

export type IngestResult = { added: number; pending: number; unparsed: number; duplicates: number };

export function ingestCaptures(
  db: AppDatabase,
  raws: readonly RawCapture[],
  accounts: readonly AccountLike[],
): IngestResult {
  const result: IngestResult = { added: 0, pending: 0, unparsed: 0, duplicates: 0 };
  db.transaction((tx) => {
    for (const raw of raws) {
      const fingerprint = captureFingerprint(raw);
      const exists = tx
        .select({ id: captures.id })
        .from(captures)
        .where(eq(captures.fingerprint, fingerprint))
        .get();
      if (exists) {
        result.duplicates++;
        continue;
      }
      const parsed = parseCapture(raw);
      tx.insert(captures)
        .values({
          id: createId(),
          fingerprint,
          source: raw.source,
          sender: raw.sender,
          title: raw.title,
          body: raw.text,
          postedAt: raw.postedAt,
          type: parsed?.type ?? null,
          amount: parsed?.amount ?? null,
          balanceAfter: parsed?.balanceAfter ?? null,
          content: parsed?.content ?? '',
          counterparty: parsed?.counterparty ?? null,
          bankCode: parsed?.bankCode ?? null,
          accountId: guessAccount(accounts, parsed?.bankCode ?? null),
          status: parsed ? 'pending' : 'unparsed',
        })
        .run();
      result.added++;
      if (parsed) result.pending++;
      else result.unparsed++;
    }
    prune(tx);
  });
  return result;
}

function prune(db: AppDatabase) {
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  db.delete(captures)
    .where(
      and(
        inArray(captures.status, ['accepted', 'dismissed', 'unparsed']),
        lt(captures.createdAt, cutoff),
      ),
    )
    .run();
  const keep = db
    .select({ id: captures.id })
    .from(captures)
    .where(inArray(captures.status, ['accepted', 'dismissed', 'unparsed']))
    .orderBy(desc(captures.createdAt))
    .limit(KEEP_HANDLED)
    .all()
    .map((r) => r.id);
  db.delete(captures)
    .where(
      and(
        inArray(captures.status, ['accepted', 'dismissed', 'unparsed']),
        keep.length ? notInArray(captures.id, keep) : undefined,
      ),
    )
    .run();
}

export type PendingCapture = { capture: Capture; duplicateOf: string | null };

/** Giao dịch đã ghi tay trùng với thông báo (cùng loại, cùng số tiền, cùng ví nếu biết, gần thời điểm) */
function findDuplicate(db: AppDatabase, c: Capture): string | null {
  if (!c.type || !c.amount) return null;
  const row = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, c.type),
        eq(transactions.amount, c.amount),
        c.accountId ? eq(transactions.accountId, c.accountId) : undefined,
        gte(transactions.date, c.postedAt - DUPLICATE_WINDOW_MS),
        lte(transactions.date, c.postedAt + DUPLICATE_WINDOW_MS),
      ),
    )
    .get();
  return row?.id ?? null;
}

export function listPendingCaptures(db: AppDatabase): PendingCapture[] {
  return db
    .select()
    .from(captures)
    .where(eq(captures.status, 'pending'))
    .orderBy(desc(captures.postedAt))
    .all()
    .map((capture) => ({ capture, duplicateOf: findDuplicate(db, capture) }));
}

export function countPendingCaptures(db: AppDatabase): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(captures)
    .where(eq(captures.status, 'pending'))
    .get();
  return Number(row?.n ?? 0);
}

export function listRecentCaptures(db: AppDatabase, limit = 60): Capture[] {
  return db.select().from(captures).orderBy(desc(captures.postedAt)).limit(limit).all();
}

export function acceptCapture(db: AppDatabase, id: string, transactionId: string): void {
  db.update(captures).set({ status: 'accepted', transactionId }).where(eq(captures.id, id)).run();
}

export function dismissCapture(db: AppDatabase, id: string): void {
  db.update(captures).set({ status: 'dismissed' }).where(eq(captures.id, id)).run();
}

export function setCaptureAccount(db: AppDatabase, id: string, accountId: string | null): void {
  db.update(captures).set({ accountId }).where(eq(captures.id, id)).run();
}

export function clearCaptureLog(db: AppDatabase): void {
  db.delete(captures)
    .where(inArray(captures.status, ['accepted', 'dismissed', 'unparsed']))
    .run();
}
