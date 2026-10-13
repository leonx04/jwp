import { listAccounts, saveAccount } from '@/features/accounts/repository';
import { deleteCategory, saveCategory } from '@/features/categories/repository';
import { listTransactions } from '@/features/transactions/queries';
import { saveTransaction } from '@/features/transactions/repository';
import { createTestDb } from '@/test/testDb';

import type { RawCapture } from './parse';
import { ingestCaptures, listPendingCaptures } from './repository';
import {
  autoAcceptCaptures,
  deleteRule,
  guessCategory,
  listPendingWithGuess,
  listRules,
  saveRule,
  type RuleInput,
} from './rulesRepository';

const T = 1_760_000_000_000;
const DAY = 86_400_000;
const sms = (nd: string, amount = '35,000', postedAt = T): RawCapture => ({
  source: 'sms',
  sender: 'MBBANK',
  title: '',
  text: `TK 0123 | GD: -${amount}VND | SD: 1,234,567VND | ND: ${nd}`,
  postedAt,
});

const setup = () => {
  const db = createTestDb();
  const mb = saveAccount(db, {
    name: 'MB',
    color: '#000',
    icon: 'bank:MB',
    includeInBalance: true,
  });
  const food = saveCategory(db, { name: 'Ăn uống', color: '#f00', icon: 'restaurant-outline' });
  const cafe = saveCategory(db, { name: 'Cà phê', color: '#0f0', icon: 'cafe-outline' });
  const rule = (over: Partial<RuleInput> & { pattern: string; categoryId: string }) =>
    saveRule(db, { type: null, autoAccept: false, ...over });
  return { db, mb, food, cafe, rule };
};

describe('saveRule', () => {
  it('kiểm tra đầu vào, chặn trùng cụm từ', () => {
    const { db, food, rule } = setup();
    expect(() => rule({ pattern: 'an', categoryId: food })).toThrow();
    expect(() => rule({ pattern: 'abc', categoryId: 'khong-co' })).toThrow();
    const id = rule({ pattern: ' Highlands  Coffee ', type: 'expense', categoryId: food });
    expect(listRules(db)[0]).toMatchObject({ id, pattern: 'Highlands Coffee' });
    expect(() => rule({ pattern: 'HIGHLANDS coffee', type: 'expense', categoryId: food })).toThrow(
      /Đã có/,
    );
    deleteRule(db, id);
    expect(listRules(db)).toHaveLength(0);
  });

  it('xoá danh mục thì quy tắc đi theo', () => {
    const { db, food, rule } = setup();
    rule({ pattern: 'grab', categoryId: food });
    deleteCategory(db, food);
    expect(listRules(db)).toHaveLength(0);
  });
});

describe('guessCategory', () => {
  it('ưu tiên quy tắc, rồi tới lịch sử ghi chép', () => {
    const { db, mb, food, cafe, rule } = setup();
    rule({ pattern: 'highlands', categoryId: cafe });
    expect(
      guessCategory(db, { type: 'expense', content: 'Highlands Coffee', counterparty: null }),
    ).toMatchObject({ categoryId: cafe, source: 'rule' });

    expect(
      guessCategory(db, { type: 'expense', content: 'Cơm tấm', counterparty: null }),
    ).toBeNull();
    for (let i = 0; i < 3; i++) {
      saveTransaction(db, {
        type: 'expense',
        amount: 40_000,
        accountId: mb,
        categoryId: food,
        title: 'Cơm tấm',
        date: T - i * DAY,
      });
    }
    expect(
      guessCategory(db, { type: 'expense', content: 'COM TAM', counterparty: null }),
    ).toMatchObject({ categoryId: food, source: 'history' });
    // Khác loại (thu) thì không dùng lịch sử của khoản chi
    expect(
      guessCategory(db, { type: 'income', content: 'Cơm tấm', counterparty: null }),
    ).toBeNull();
  });

  it('lịch sử lẫn lộn danh mục → không đoán', () => {
    const { db, mb, food, cafe } = setup();
    for (const categoryId of [food, cafe]) {
      saveTransaction(db, {
        type: 'expense',
        amount: 10_000,
        accountId: mb,
        categoryId,
        title: 'Mua hàng',
        date: T,
      });
    }
    expect(
      guessCategory(db, { type: 'expense', content: 'mua hang', counterparty: null }),
    ).toBeNull();
  });

  it('hộp chờ kèm danh mục đoán', () => {
    const { db, food, rule } = setup();
    rule({ pattern: 'pho thin', categoryId: food });
    ingestCaptures(db, [sms('PHO THIN 13 LO DUC')], listAccounts(db));
    const [item] = listPendingWithGuess(db);
    expect(item.guess).toMatchObject({ categoryId: food, source: 'rule' });
  });
});

describe('autoAcceptCaptures', () => {
  it('chỉ tự ghi quy tắc bật tự ghi, có ví, chưa trùng', () => {
    const { db, mb, food, cafe, rule } = setup();
    rule({ pattern: 'highlands', type: 'expense', categoryId: cafe, autoAccept: true });
    rule({ pattern: 'pho thin', type: 'expense', categoryId: food });
    ingestCaptures(
      db,
      [sms('Highlands Coffee', '35,000', T), sms('PHO THIN', '60,000', T + 600_000)],
      listAccounts(db),
    );
    expect(autoAcceptCaptures(db)).toBe(1);

    const txs = listTransactions(db, {});
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({
      type: 'expense',
      amount: 35_000,
      accountId: mb,
      categoryId: cafe,
      title: 'Highlands Coffee',
      date: T,
    });
    // Phở Thìn (quy tắc không tự ghi) vẫn chờ xác nhận
    expect(listPendingCaptures(db)).toHaveLength(1);
    // Chạy lại không ghi thêm
    expect(autoAcceptCaptures(db)).toBe(0);
  });

  it('đã ghi tay giao dịch trùng thì không tự ghi thêm', () => {
    const { db, mb, cafe, rule } = setup();
    rule({ pattern: 'highlands', type: 'expense', categoryId: cafe, autoAccept: true });
    saveTransaction(db, {
      type: 'expense',
      amount: 35_000,
      accountId: mb,
      categoryId: cafe,
      title: 'cafe',
      date: T + 600_000,
    });
    ingestCaptures(db, [sms('Highlands Coffee')], listAccounts(db));
    expect(autoAcceptCaptures(db)).toBe(0);
    expect(listTransactions(db, {})).toHaveLength(1);
  });
});
