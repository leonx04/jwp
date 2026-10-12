// Khoản chi theo lịch từ ví trả sau (vd "Spaylater tháng 9"): đã cộng vào dư nợ ngay khi lịch được tạo
// (xem getCreditSummary). Bấm "Đã thanh toán" = TRẢ NỢ: ghi khoản chi lên ví trả sau, rồi chuyển tiền
// từ ví thanh toán vào ví trả sau → dư nợ về như cũ, ví thanh toán giảm đúng số tiền.
import { eq } from 'drizzle-orm';
import { Alert } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { accounts } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { listAccounts } from '@/features/accounts/repository';
import type { Occurrence } from '@/features/schedules/occurrences';
import { saveTransaction } from '@/features/transactions/repository';
import { todayVn, vnDateToMs } from '@/lib/date';

import { isCreditBill } from './bills';

/** Ví dùng để trả nợ: ví thường dùng đã cài cho ví trả sau, không có thì ví thường đầu tiên */
function payerFor(db: AppDatabase, creditId: string): { id: string; name: string } | null {
  const credit = db.select().from(accounts).where(eq(accounts.id, creditId)).get();
  const all = listAccounts(db).filter((a) => !a.isCredit);
  const payer = all.find((a) => a.id === credit?.paymentAccountId) ?? all[0];
  return payer ? { id: payer.id, name: payer.name } : null;
}

/** Ghi khoản chi + chuyển tiền trả nợ trong một lần, đánh dấu kỳ của lịch là đã thanh toán */
export function payCreditCharge(
  db: AppDatabase,
  o: Occurrence,
  payerAccountId: string,
  today = todayVn(),
): void {
  const creditId = o.schedule.accountId;
  const chargeDay = o.date <= today ? o.date : today;
  db.transaction(() => {
    saveTransaction(db, {
      type: 'expense',
      amount: o.amount,
      accountId: creditId,
      categoryId: o.schedule.categoryId,
      title: o.schedule.title,
      date: vnDateToMs(chargeDay, '12:00'),
    });
    saveTransaction(db, {
      type: 'transfer',
      amount: o.amount,
      accountId: payerAccountId,
      toAccountId: creditId,
      title: o.schedule.title ? `Trả ${o.schedule.title}` : 'Trả nợ ví trả sau',
      date: vnDateToMs(today, '12:00'),
      scheduleId: o.scheduleId,
      scheduleDueDate: o.dueDate,
    });
  });
}

/**
 * Nếu kỳ này là khoản chi từ ví trả sau → hỏi xác nhận trả nợ và xử lý, trả về true (đã tiếp quản).
 * Ngược lại trả về false để chỗ gọi mở màn ghi giao dịch như bình thường.
 */
export function tryPayCreditCharge(
  db: AppDatabase,
  o: Occurrence,
  money: (amount: number) => string,
  onDone?: () => void,
): boolean {
  if (o.type !== 'expense' || isCreditBill(o.scheduleId)) return false;
  const credit = db.select().from(accounts).where(eq(accounts.id, o.schedule.accountId)).get();
  if (!credit?.isCredit) return false;
  const payer = payerFor(db, credit.id);
  if (!payer) {
    Alert.alert('Chưa có ví để trả nợ', 'Hãy tạo một ví thường (ngân hàng, tiền mặt) trước.');
    return true;
  }
  Alert.alert(
    `Trả nợ ví ${credit.name}?`,
    `Trả ${money(o.amount)} từ ${payer.name} vào ${credit.name}. Dư nợ sẽ giảm tương ứng, ${payer.name} bị trừ ${money(o.amount)}.`,
    [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Trả nợ',
        onPress: () => {
          try {
            payCreditCharge(db, o, payer.id);
            showSnackbar({ text: `Đã trả ${money(o.amount)} cho ${credit.name}`, tone: 'success' });
            onDone?.();
          } catch (error) {
            Alert.alert('Chưa trả được', error instanceof Error ? error.message : String(error));
          }
        },
      },
    ],
  );
  return true;
}
