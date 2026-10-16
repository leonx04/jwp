import { t as translate } from '@/lib/i18n';
// Đối chiếu số dư: khi số dư thật (ngân hàng) khác số dư trong app, đoán nguyên nhân từ các giao dịch gần đây.
// Hàm thuần, chỉ gợi ý — người dùng quyết định sửa thế nào.
export type ReconcileTx = {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  /** ms */
  date: number;
  title: string;
  accountId: string;
  toAccountId: string | null;
  isAdjustment: boolean;
};

export type HintKind = 'duplicate' | 'wrong-type' | 'wrong-wallet' | 'fee' | 'missing';

export type Hint = {
  kind: HintKind;
  text: string;
  /** Giao dịch liên quan (bấm để mở) */
  txId?: string;
};

/** Các mức phí ngân hàng hay gặp (đồng): chuyển khoản nhanh, SMS banking, duy trì tài khoản… */
const COMMON_FEES = new Set([
  1_000, 1_100, 2_000, 2_200, 3_300, 4_400, 5_000, 5_500, 6_600, 7_700, 8_800, 9_900, 10_000,
  11_000, 16_500, 22_000, 33_000,
]);

const DAY = 86_400_000;
const DUPLICATE_WINDOW = 2 * DAY;

const flowOf = (tx: ReconcileTx, accountId: string): 'in' | 'out' | null => {
  if (tx.type === 'income') return tx.accountId === accountId ? 'in' : null;
  if (tx.type === 'expense') return tx.accountId === accountId ? 'out' : null;
  if (tx.toAccountId === accountId) return 'in';
  if (tx.accountId === accountId) return 'out';
  return null;
};

type Input = {
  /** Số dư thật − số dư trong app (dương = app đang thiếu tiền, âm = app đang thừa) */
  diff: number;
  accountId: string;
  /** Giao dịch gần đây (mọi ví) */
  txs: readonly ReconcileTx[];
  /** Tên ví theo id, dùng cho câu chữ */
  accountNames: ReadonlyMap<string, string>;
  /** Định dạng tiền */
  money: (amount: number) => string;
};

const label = (tx: ReconcileTx) =>
  tx.title.trim() || (tx.type === 'income' ? 'Khoản thu' : 'Khoản chi');

export function reconcileHints({ diff, accountId, txs, accountNames, money }: Input): Hint[] {
  if (diff === 0) return [];
  const abs = Math.abs(diff);
  const hints: Hint[] = [];
  const real = txs.filter((t) => !t.isAdjustment);
  const mine = real.filter((t) => flowOf(t, accountId) !== null);

  // 1. Ghi trùng: hai giao dịch cùng loại, cùng số tiền, gần nhau, số tiền đúng bằng chênh lệch
  //    (app thiếu tiền → trùng khoản chi · app thừa tiền → trùng khoản thu)
  const dupType = diff > 0 ? 'expense' : 'income';
  const sameAmount = mine.filter((t) => t.type === dupType && t.amount === abs);
  for (const a of sameAmount) {
    const twin = sameAmount.find(
      (b) => b.id !== a.id && Math.abs(b.date - a.date) <= DUPLICATE_WINDOW,
    );
    if (twin && a.id < twin.id) {
      hints.push({
        kind: 'duplicate',
        txId: a.id,
        text: translate(
          '“{label}” {abs} xuất hiện hai lần gần nhau — có thể ghi trùng, xoá một khoản sẽ khớp.',
          { label: label(a), abs: money(abs) },
        ),
      });
    }
  }

  // 2. Ghi nhầm loại: chênh lệch đúng bằng 2 lần một giao dịch (thu ↔ chi)
  for (const t of mine) {
    if (t.amount * 2 !== abs) continue;
    const wrongWayExpense = diff > 0 && t.type === 'expense';
    const wrongWayIncome = diff < 0 && t.type === 'income';
    if (wrongWayExpense || wrongWayIncome) {
      hints.push({
        kind: 'wrong-type',
        txId: t.id,
        text: translate(
          '“{label}” {amount} đang ghi là {type} — nếu thật ra là {type2} thì số dư sẽ khớp.',
          {
            label: label(t),
            amount: money(t.amount),
            type: t.type === 'expense' ? 'chi' : 'thu',
            type2: t.type === 'expense' ? 'thu' : 'chi',
          },
        ),
      });
    }
  }

  // 3. Ghi nhầm ví: giao dịch cùng số tiền nằm ở ví khác (hoặc ở ví này nhưng đúng ra thuộc ví khác)
  for (const t of real) {
    if (t.type === 'transfer' || t.amount !== abs) continue;
    const here = t.accountId === accountId;
    if (!here && diff < 0 && t.type === 'income') {
      // app thừa tiền, mà khoản thu cùng số nằm ở ví khác → không liên quan; bỏ qua
      continue;
    }
    if (!here && diff > 0 && t.type === 'income') {
      hints.push({
        kind: 'wrong-wallet',
        txId: t.id,
        text: translate('Khoản thu “{label}” {abs} đang ở ví {accountId} — có thể thuộc ví này.', {
          label: label(t),
          abs: money(abs),
          accountId: accountNames.get(t.accountId) ?? 'khác',
        }),
      });
    } else if (!here && diff < 0 && t.type === 'expense') {
      hints.push({
        kind: 'wrong-wallet',
        txId: t.id,
        text: translate(
          'Khoản chi “{label}” {abs} đang ở ví {accountId} — có thể thật ra trả từ ví này.',
          { label: label(t), abs: money(abs), accountId: accountNames.get(t.accountId) ?? 'khác' },
        ),
      });
    } else if (here && diff > 0 && t.type === 'expense') {
      hints.push({
        kind: 'wrong-wallet',
        txId: t.id,
        text: translate('Khoản chi “{label}” {abs} ở ví này — có thể thật ra trả từ ví khác.', {
          label: label(t),
          abs: money(abs),
        }),
      });
    } else if (here && diff < 0 && t.type === 'income') {
      hints.push({
        kind: 'wrong-wallet',
        txId: t.id,
        text: translate('Khoản thu “{label}” {abs} ở ví này — có thể thật ra vào ví khác.', {
          label: label(t),
          abs: money(abs),
        }),
      });
    }
  }

  // 4. Phí ngân hàng: app thừa tiền một khoản đúng mức phí hay gặp (chưa ghi phí)
  if (diff < 0 && COMMON_FEES.has(abs)) {
    hints.push({
      kind: 'fee',
      text: translate(
        '{abs} là mức phí ngân hàng hay gặp (phí chuyển khoản, SMS banking, duy trì tài khoản…) — có thể bạn chưa ghi.',
        { abs: money(abs) },
      ),
    });
  }

  // 5. Mặc định: thiếu một khoản thu / chi
  hints.push({
    kind: 'missing',
    text:
      diff > 0
        ? translate('Có thể thiếu một khoản thu {abs} chưa ghi (lương, tiền nhận, lãi…).', {
            abs: money(abs),
          })
        : translate('Có thể thiếu một khoản chi {abs} chưa ghi.', { abs: money(abs) }),
  });
  return hints;
}
