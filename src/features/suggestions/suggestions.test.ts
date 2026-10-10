import { saveAccount } from '@/features/accounts/repository';
import { saveCategory } from '@/features/categories/repository';
import { ensureTag } from '@/features/tags/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { frequentTransferPairs, priceHistory, suggestTags, suggestTitles } from './engine';
import { matchKind, rankCandidates } from './rank';

const NOW = vnDateToMs('2026-10-11', '07:30');
const DAY = 86_400_000;

describe('xếp hạng', () => {
  it('kiểu khớp chuỗi', () => {
    expect(matchKind('ca phe', 'ca phe')).toBe('exact');
    expect(matchKind('ca phe sua', 'ca')).toBe('prefix');
    expect(matchKind('tra sua', 'sua')).toBe('word');
    expect(matchKind('banh mi', 'nh')).toBe('contains');
    expect(matchKind('banh mi', 'pho')).toBeNull();
  });

  it('dùng nhiều và gần đây lên trước; trùng số tiền được ưu tiên mạnh', () => {
    const items = [
      { id: 'old-frequent', count: 20, lastDate: NOW - 200 * DAY },
      { id: 'recent', count: 3, lastDate: NOW - 1 * DAY },
      { id: 'exact-amount', count: 2, lastDate: NOW - 40 * DAY, exactCount: 2, similarCount: 2 },
    ];
    expect(rankCandidates(items, NOW).map((i) => i.id)).toEqual([
      'exact-amount',
      'old-frequent',
      'recent',
    ]);
  });
});

describe('gợi ý từ lịch sử', () => {
  function seed() {
    const db = createTestDb();
    const cash = saveAccount(db, {
      name: 'Tiền mặt',
      color: '#000000',
      icon: 'cash-outline',
      includeInBalance: true,
    });
    const bank = saveAccount(db, {
      name: 'MB',
      color: '#000000',
      icon: 'card-outline',
      includeInBalance: true,
    });
    const momo = saveAccount(db, {
      name: 'Momo',
      color: '#000000',
      icon: 'phone-portrait-outline',
      includeInBalance: true,
    });
    const cafe = saveCategory(db, { name: 'Cà phê', color: '#000000', icon: 'cafe-outline' });
    const food = saveCategory(db, {
      name: 'Ăn uống',
      color: '#000000',
      icon: 'restaurant-outline',
    });
    const work = ensureTag(db, 'Công ty');
    const add = (title: string, amount: number, daysAgo: number, time: string, extra = {}) =>
      saveTransaction(db, {
        type: 'expense',
        amount,
        accountId: cash,
        title,
        date:
          NOW -
          daysAgo * DAY +
          (vnDateToMs('2026-10-11', time) - vnDateToMs('2026-10-11', '07:30')),
        ...extra,
      });
    // Cà phê buổi sáng, 35k, thường gắn tag Công ty, trả bằng Momo lần gần nhất
    for (let d = 1; d <= 6; d++)
      add('Cà phê sữa', 35_000, d, '07:15', { categoryId: cafe, tagIds: [work] });
    add('Cà phê sữa', 35_000, 0.5, '07:20', { categoryId: cafe, tagIds: [work], accountId: momo });
    // Phở 45k buổi trưa
    for (let d = 1; d <= 3; d++) add('Phở bò', 45_000, d, '12:00', { categoryId: food });
    // Cơm tối 35k (cùng giá cà phê) nhưng buổi tối
    add('Cơm tối', 35_000, 2, '19:00', { categoryId: food });
    saveTransaction(db, {
      type: 'transfer',
      amount: 500_000,
      accountId: bank,
      toAccountId: momo,
      date: NOW - DAY,
    });
    saveTransaction(db, {
      type: 'transfer',
      amount: 300_000,
      accountId: bank,
      toAccountId: momo,
      date: NOW - 2 * DAY,
    });
    saveTransaction(db, {
      type: 'transfer',
      amount: 200_000,
      accountId: bank,
      toAccountId: cash,
      date: NOW - 3 * DAY,
    });
    return { db, cash, bank, momo, cafe, food, work };
  }

  it('gõ không dấu "ca" → Cà phê sữa, tự điền danh mục, ví và tag của lần gần nhất', () => {
    const { db, cafe, momo, work } = seed();
    const [first] = suggestTitles(db, { type: 'expense', query: 'ca', now: NOW });
    expect(first).toMatchObject({
      title: 'Cà phê sữa',
      categoryId: cafe,
      accountId: momo,
      lastAmount: 35_000,
      count: 7,
    });
    expect(first.tagIds).toEqual([work]);
  });

  it('chỉ nhập số tiền 35.000 lúc 7:30 sáng → Cà phê sữa trước Cơm tối, không có Phở', () => {
    const { db } = seed();
    const titles = suggestTitles(db, { type: 'expense', amount: 35_000, now: NOW }).map(
      (s) => s.title,
    );
    expect(titles).toEqual(['Cà phê sữa', 'Cơm tối']);
  });

  it('số tiền tương tự ±15%: 42.000 → Phở bò (45k)', () => {
    const { db } = seed();
    expect(
      suggestTitles(db, { type: 'expense', amount: 42_000, now: NOW }).map((s) => s.title),
    ).toEqual(['Phở bò']);
  });

  it('lịch sử giá', () => {
    const { db } = seed();
    expect(priceHistory(db, 'pho bo', 'expense', NOW)).toMatchObject({
      count: 3,
      lastAmount: 45_000,
      minAmount: 45_000,
      maxAmount: 45_000,
    });
    expect(priceHistory(db, 'không có', 'expense', NOW)).toBeNull();
  });

  it('gợi ý tag theo danh mục / tiêu đề', () => {
    const { db, cafe, work } = seed();
    ensureTag(db, 'Du lịch');
    expect(suggestTags(db, { categoryId: cafe })[0].id).toBe(work);
    expect(suggestTags(db, { categoryId: cafe, exclude: [work] }).map((t) => t.name)).toEqual([
      'Du lịch',
    ]);
  });

  it('cặp ví hay chuyển', () => {
    const { db, bank, momo } = seed();
    expect(frequentTransferPairs(db)[0]).toEqual({ accountId: bank, toAccountId: momo, count: 2 });
  });
});
