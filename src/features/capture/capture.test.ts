import { listAccounts, saveAccount } from '@/features/accounts/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { createTestDb } from '@/test/testDb';

import type { RawCapture } from './parse';
import {
  acceptCapture,
  countPendingCaptures,
  dismissCapture,
  guessAccount,
  ingestCaptures,
  listPendingCaptures,
  listRecentCaptures,
} from './repository';

const T = 1_760_000_000_000;
const raw = (over: Partial<RawCapture> = {}): RawCapture => ({
  source: 'sms',
  sender: 'MBBANK',
  title: '',
  text: 'TK 0123 | GD: +500,000VND | SD: 1,234,567VND | ND: Luong',
  postedAt: T,
  ...over,
});

const setup = () => {
  const db = createTestDb();
  const mb = saveAccount(db, {
    name: 'MB bank',
    color: '#000',
    icon: 'bank:MB',
    includeInBalance: true,
  });
  const tp = saveAccount(db, {
    name: 'TP Bank',
    color: '#000',
    icon: 'bank:TPB',
    includeInBalance: true,
  });
  return { db, mb, tp, accounts: listAccounts(db) };
};

describe('ingestCaptures', () => {
  it('đọc được → chờ xác nhận, đoán ví theo ngân hàng', () => {
    const { db, mb, accounts } = setup();
    const r = ingestCaptures(db, [raw()], accounts);
    expect(r).toMatchObject({ added: 1, pending: 1, unparsed: 0, duplicates: 0 });
    const [item] = listPendingCaptures(db);
    expect(item.capture).toMatchObject({
      type: 'income',
      amount: 500_000,
      balanceAfter: 1_234_567,
      accountId: mb,
    });
    expect(item.capture.content).toBe('Luong');
    expect(item.duplicateOf).toBeNull();
  });

  it('chống trùng: cùng nội dung trong cùng phút chỉ lưu một lần', () => {
    const { db, accounts } = setup();
    ingestCaptures(db, [raw()], accounts);
    const again = ingestCaptures(db, [raw({ postedAt: T + 5_000 })], accounts);
    expect(again).toMatchObject({ added: 0, duplicates: 1 });
    expect(countPendingCaptures(db)).toBe(1);
  });

  it('không đọc được → unparsed (chỉ để xem nhật ký), không vào hộp chờ', () => {
    const { db, accounts } = setup();
    const r = ingestCaptures(db, [raw({ text: 'Ma OTP cua quy khach la 123456' })], accounts);
    expect(r).toMatchObject({ added: 1, pending: 0, unparsed: 1 });
    expect(countPendingCaptures(db)).toBe(0);
    expect(listRecentCaptures(db)).toHaveLength(1);
  });

  it('báo giao dịch đã ghi tay trùng (cùng loại, số tiền, ví, gần giờ)', () => {
    const { db, mb, accounts } = setup();
    const txId = saveTransaction(db, {
      type: 'income',
      amount: 500_000,
      accountId: mb,
      date: T + 600_000,
    });
    ingestCaptures(db, [raw()], accounts);
    expect(listPendingCaptures(db)[0].duplicateOf).toBe(txId);
  });

  it('khác ví hoặc cách xa thì không coi là trùng', () => {
    const { db, tp, accounts } = setup();
    saveTransaction(db, { type: 'income', amount: 500_000, accountId: tp, date: T });
    saveTransaction(db, {
      type: 'income',
      amount: 500_000,
      accountId: accounts[0].id,
      date: T + 10 * 3_600_000,
    });
    ingestCaptures(db, [raw()], accounts);
    expect(listPendingCaptures(db)[0].duplicateOf).toBeNull();
  });
});

describe('xử lý', () => {
  it('xác nhận → accepted; bỏ qua → dismissed; cả hai rời hộp chờ', () => {
    const { db, mb, accounts } = setup();
    ingestCaptures(
      db,
      [raw(), raw({ text: 'TK 1 | GD: -35,000VND | SD: 100,000VND', postedAt: T + 120_000 })],
      accounts,
    );
    const [a, b] = listPendingCaptures(db);
    const txId = saveTransaction(db, {
      type: a.capture.type!,
      amount: a.capture.amount!,
      accountId: mb,
      date: T,
    });
    acceptCapture(db, a.capture.id, txId);
    dismissCapture(db, b.capture.id);
    expect(countPendingCaptures(db)).toBe(0);
    const log = listRecentCaptures(db);
    expect(log.map((c) => c.status).sort()).toEqual(['accepted', 'dismissed']);
  });
});

describe('guessAccount', () => {
  it('bỏ ví đã lưu trữ và ví trả sau', () => {
    const base = { archived: false, isCredit: false };
    expect(guessAccount([{ id: 'a', icon: 'bank:MB', ...base }], 'MB')).toBe('a');
    expect(
      guessAccount([{ id: 'a', icon: 'bank:MB', archived: true, isCredit: false }], 'MB'),
    ).toBeNull();
    expect(
      guessAccount([{ id: 'a', icon: 'bank:MB', archived: false, isCredit: true }], 'MB'),
    ).toBeNull();
    expect(guessAccount([{ id: 'a', icon: 'bank:MB', ...base }], null)).toBeNull();
  });
});
