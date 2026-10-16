import { saveAccount } from '@/features/accounts/repository';
import { saveBudget } from '@/features/budgets/repository';
import { saveCategory } from '@/features/categories/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { answerQuestion, type AskContext } from './answer';
import { parseQuestion } from './parse';

const TODAY = '2026-10-16';
const ctx: AskContext = { today: TODAY, startDay: 1, money: (n) => `${n}đ` };

function setup() {
  const db = createTestDb();
  const acc = saveAccount(db, { name: 'MoMo', color: '#000', icon: 'wallet', includeInBalance: true });
  const food = saveCategory(db, { name: 'Ăn uống', color: '#f00', icon: 'x' });
  const add = (date: string, amount: number, title: string, type: 'expense' | 'income' = 'expense', cat: string | null = food) =>
    saveTransaction(db, { type, amount, accountId: acc, categoryId: cat, title, date: vnDateToMs(date, '12:00') });
  add('2026-10-02', 35_000, 'Cafe');
  add('2026-10-05', 40_000, 'Cafe');
  add('2026-10-06', 120_000, 'Ăn tối');
  add('2026-09-10', 50_000, 'Cafe');
  add('2026-10-01', 15_000_000, 'Lương', 'income', null);
  return db;
}

const ask = (db: ReturnType<typeof setup>, text: string) =>
  answerQuestion(db, parseQuestion(text, TODAY, 1), ctx);

describe('answerQuestion', () => {
  it('tổng chi tháng này (có lọc từ khoá)', () => {
    const db = setup();
    expect(ask(db, 'tháng này tiêu bao nhiêu').headline).toBe('195000đ');
    expect(ask(db, 'cafe tháng này hết bao nhiêu').headline).toBe('75000đ');
    expect(ask(db, 'ăn uống tháng này chi bao nhiêu').headline).toBe('195000đ');
  });

  it('thu nhập, đếm, lớn nhất, danh mục', () => {
    const db = setup();
    expect(ask(db, 'lương tháng này nhận bao nhiêu').headline).toBe('15000000đ');
    expect(ask(db, 'cafe tháng này mấy lần').headline).toMatch(/2/);
    expect(ask(db, 'khoản chi lớn nhất tháng này')).toMatchObject({ headline: '120000đ' });
    expect(ask(db, 'tháng này tiêu nhiều nhất vào đâu').headline).toBe('Ăn uống');
  });

  it('so sánh với kỳ trước', () => {
    const db = setup();
    const a = ask(db, 'cafe tháng này so với tháng trước');
    expect(a.headline).toBe('75000đ');
    expect(a.summary).toMatch(/25000đ/);
  });

  it('số dư và ngân sách', () => {
    const db = setup();
    expect(ask(db, 'số dư momo').headline).toBe(`${15_000_000 - 195_000 - 50_000}đ`);
    // Ngân sách không giới hạn danh mục → tính mọi khoản chi tháng này (195.000đ)
    saveBudget(db, { name: 'Cafe', amount: 200_000 });
    expect(ask(db, 'ngân sách cafe còn bao nhiêu').headline).toBe('5000đ');
  });

  it('không hiểu → understood=false', () => {
    expect(ask(setup(), 'xin chào').understood).toBe(false);
  });
});
