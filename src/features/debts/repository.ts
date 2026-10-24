// Ghi sổ nợ. Mỗi lần cho vay / vay / trả có chọn ví sẽ sinh một giao dịch ví gắn `debt_id`
// (giao dịch này không tính vào thống kê chi tiêu). Mọi thao tác ghi chạy trong một transaction SQLite.
import { eq, inArray } from 'drizzle-orm';

import {
  debtRecords,
  debtTerms,
  debts,
  people,
  transactions,
  type DebtDirection,
  type DebtRecordType,
} from '@/db/schema';
import { buildSchedule, type LoanMethod, type RateStep } from '@/core/loans';
import type { AppDatabase } from '@/db/types';
import { ensureLoanCategory } from '@/features/categories/repository';
import { deleteTransactions, saveTransaction } from '@/features/transactions/repository';
import type { DateString } from '@/lib/date';
import { createId } from '@/lib/id';
import { MAX_AMOUNT } from '@/lib/money';
import { normalizeForSearch } from '@/lib/text';

import { walletFlow } from './compute';
import type { DebtProposal } from './suggest';

export class DebtValidationError extends Error {}

const checkAmount = (amount: number) => {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new DebtValidationError('Số tiền phải lớn hơn 0.');
  }
  if (amount > MAX_AMOUNT) throw new DebtValidationError('Số tiền quá lớn.');
};

/** Tìm người theo tên (không phân biệt hoa thường / dấu); chưa có thì tạo mới */
export function ensurePerson(db: AppDatabase, rawName: string): string {
  const name = rawName.trim();
  if (!name) throw new DebtValidationError('Chưa nhập tên người.');
  const nameKey = normalizeForSearch(name) || 'khong-ten';
  const existing = db.select().from(people).where(eq(people.nameKey, nameKey)).get();
  if (existing) return existing.id;
  const id = createId();
  db.insert(people).values({ id, name, nameKey }).run();
  return id;
}

function titleFor(direction: DebtDirection, kind: 'open' | DebtRecordType, name: string): string {
  const lent = direction === 'lent';
  switch (kind) {
    case 'open':
      return lent ? `Cho ${name} vay` : `Vay ${name}`;
    case 'increase':
      return lent ? `Cho ${name} vay thêm` : `Vay thêm ${name}`;
    case 'repay':
      return lent ? `${name} trả nợ` : `Trả nợ ${name}`;
    default:
      return `Lãi ${name}`;
  }
}

export type DebtInput = {
  id?: string;
  personName: string;
  direction: DebtDirection;
  /** Số tiền gốc */
  amount: number;
  title?: string;
  /** Thời điểm (ms) */
  date: number;
  dueDate?: DateString | null;
  note?: string | null;
  /** Ví cho vay đi ra / vay về vào. Trống = không động vào ví */
  accountId?: string | null;
  /** Lãi suất & kỳ hạn: undefined = giữ nguyên, null = bỏ (nợ thường) */
  terms?: DebtTermsInput | null;
};

/** Thêm khoản nợ mới (không có id) hoặc sửa. Trả về id khoản nợ. */
export function saveDebt(db: AppDatabase, input: DebtInput): string {
  checkAmount(input.amount);
  return db.transaction((tx) => {
    const personId = ensurePerson(tx, input.personName);
    const name = input.personName.trim();
    const id = input.id ?? createId();
    const existing = input.id ? tx.select().from(debts).where(eq(debts.id, id)).get() : undefined;
    if (input.id && !existing) throw new DebtValidationError('Không tìm thấy khoản nợ.');

    // Giao dịch ví của lần ghi đầu tiên. Khoản nợ phải có trước vì giao dịch tham chiếu tới nó.
    const values = {
      personId,
      direction: input.direction,
      amount: input.amount,
      title: (input.title ?? '').trim(),
      date: input.date,
      dueDate: input.dueDate ?? null,
      note: input.note?.trim() || null,
      accountId: input.accountId ?? null,
    };
    if (existing) {
      tx.update(debts)
        .set({ ...values, updatedAt: Date.now() })
        .where(eq(debts.id, id))
        .run();
    } else {
      tx.insert(debts)
        .values({ id, ...values })
        .run();
    }

    const flow = walletFlow(input.direction, 'open');
    let transactionId = existing?.transactionId ?? null;
    if (input.accountId && flow) {
      transactionId = saveTransaction(tx, {
        id: transactionId ?? undefined,
        type: flow,
        amount: input.amount,
        accountId: input.accountId,
        title: titleFor(input.direction, 'open', name),
        note: input.note ?? null,
        date: input.date,
        debtId: id,
      });
    } else if (transactionId) {
      deleteTransactions(tx, [transactionId]);
      transactionId = null;
    }
    tx.update(debts).set({ transactionId }).where(eq(debts.id, id)).run();
    if (input.terms !== undefined) writeTerms(tx, id, input.terms);
    return id;
  });
}

export type DebtRecordInput = {
  debtId: string;
  type: DebtRecordType;
  amount: number;
  date: number;
  note?: string | null;
  /** Ví trả / nhận tiền. Bỏ trống với tiền lãi (không động vào ví) */
  accountId?: string | null;
};

export function addDebtRecord(db: AppDatabase, input: DebtRecordInput): string {
  checkAmount(input.amount);
  return db.transaction((tx) => writeRecord(tx, input));
}

/** Sửa một lần trả / vay thêm / lãi; giao dịch ví đi kèm được sửa, tạo hoặc xoá theo ví mới */
export function updateDebtRecord(
  db: AppDatabase,
  recordId: string,
  input: Omit<DebtRecordInput, 'debtId' | 'type'>,
): void {
  checkAmount(input.amount);
  db.transaction((tx) => {
    const record = tx.select().from(debtRecords).where(eq(debtRecords.id, recordId)).get();
    if (!record) throw new DebtValidationError('Không tìm thấy lần ghi này.');
    writeRecord(tx, { ...input, debtId: record.debtId, type: record.type }, record);
  });
}

/**
 * Trả một lần cho nhiều khoản của cùng một người (đã chia sẵn bằng `allocateRepayment`).
 * Mỗi khoản nhận một bản ghi trả riêng, tất cả trong một transaction.
 */
export function repayMany(
  db: AppDatabase,
  parts: readonly { debtId: string; amount: number }[],
  input: Omit<DebtRecordInput, 'debtId' | 'type' | 'amount'>,
): string[] {
  if (!parts.length) throw new DebtValidationError('Không có khoản nào để trả.');
  for (const p of parts) checkAmount(p.amount);
  return db.transaction((tx) =>
    parts.map((p) =>
      writeRecord(tx, { ...input, debtId: p.debtId, amount: p.amount, type: 'repay' }),
    ),
  );
}

/** Ghi (hoặc ghi đè `existing`) một bản ghi nợ cùng giao dịch ví của nó. Gọi trong transaction. */
function writeRecord(
  tx: AppDatabase,
  input: DebtRecordInput,
  existing?: typeof debtRecords.$inferSelect,
): string {
  const debt = tx.select().from(debts).where(eq(debts.id, input.debtId)).get();
  if (!debt) throw new DebtValidationError('Không tìm thấy khoản nợ.');
  const person = tx.select().from(people).where(eq(people.id, debt.personId)).get();
  const flow = walletFlow(debt.direction, input.type);
  let transactionId = existing?.transactionId ?? null;
  if (input.accountId && flow) {
    transactionId = saveTransaction(tx, {
      id: transactionId ?? undefined,
      type: flow,
      amount: input.amount,
      accountId: input.accountId,
      title: titleFor(debt.direction, input.type, person?.name ?? ''),
      note: input.note ?? null,
      date: input.date,
      debtId: debt.id,
    });
  } else if (transactionId) {
    deleteTransactions(tx, [transactionId]);
    transactionId = null;
  }
  const values = {
    amount: input.amount,
    date: input.date,
    note: input.note?.trim() || null,
    accountId: transactionId ? input.accountId! : null,
    transactionId,
  };
  if (existing) {
    tx.update(debtRecords)
      .set({ ...values, updatedAt: Date.now() })
      .where(eq(debtRecords.id, existing.id))
      .run();
    return existing.id;
  }
  const id = createId();
  tx.insert(debtRecords)
    .values({ id, debtId: debt.id, type: input.type, ...values })
    .run();
  return id;
}

export function deleteDebtRecord(db: AppDatabase, recordId: string): void {
  db.transaction((tx) => {
    const record = tx.select().from(debtRecords).where(eq(debtRecords.id, recordId)).get();
    if (!record) return;
    const linked = [record.transactionId, record.interestTransactionId].filter(
      (id): id is string => !!id,
    );
    if (linked.length) deleteTransactions(tx, linked);
    tx.delete(debtRecords).where(eq(debtRecords.id, recordId)).run();
  });
}

/** Đóng (lưu trữ) / mở lại một khoản nợ */
export function setDebtClosed(db: AppDatabase, debtId: string, closed: boolean): void {
  db.update(debts)
    .set({ closedAt: closed ? Date.now() : null, updatedAt: Date.now() })
    .where(eq(debts.id, debtId))
    .run();
}

/** Xoá khoản nợ cùng mọi lần trả và giao dịch ví đã sinh ra; người không còn khoản nào thì dọn luôn */
export function deleteDebt(db: AppDatabase, debtId: string): void {
  db.transaction((tx) => {
    const txIds = tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.debtId, debtId))
      .all()
      .map((r) => r.id);
    // Giao dịch lãi của các kỳ không gắn debt_id (để được tính là chi tiêu) → lấy qua bản ghi
    for (const r of tx.select().from(debtRecords).where(eq(debtRecords.debtId, debtId)).all()) {
      if (r.interestTransactionId) txIds.push(r.interestTransactionId);
    }
    if (txIds.length) deleteTransactions(tx, txIds);
    tx.delete(debtRecords).where(eq(debtRecords.debtId, debtId)).run();
    tx.delete(debts).where(eq(debts.id, debtId)).run();
    const used = new Set(
      tx
        .select({ p: debts.personId })
        .from(debts)
        .all()
        .map((r) => r.p),
    );
    const gone = tx
      .select({ id: people.id })
      .from(people)
      .all()
      .map((o) => o.id)
      .filter((id) => !used.has(id));
    if (gone.length) tx.delete(people).where(inArray(people.id, gone)).run();
  });
}

/**
 * Nhận một gợi ý (suggest.ts): tạo khoản nợ rồi LIÊN KẾT các giao dịch cũ vào nó (không tạo giao dịch mới,
 * số dư ví không đổi). Giao dịch đã liên kết không còn tính vào thống kê chi tiêu.
 */
export function adoptProposal(db: AppDatabase, p: DebtProposal): string {
  return db.transaction((tx) => {
    const personId = ensurePerson(tx, p.personName);
    const id = createId();
    tx.insert(debts)
      .values({
        id,
        personId,
        direction: p.direction,
        amount: p.opening.amount,
        date: p.opening.date,
        accountId: p.opening.accountId,
        transactionId: p.opening.id,
      })
      .run();
    tx.update(transactions).set({ debtId: id }).where(eq(transactions.id, p.opening.id)).run();
    for (const r of p.records) {
      tx.insert(debtRecords)
        .values({
          id: createId(),
          debtId: id,
          type: r.type,
          amount: r.amount,
          date: r.date,
          accountId: r.accountId,
          transactionId: r.txId,
        })
        .run();
      tx.update(transactions).set({ debtId: id }).where(eq(transactions.id, r.txId)).run();
    }
    return id;
  });
}

// ── Khoản nợ có lãi theo kỳ ──────────────────────────────────────────────────

export type DebtTermsInput = {
  annualRate: number;
  months: number;
  method: LoanMethod;
  /** Ngày giải ngân 'YYYY-MM-DD' */
  startDate: DateString;
  graceMonths?: number;
  monthlyFee?: number;
  dayCount?: 'monthly' | 'actual_365';
  rateSteps?: readonly RateStep[];
};

/** Gắn / sửa điều khoản lãi theo kỳ cho một khoản nợ; null = bỏ, thành nợ thường */
export function saveDebtTerms(db: AppDatabase, debtId: string, input: DebtTermsInput | null): void {
  db.transaction((tx) => writeTerms(tx, debtId, input));
}

function writeTerms(tx: AppDatabase, debtId: string, input: DebtTermsInput | null): void {
  const debt = tx.select().from(debts).where(eq(debts.id, debtId)).get();
  if (!debt) throw new DebtValidationError('Không tìm thấy khoản nợ.');
  if (!input) {
    tx.delete(debtTerms).where(eq(debtTerms.debtId, debtId)).run();
    return;
  }
  // Kiểm tra bằng chính bộ tính lịch: lãi suất, số kỳ, ân hạn hợp lệ
  buildSchedule({ ...input, principal: Math.max(1, debt.amount) });
  const values = {
    annualRate: input.annualRate,
    months: input.months,
    method: input.method,
    startDate: input.startDate,
    graceMonths: input.graceMonths ?? 0,
    monthlyFee: Math.round(input.monthlyFee ?? 0),
    dayCount: input.dayCount ?? 'monthly',
    rateSteps: input.rateSteps?.length ? JSON.stringify(input.rateSteps) : null,
  };
  const existing = tx.select().from(debtTerms).where(eq(debtTerms.debtId, debtId)).get();
  if (existing) {
    tx.update(debtTerms)
      .set({ ...values, updatedAt: Date.now() })
      .where(eq(debtTerms.id, existing.id))
      .run();
  } else {
    tx.insert(debtTerms)
      .values({ id: createId(), debtId, ...values })
      .run();
  }
}

export type InstallmentInput = {
  debtId: string;
  period: number;
  /** Phần gốc: trừ vào dư nợ, không tính chi tiêu */
  principal: number;
  /** Lãi + phí của kỳ: tính là chi tiêu (đi vay) hoặc thu nhập (cho vay) */
  interest: number;
  date: number;
  accountId?: string | null;
  note?: string | null;
};

/**
 * Ghi trả một kỳ: bản ghi trả gốc (kèm giao dịch ví gắn khoản nợ, không tính thống kê) và
 * một giao dịch lãi riêng thuộc danh mục "Lãi & phí vay" / "Lãi cho vay" (có tính thống kê).
 * Không chọn ví thì chỉ ghi sổ phần gốc.
 */
export function payInstallment(db: AppDatabase, input: InstallmentInput): string {
  if (!Number.isInteger(input.principal) || input.principal < 0) {
    throw new DebtValidationError('Số tiền gốc không hợp lệ.');
  }
  if (!Number.isInteger(input.interest) || input.interest < 0) {
    throw new DebtValidationError('Số tiền lãi không hợp lệ.');
  }
  if (input.principal + input.interest <= 0) {
    throw new DebtValidationError('Số tiền phải lớn hơn 0.');
  }
  return db.transaction((tx) => {
    const debt = tx.select().from(debts).where(eq(debts.id, input.debtId)).get();
    if (!debt) throw new DebtValidationError('Không tìm thấy khoản nợ.');
    const person = tx.select().from(people).where(eq(people.id, debt.personId)).get();
    const name = debt.title || person?.name || '';

    let interestTransactionId: string | null = null;
    if (input.accountId && input.interest > 0) {
      const kind = debt.direction === 'borrowed' ? 'expense' : 'income';
      interestTransactionId = saveTransaction(tx, {
        type: kind,
        amount: input.interest,
        accountId: input.accountId,
        categoryId: ensureLoanCategory(tx, kind),
        title: `Lãi kỳ ${input.period} · ${name}`,
        note: input.note ?? null,
        date: input.date,
      });
    }
    let id: string;
    if (input.principal > 0) {
      id = writeRecord(tx, {
        debtId: debt.id,
        type: 'repay',
        amount: input.principal,
        date: input.date,
        note: input.note,
        accountId: input.accountId,
      });
    } else {
      // Kỳ chỉ trả lãi (ân hạn / gốc cuối kỳ): vẫn cần một bản ghi để đánh dấu kỳ đã trả
      id = createId();
      tx.insert(debtRecords)
        .values({
          id,
          debtId: debt.id,
          type: 'repay',
          amount: 0,
          date: input.date,
          note: input.note?.trim() || null,
        })
        .run();
    }
    tx.update(debtRecords)
      .set({ period: input.period, interestTransactionId })
      .where(eq(debtRecords.id, id))
      .run();
    return id;
  });
}
