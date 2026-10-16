// Bấm ✓ "đã thanh toán" trên một kỳ của lịch: ghi luôn theo đúng thông tin của lịch, không mở form,
// có "Hoàn tác" ngay trên thanh thông báo. Chỉ kỳ "ước tính" (chưa biết số tiền thật) mới cần mở form.
import { eq } from 'drizzle-orm';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { accounts } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { isCreditBill } from '@/features/credit/bills';
import { listAccounts } from '@/features/accounts/repository';
import { deleteTransaction, saveTransaction } from '@/features/transactions/repository';
import { todayVn, vnDateToMs } from '@/lib/date';

import type { Occurrence } from './occurrences';

/** Ví dùng để trả: ví thường dùng đã cài cho ví trả sau, không có thì ví thường đầu tiên */
function payerFor(db: AppDatabase, creditId: string): string | null {
  const credit = db.select().from(accounts).where(eq(accounts.id, creditId)).get();
  const all = listAccounts(db).filter((a) => !a.isCredit);
  return (all.find((a) => a.id === credit?.paymentAccountId) ?? all[0])?.id ?? null;
}

export type QuickPayResult =
  /** Đã ghi xong; `ids` dùng để hoàn tác */
  | { kind: 'done'; ids: string[] }
  /** Cần người dùng nhập thêm (số tiền ước tính, thiếu ví…) → mở form */
  | { kind: 'needs-form' };

/** Ghi giao dịch cho một kỳ của lịch. Không hiện thông báo — chỗ gọi lo phần giao diện. */
export function quickPay(db: AppDatabase, o: Occurrence, today = todayVn()): QuickPayResult {
  if (o.schedule.isEstimate) return { kind: 'needs-form' };
  const when = vnDateToMs(today, '12:00');
  const bill = isCreditBill(o.scheduleId);
  const link = bill ? {} : { scheduleId: o.scheduleId, scheduleDueDate: o.dueDate };

  return db.transaction((): QuickPayResult => {
    const credit = db.select().from(accounts).where(eq(accounts.id, o.schedule.accountId)).get();
    // Khoản chi từ ví trả sau: ghi khoản chi lên ví đó rồi chuyển tiền trả nợ từ ví thanh toán
    if (o.type === 'expense' && credit?.isCredit && !bill) {
      const payer = payerFor(db, credit.id);
      if (!payer) return { kind: 'needs-form' };
      const chargeDay = o.date <= today ? o.date : today;
      const charge = saveTransaction(db, {
        type: 'expense',
        amount: o.amount,
        accountId: credit.id,
        categoryId: o.schedule.categoryId,
        title: o.schedule.title,
        date: vnDateToMs(chargeDay, '12:00'),
      });
      const pay = saveTransaction(db, {
        type: 'transfer',
        amount: o.amount,
        accountId: payer,
        toAccountId: credit.id,
        title: o.schedule.title ? `Trả ${o.schedule.title}` : 'Trả nợ ví trả sau',
        date: when,
        ...link,
      });
      return { kind: 'done', ids: [pay, charge] };
    }
    if (!o.schedule.accountId) return { kind: 'needs-form' };
    const id = saveTransaction(db, {
      type: o.type,
      amount: o.amount,
      accountId: o.schedule.accountId,
      toAccountId: o.type === 'transfer' ? o.schedule.toAccountId : null,
      categoryId: o.type === 'transfer' ? null : o.schedule.categoryId,
      title: o.schedule.title,
      date: when,
      ...link,
    });
    return { kind: 'done', ids: [id] };
  });
}

/** Hoàn tác = xoá các giao dịch vừa ghi (kỳ của lịch tự trở lại chưa trả) */
export function undoQuickPay(db: AppDatabase, ids: readonly string[]): void {
  db.transaction(() => {
    for (const id of ids) deleteTransaction(db, id);
  });
}

/** Ghi + hiện thông báo "Đã ghi … · Hoàn tác". Trả true nếu đã xử lý xong, false nếu cần mở form. */
export function quickPayWithToast(
  db: AppDatabase,
  o: Occurrence,
  title: string,
  money: (amount: number) => string,
): boolean {
  const result = quickPay(db, o);
  if (result.kind !== 'done') return false;
  showSnackbar({
    text: `Đã ghi ${title} · ${money(o.amount)}`,
    tone: 'success',
    actionLabel: 'Hoàn tác',
    onAction: () => undoQuickPay(db, result.ids),
  });
  return true;
}
