// Quy tắc phân loại + đoán danh mục cho giao dịch tự đọc + tự ghi theo quy tắc.
import { t } from '@/lib/i18n';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { captureRules, captures, categories, transactions } from '@/db/schema';
import type { Capture, CaptureRule } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { saveTransaction } from '@/features/transactions/repository';
import { createId } from '@/lib/id';
import { normalizeForSearch } from '@/lib/text';

import { pairTransfers } from './pairing';
import {
  acceptCapture,
  findDuplicate,
  listPendingCaptures,
  type PendingCapture,
} from './repository';
import { dominantCategory, matchRule, MIN_PATTERN_LENGTH, patternKey } from './rules';

export type RuleInput = {
  id?: string;
  pattern: string;
  type: 'income' | 'expense' | null;
  categoryId: string;
  autoAccept: boolean;
};

export function listRules(db: AppDatabase): CaptureRule[] {
  return db.select().from(captureRules).orderBy(asc(captureRules.createdAt)).all();
}

export function saveRule(db: AppDatabase, input: RuleInput): string {
  const pattern = input.pattern.trim().replace(/\s+/g, ' ');
  if (patternKey(pattern).length < MIN_PATTERN_LENGTH) {
    throw new Error(t('Cụm từ cần ít nhất {MIN_PATTERN_LENGTH} ký tự.', { MIN_PATTERN_LENGTH }));
  }
  if (!input.categoryId) throw new Error('Chưa chọn danh mục.');
  const exists = db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, input.categoryId))
    .get();
  if (!exists) throw new Error('Danh mục không còn tồn tại.');
  const clash = listRules(db).find(
    (r) =>
      r.id !== input.id && patternKey(r.pattern) === patternKey(pattern) && r.type === input.type,
  );
  if (clash) throw new Error('Đã có quy tắc với cụm từ này.');

  const row = {
    pattern,
    type: input.type,
    categoryId: input.categoryId,
    autoAccept: input.autoAccept,
  };
  if (input.id) {
    db.update(captureRules).set(row).where(eq(captureRules.id, input.id)).run();
    return input.id;
  }
  const id = createId();
  db.insert(captureRules)
    .values({ id, ...row })
    .run();
  return id;
}

export function deleteRule(db: AppDatabase, id: string): void {
  db.delete(captureRules).where(eq(captureRules.id, id)).run();
}

export type CategoryGuess = {
  categoryId: string;
  /** rule: khớp quy tắc · history: trước giờ nội dung này hay vào danh mục này */
  source: 'rule' | 'history';
  rule: CaptureRule | null;
};

type GuessSubject = Pick<Capture, 'type' | 'content' | 'counterparty'>;

/** Danh mục hay dùng nhất cho giao dịch cùng tên (cùng loại), nếu một danh mục áp đảo */
function categoryFromHistory(db: AppDatabase, subject: GuessSubject): string | null {
  if (!subject.type) return null;
  const keys = [subject.content, subject.counterparty ?? '']
    .map((s) => normalizeForSearch(s))
    .filter((k, i, all) => k.length >= 2 && all.indexOf(k) === i);
  for (const key of keys) {
    const rows = db
      .select({ categoryId: transactions.categoryId, n: sql<number>`count(*)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, subject.type),
          eq(transactions.titleKey, key),
          isNotNull(transactions.categoryId),
          isNull(transactions.parentId),
          isNull(transactions.debtId),
          eq(transactions.isAdjustment, false),
        ),
      )
      .groupBy(transactions.categoryId)
      .all();
    const found = dominantCategory(new Map(rows.map((r) => [r.categoryId as string, Number(r.n)])));
    if (found) return found;
  }
  return null;
}

/** Đoán danh mục: quy tắc của bạn trước, không có thì theo lịch sử ghi chép */
export function guessCategory(
  db: AppDatabase,
  subject: GuessSubject,
  rules: readonly CaptureRule[] = listRules(db),
): CategoryGuess | null {
  const rule = matchRule(rules, subject);
  if (rule) return { categoryId: rule.categoryId, source: 'rule', rule };
  const categoryId = categoryFromHistory(db, subject);
  return categoryId ? { categoryId, source: 'history', rule: null } : null;
}

/**
 * Ghi luôn các giao dịch đang chờ khớp quy tắc bật "tự ghi". Chỉ ghi khi biết ví, có số tiền và
 * chưa có giao dịch trùng (đã ghi tay). Trả về số giao dịch đã tự ghi.
 */
export function autoAcceptCaptures(db: AppDatabase): number {
  const rules = listRules(db).filter((r) => r.autoAccept);
  if (!rules.length) return 0;
  const pending = db.select().from(captures).where(eq(captures.status, 'pending')).all();
  let done = 0;
  // Hai thông báo ghép thành một lần chuyển giữa ví của bạn thì không tự ghi riêng từng chiều
  const inPair = new Set(pairTransfers(pending).flatMap((p) => [p.out.id, p.in.id]));
  for (const c of pending) {
    if (!c.type || !c.amount || !c.accountId || inPair.has(c.id)) continue;
    const rule = matchRule(rules, c);
    if (!rule) continue;
    if (findDuplicate(db, c)) continue;
    try {
      const id = saveTransaction(db, {
        type: c.type,
        amount: c.amount,
        accountId: c.accountId,
        categoryId: rule.categoryId,
        title: c.content || c.counterparty || '',
        date: c.postedAt,
      });
      acceptCapture(db, c.id, id);
      done++;
    } catch {
      // không ghi được (vd ví đã xoá) → để nguyên trong hộp chờ cho bạn xử lý
    }
  }
  return done;
}

export type PendingWithGuess = PendingCapture & { guess: CategoryGuess | null };

/** Hộp chờ + danh mục đoán sẵn cho từng dòng */
export function listPendingWithGuess(db: AppDatabase): PendingWithGuess[] {
  const rules = listRules(db);
  return listPendingCaptures(db).map((p) => ({ ...p, guess: guessCategory(db, p.capture, rules) }));
}
