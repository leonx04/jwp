import { listAccounts, saveAccount } from '@/features/accounts/repository';
import { saveCategory } from '@/features/categories/repository';
import { listTransactions } from '@/features/transactions/queries';
import { createTestDb } from '@/test/testDb';

import { mentionsOwner, pairTransfers, type PairCandidate } from './pairing';
import type { RawCapture } from './parse';
import { ingestCaptures, listPendingCaptures } from './repository';
import { autoAcceptCaptures, saveRule } from './rulesRepository';
import { autoAcceptTransfers, listPendingGrouped } from './transfers';

const T = 1_760_000_000_000;
const c = (
  id: string,
  type: 'income' | 'expense',
  amount: number,
  accountId: string | null,
  at: number,
): PairCandidate => ({ id, type, amount, accountId, postedAt: at });

describe('pairTransfers', () => {
  it('chi ở ví A + thu ở ví B cùng số tiền trong 2 phút → một cặp', () => {
    const pairs = pairTransfers([
      c('o', 'expense', 200_000, 'mb', T),
      c('i', 'income', 200_000, 'tp', T + 40_000),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].out.id).toBe('o');
    expect(pairs[0].in.id).toBe('i');
  });

  it('không ghép: khác số tiền, cùng ví, quá xa nhau, chưa biết ví', () => {
    expect(pairTransfers([c('o', 'expense', 1, 'a', T), c('i', 'income', 2, 'b', T)])).toHaveLength(
      0,
    );
    expect(pairTransfers([c('o', 'expense', 1, 'a', T), c('i', 'income', 1, 'a', T)])).toHaveLength(
      0,
    );
    expect(
      pairTransfers([c('o', 'expense', 1, 'a', T), c('i', 'income', 1, 'b', T + 5 * 60_000)]),
    ).toHaveLength(0);
    expect(
      pairTransfers([c('o', 'expense', 1, null, T), c('i', 'income', 1, 'b', T)]),
    ).toHaveLength(0);
  });

  it('nhiều khoản trùng số tiền: ghép cặp gần nhau nhất, mỗi thông báo một cặp', () => {
    const pairs = pairTransfers([
      c('o1', 'expense', 100, 'a', T),
      c('o2', 'expense', 100, 'a', T + 60_000),
      c('i1', 'income', 100, 'b', T + 5_000),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].out.id).toBe('o1');
  });
});

describe('mentionsOwner', () => {
  it('nhận tên mình dù viết hoa / không dấu / viết liền; cần tên đủ ≥ 2 từ', () => {
    expect(mentionsOwner('Nguyễn Xuân Dũng', 'NGUYEN XUAN DUNG chuyen tien')).toBe(true);
    expect(mentionsOwner('Nguyễn Xuân Dũng', 'NGUYENXUANDUNG')).toBe(true);
    expect(mentionsOwner('Nguyễn Xuân Dũng', 'Nguyen Van A')).toBe(false);
    expect(mentionsOwner('Dũng', 'dung')).toBe(false);
    expect(mentionsOwner('', 'abc')).toBe(false);
  });
});

const sms = (
  sender: string,
  sign: '+' | '-',
  amount: string,
  nd: string,
  at: number,
): RawCapture => ({
  source: 'sms',
  sender,
  title: '',
  text: `TK 0123 | GD: ${sign}${amount}VND | SD: 1,000,000VND | ND: ${nd}`,
  postedAt: at,
});

const setup = () => {
  const db = createTestDb();
  saveAccount(db, { name: 'MB bank', color: '#000', icon: 'bank:MB', includeInBalance: true });
  saveAccount(db, { name: 'TP Bank', color: '#000', icon: 'bank:TPB', includeInBalance: true });
  const accounts = listAccounts(db);
  ingestCaptures(
    db,
    [
      sms('MBBANK', '-', '200,000', 'NGUYEN XUAN DUNG chuyen tien', T),
      sms('TPBank', '+', '200,000', 'NGUYEN XUAN DUNG chuyen tien', T + 30_000),
    ],
    accounts,
  );
  return { db, accounts };
};

describe('hộp chờ gom nhóm', () => {
  it('hai thông báo ngược chiều thành một cặp, không còn thông báo lẻ', () => {
    const { db } = setup();
    const g = listPendingGrouped(db, 'Nguyễn Xuân Dũng');
    expect(g.pairs).toHaveLength(1);
    expect(g.singles).toHaveLength(0);
    expect(g.pairs[0].out.capture.type).toBe('expense');
  });

  it('thông báo thu lẻ có tên mình → gợi ý chuyển từ ví khác của chính mình', () => {
    const db = createTestDb();
    saveAccount(db, { name: 'TP Bank', color: '#000', icon: 'bank:TPB', includeInBalance: true });
    ingestCaptures(db, [sms('TPBank', '+', '500,000', 'NGUYEN XUAN DUNG', T)], listAccounts(db));
    const g = listPendingGrouped(db, 'Nguyễn Xuân Dũng');
    expect(g.singles[0].ownerHint).toBe(true);
    expect(listPendingGrouped(db, '').singles[0].ownerHint).toBe(false);
  });

  it('tự ghi chuyển khoản: một giao dịch chuyển, cả hai thông báo hết chờ; chạy lại không ghi thêm', () => {
    const { db, accounts } = setup();
    expect(autoAcceptTransfers(db)).toBe(1);
    const txs = listTransactions(db, {});
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ type: 'transfer', amount: 200_000 });
    expect(txs[0].accountName).toBe('MB bank');
    expect(txs[0].toAccountName).toBe('TP Bank');
    expect(listPendingCaptures(db)).toHaveLength(0);
    expect(autoAcceptTransfers(db)).toBe(0);
    expect(accounts).toHaveLength(2);
  });

  it('quy tắc tự ghi không ghi riêng từng chiều của một cặp chuyển', () => {
    const { db } = setup();
    const cat = saveCategory(db, { name: 'Khác', color: '#000', icon: 'pricetag-outline' });
    saveRule(db, { pattern: 'chuyen tien', type: null, categoryId: cat, autoAccept: true });
    expect(autoAcceptCaptures(db)).toBe(0);
    expect(listTransactions(db, {})).toHaveLength(0);
    expect(listPendingCaptures(db)).toHaveLength(2);
  });
});
