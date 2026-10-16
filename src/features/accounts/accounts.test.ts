import { createTestDb } from '@/test/testDb';

import { getAccountBalances } from './queries';
import {
  applyBankLogos,
  bankLogoCandidates,
  listAccounts,
  reorderAccounts,
  saveAccount,
} from './repository';

const base = { color: '#000000', icon: 'wallet-outline', includeInBalance: true };

describe('logo ngân hàng cho ví', () => {
  it('nhận diện ví có tên ngân hàng / ví điện tử và gắn logo', () => {
    const db = createTestDb();
    saveAccount(db, { ...base, name: 'Tiền mặt', icon: 'cash-outline' });
    saveAccount(db, { ...base, name: 'MB bank' });
    saveAccount(db, { ...base, name: 'Ví Shoppe' });
    saveAccount(db, { ...base, name: 'Techcombank', icon: 'bank:TCB' });

    const candidates = bankLogoCandidates(listAccounts(db));
    expect(candidates.map((c) => [c.account.name, c.bank.code])).toEqual([
      ['MB bank', 'MB'],
      ['Ví Shoppe', 'SHOPEEPAY'],
    ]);

    expect(applyBankLogos(db)).toBe(2);
    const icons = Object.fromEntries(listAccounts(db).map((a) => [a.name, a.icon]));
    expect(icons).toEqual({
      'Tiền mặt': 'cash-outline',
      'MB bank': 'bank:MB',
      'Ví Shoppe': 'bank:SHOPEEPAY',
      Techcombank: 'bank:TCB',
    });
    expect(bankLogoCandidates(listAccounts(db))).toHaveLength(0);
  });
});

describe('ví trả sau', () => {
  it('lưu hạn mức, ngày chốt, hạn thanh toán, ví trả bill', () => {
    const db = createTestDb();
    const bank = saveAccount(db, { ...base, name: 'MB bank' });
    const id = saveAccount(db, {
      ...base,
      name: 'SPayLater',
      includeInBalance: false,
      credit: { limit: 5_000_000, statementDay: 31, dueDay: 10, paymentAccountId: bank },
    });
    expect(listAccounts(db).find((a) => a.id === id)).toMatchObject({
      isCredit: true,
      creditLimit: 5_000_000,
      statementDay: 31,
      dueDay: 10,
      paymentAccountId: bank,
    });
  });

  it('ngày không hợp lệ bị bỏ; tắt trả sau thì xoá cài đặt', () => {
    const db = createTestDb();
    const id = saveAccount(db, {
      ...base,
      name: 'Thẻ',
      credit: { limit: -1, statementDay: 40, dueDay: 0, paymentAccountId: null },
    });
    expect(listAccounts(db)[0]).toMatchObject({
      isCredit: true,
      creditLimit: null,
      statementDay: null,
      dueDay: null,
    });
    saveAccount(db, { ...base, id, name: 'Thẻ', credit: null });
    expect(listAccounts(db)[0]).toMatchObject({
      isCredit: false,
      creditLimit: null,
      statementDay: null,
    });
  });
});

describe('sắp xếp thứ tự ví', () => {
  it('reorderAccounts đổi thứ tự ở danh sách ví và số dư', () => {
    const db = createTestDb();
    const mk = (name: string) =>
      saveAccount(db, { name, color: '#000', icon: 'cash-outline', includeInBalance: true });
    const a = mk('A');
    const b = mk('B');
    const c = mk('C');
    expect(getAccountBalances(db).map((x) => x.name)).toEqual(['A', 'B', 'C']);
    reorderAccounts(db, [c, a, b]);
    expect(getAccountBalances(db).map((x) => x.name)).toEqual(['C', 'A', 'B']);
    expect(listAccounts(db).map((x) => x.name)).toEqual(['C', 'A', 'B']);
  });
});
