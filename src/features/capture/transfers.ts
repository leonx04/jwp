// Hộp chờ gom nhóm: các cặp thông báo là một lần chuyển giữa 2 ví của bạn + các thông báo lẻ.
import { and, eq, gte, lte } from 'drizzle-orm';

import { transactions, type Capture } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { saveTransaction } from '@/features/transactions/repository';

import { mentionsOwner, pairTransfers } from './pairing';
import { acceptCapture, dismissCapture } from './repository';
import { listPendingWithGuess, type PendingWithGuess } from './rulesRepository';

/** Giao dịch chuyển khoản đã ghi trùng với cặp này (cùng 2 ví, số tiền, gần thời điểm) */
const DUPLICATE_WINDOW_MS = 3 * 3_600_000;

export type PendingPair = {
  out: PendingWithGuess;
  in: PendingWithGuess;
  /** Id chuyển khoản đã ghi tay trùng với cặp này */
  duplicateOf: string | null;
};

export type PendingSingle = PendingWithGuess & {
  /** Có tên của bạn trong nội dung: nhiều khả năng là chuyển với ví khác của chính bạn */
  ownerHint: boolean;
};

export type GroupedPending = { pairs: PendingPair[]; singles: PendingSingle[] };

function findTransferDuplicate(db: AppDatabase, out: Capture, into: Capture): string | null {
  if (!out.amount || !out.accountId || !into.accountId) return null;
  return (
    db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'transfer'),
          eq(transactions.amount, out.amount),
          eq(transactions.accountId, out.accountId),
          eq(transactions.toAccountId, into.accountId),
          gte(transactions.date, out.postedAt - DUPLICATE_WINDOW_MS),
          lte(transactions.date, out.postedAt + DUPLICATE_WINDOW_MS),
        ),
      )
      .get()?.id ?? null
  );
}

export function listPendingGrouped(db: AppDatabase, ownerName = ''): GroupedPending {
  const all = listPendingWithGuess(db);
  const pairs = pairTransfers(all.map((p) => p.capture));
  const byId = new Map(all.map((p) => [p.capture.id, p]));
  const paired = new Set<string>();
  const grouped: PendingPair[] = pairs.map((p) => {
    const out = byId.get(p.out.id)!;
    const into = byId.get(p.in.id)!;
    paired.add(out.capture.id).add(into.capture.id);
    return { out, in: into, duplicateOf: findTransferDuplicate(db, out.capture, into.capture) };
  });
  const singles = all
    .filter((p) => !paired.has(p.capture.id))
    .map((p) => ({
      ...p,
      ownerHint: mentionsOwner(ownerName, p.capture.content, p.capture.counterparty),
    }));
  return { pairs: grouped, singles };
}

/** Đánh dấu nhiều thông báo cùng đã ghi vào một giao dịch (vd 2 thông báo → 1 chuyển khoản) */
export function acceptCaptures(db: AppDatabase, ids: readonly string[], transactionId: string) {
  for (const id of ids) acceptCapture(db, id, transactionId);
}

export function dismissCaptures(db: AppDatabase, ids: readonly string[]) {
  for (const id of ids) dismissCapture(db, id);
}

/** Ghi luôn chuyển khoản cho các cặp khớp chắc chắn (bật "tự ghi chuyển khoản"). Trả số cặp đã ghi. */
export function autoAcceptTransfers(db: AppDatabase): number {
  let done = 0;
  for (const p of listPendingGrouped(db).pairs) {
    if (p.duplicateOf) continue;
    const { out, in: into } = p;
    try {
      const id = saveTransaction(db, {
        type: 'transfer',
        amount: out.capture.amount!,
        accountId: out.capture.accountId!,
        toAccountId: into.capture.accountId!,
        title: 'Chuyển tiền giữa ví',
        date: out.capture.postedAt,
      });
      acceptCaptures(db, [out.capture.id, into.capture.id], id);
      done++;
    } catch {
      // để nguyên trong hộp chờ
    }
  }
  return done;
}
