import { count } from 'drizzle-orm';

import {
  accounts,
  debtRecords,
  debts,
  scheduleOccurrences,
  schedules,
  transactionTags,
  transactions,
} from '@/db/schema';
import { getAccountBalances, totalBalance } from '@/features/accounts/queries';
import { createTestDb } from '@/test/testDb';

import {
  ivySample,
  ivySampleBytes,
  ivySampleExpected,
  ivySampleZip,
} from './__fixtures__/ivySample';
import { ivyColorToHex, mapIvyBackup } from './mapper';
import { IvyReadError, readIvyBackup } from './read';
import { verifyIvyImport, writeIvyImport } from './writer';

const NOW = Date.UTC(2026, 9, 11, 3, 0); // 11/10/2026 10:00 giờ VN

const loadPlan = () => mapIvyBackup(readIvyBackup(ivySampleBytes()).backup, NOW);

describe('đọc file backup Ivy', () => {
  it('đọc JSON UTF-16BE (định dạng file thật)', () => {
    const { backup, encoding } = readIvyBackup(ivySampleBytes());
    expect(encoding).toBe('utf-16be');
    expect(backup.accounts).toHaveLength(4);
    // Trường vắng mặt → mặc định của Ivy
    expect(backup.accounts[0].orderNum).toBe(0);
    expect(backup.accounts[0].includeInBalance).toBe(true);
  });

  it('đọc file .zip Ivy xuất ra', () => {
    const { backup, entryName } = readIvyBackup(ivySampleZip());
    expect(entryName).toMatch(/\.json$/);
    expect(backup.transactions).toHaveLength(ivySample.transactions.length);
  });

  it('đọc JSON UTF-8', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(ivySample));
    expect(readIvyBackup(bytes).encoding).toBe('utf-8');
  });

  it('báo lỗi dễ hiểu với file không phải backup Ivy', () => {
    expect(() => readIvyBackup(new TextEncoder().encode('hello'))).toThrow(IvyReadError);
    expect(() => readIvyBackup(new TextEncoder().encode('{"foo":1}'))).toThrow(/accounts/);
  });
});

describe('chuyển đổi dữ liệu Ivy → JWP', () => {
  const plan = loadPlan();

  it('màu ARGB có dấu → hex', () => {
    expect(ivyColorToHex(-49056)).toBe('#FF4060');
    expect(ivyColorToHex(-1)).toBe('#FFFFFF');
    expect(ivyColorToHex(0)).toBe('#5B5BD6');
  });

  it('bỏ ví đã xoá, giữ thứ tự (ví thiếu orderNum = 0 → đứng đầu)', () => {
    expect(plan.accounts.map((a) => a.id)).toEqual(['A1', 'A2', 'A3']);
    expect(plan.balances.map((b) => b.accountId)).toEqual(['A1', 'A2', 'A3']);
    expect(plan.accounts[0].icon).toBe('cash-outline');
    expect(plan.accounts[1].icon).toBe('wallet-outline'); // icon rỗng → mặc định
    expect(plan.accounts[2].includeInBalance).toBe(false);
  });

  it('thống kê', () => {
    expect(plan.stats).toMatchObject({
      accounts: 3,
      categories: 3,
      tags: 1,
      income: 2,
      expense: 7,
      transfer: 2,
      upcomingSkipped: 4,
      schedules: 3,
      activeSchedules: 2,
      deletedSkipped: 1,
      uncategorized: 4,
      untitled: 3, // T3, T5, T12
      orphanRuleLinks: 1,
      people: 1,
      debts: 2,
      budgets: 1,
    });
  });

  it('số dư từng ví tính giống Ivy', () => {
    const byId = Object.fromEntries(plan.balances.map((b) => [b.accountId, b.balance]));
    expect(byId).toEqual(ivySampleExpected.balances);
    expect(plan.totalBalance).toBe(ivySampleExpected.total);
  });

  it('số tiền luôn là số nguyên', () => {
    expect(plan.transactions.every((t) => Number.isInteger(t.amount))).toBe(true);
  });

  it('chuyển khoản thiếu ví nhận → khoản chi, có cảnh báo', () => {
    const t12 = plan.transactions.find((t) => t.id === 'T12')!;
    expect(t12.type).toBe('expense');
    expect(t12.toAccountId).toBeNull();
    expect(plan.warnings.some((w) => w.includes('thiếu ví nhận'))).toBe(true);
  });

  it('chuyển khoản không có toAmount → bằng amount', () => {
    expect(plan.transactions.find((t) => t.id === 'T5')!.toAmount).toBe(500_000);
  });

  it('lịch định kỳ: kỳ đã trả, kỳ bỏ qua, kỳ sắp tới khớp Ivy', () => {
    const r1 = plan.schedules.find((s) => s.id === 'R1')!;
    expect(r1).toMatchObject({ frequency: 'monthly', startDate: '2026-08-10', active: true });
    expect(plan.ivyUpcoming.R1).toEqual(['2026-10-10', '2026-11-10', '2026-12-10']);
    expect(plan.occurrences).toEqual([
      {
        scheduleId: 'R1',
        dueDate: '2026-08-10',
        status: 'skipped',
        transactionId: null,
        amount: null,
      },
      {
        scheduleId: 'R1',
        dueDate: '2026-09-10',
        status: 'paid',
        transactionId: 'T6',
        amount: 2_800_000,
      },
    ]);
    expect(plan.transactions.find((t) => t.id === 'T6')).toMatchObject({
      scheduleId: 'R1',
      scheduleDueDate: '2026-09-10',
    });
    expect(plan.warnings.filter((w) => w.includes('khác với Ivy'))).toEqual([]);
  });

  it('khoản một lần bị dời ngày → lấy ngày mới; hết kỳ → ngừng', () => {
    expect(plan.schedules.find((s) => s.id === 'R2')).toMatchObject({
      frequency: 'once',
      startDate: '2026-10-22',
      active: true,
    });
    expect(plan.schedules.find((s) => s.id === 'R3')).toMatchObject({ active: false });
  });

  it('liên kết tới quy tắc đã xoá → bỏ liên kết, giữ giao dịch', () => {
    expect(plan.transactions.find((t) => t.id === 'T10')!.scheduleId).toBeUndefined();
  });

  it('tag trùng tên không dấu được gộp, bỏ liên kết tới giao dịch không tồn tại', () => {
    expect(plan.tags).toEqual([
      expect.objectContaining({ id: 'G1', name: 'Du lịch', nameKey: 'du lich' }),
    ]);
    expect(plan.transactionTags).toEqual([{ transactionId: 'T11', tagId: 'G1' }]);
  });

  it('khoản vay → sổ nợ (gộp người trùng tên), lần trả / vay thêm / lãi', () => {
    expect(plan.people).toHaveLength(1);
    expect(plan.debts).toEqual([
      expect.objectContaining({
        id: 'L1',
        direction: 'lent',
        amount: 500_000,
        transactionId: 'T13',
      }),
      expect.objectContaining({ id: 'L2', direction: 'borrowed', amount: 300_000 }),
    ]);
    expect(plan.debtRecords.map((r) => [r.id, r.type, r.transactionId])).toEqual([
      ['LR1', 'repay', 'T14'],
      ['LR2', 'increase', null],
      ['LR3', 'interest', null],
    ]);
    expect(plan.transactions.find((t) => t.id === 'T13')!.debtId).toBe('L1');
    expect(plan.transactions.find((t) => t.id === 'T14')!.debtId).toBe('L1');
  });

  it('ngân sách: bỏ id danh mục không tồn tại', () => {
    expect(plan.budgets[0]).toMatchObject({
      name: 'Ăn uống',
      amount: 2_000_000,
      categoryIds: 'C1',
    });
  });

  it('cài đặt: theme tối, ngưỡng an toàn, chuyển khoản tính thu/chi', () => {
    expect(plan.settings).toEqual({
      themePreference: 'dark',
      userName: 'Test',
      safetyThreshold: 4_000_000,
      transfersAsIncomeExpense: true,
      hideBalance: false,
    });
  });
});

describe('ghi vào DB', () => {
  it('ghi đủ, số dư trong DB khớp bản xem trước', async () => {
    const db = createTestDb();
    const plan = loadPlan();
    const counts = writeIvyImport(db, plan);
    expect(counts.transactions).toEqual({ inserted: plan.transactions.length, skipped: 0 });

    const balances = await getAccountBalances(db);
    expect(Object.fromEntries(balances.map((b) => [b.id, b.balance]))).toEqual(
      ivySampleExpected.balances,
    );
    expect(totalBalance(balances)).toBe(ivySampleExpected.total);

    const verify = await verifyIvyImport(db, plan);
    expect(verify.ok).toBe(true);

    expect(db.select({ n: count() }).from(scheduleOccurrences).get()!.n).toBe(2);
    expect(db.select({ n: count() }).from(transactionTags).get()!.n).toBe(1);
    expect(db.select({ n: count() }).from(debtRecords).get()!.n).toBe(3);
    expect(
      db
        .select()
        .from(debts)
        .all()
        .find((d) => d.id === 'L1')!.transactionId,
    ).toBe('T13');
  });

  it('import lại lần 2: không tạo bản trùng', () => {
    const db = createTestDb();
    writeIvyImport(db, loadPlan());
    const again = writeIvyImport(db, loadPlan());
    expect(Object.values(again).every((c) => c.inserted === 0)).toBe(true);
    expect(db.select({ n: count() }).from(transactions).get()!.n).toBe(
      loadPlan().transactions.length,
    );
    expect(db.select({ n: count() }).from(schedules).get()!.n).toBe(3);
  });

  it('lỗi giữa chừng → không ghi gì cả (một transaction)', () => {
    const db = createTestDb();
    const plan = loadPlan();
    // Giao dịch cuối trỏ tới ví không tồn tại → vi phạm khoá ngoại khi đã ghi được một phần
    plan.transactions.push({ ...plan.transactions[0], id: 'BROKEN', accountId: 'NOPE' });
    expect(() => writeIvyImport(db, plan)).toThrow();
    expect(db.select({ n: count() }).from(accounts).get()!.n).toBe(0);
    expect(db.select({ n: count() }).from(transactions).get()!.n).toBe(0);
  });
});
