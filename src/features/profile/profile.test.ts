import { saveCategory } from '@/features/categories/repository';
import { listBudgetRows, saveBudget } from '@/features/budgets/repository';
import { ensureTag, listTags } from '@/features/tags/repository';
import { createTestDb } from '@/test/testDb';

import { applyPlan, exportProfile, planProfile } from './profile';

const noop = () => {};

describe('planProfile', () => {
  it('JSON hỏng → báo lỗi, không có bước nào', () => {
    const plan = planProfile(createTestDb(), '{ oops', noop);
    expect(plan.error).toMatch(/JSON/);
    expect(plan.steps).toHaveLength(0);
  });

  it('đặt chu kỳ ngày lương cho ngân sách có sẵn, giữ nguyên hạn mức', () => {
    const db = createTestDb();
    saveBudget(db, { name: 'Đổ xăng', amount: 400_000 });
    const plan = planProfile(
      db,
      JSON.stringify({ budgets: [{ name: 'do xang', startDay: 17, weekendRule: 'after' }] }),
      noop,
    );
    expect(plan.steps[0].label).toMatch(/ngày 17.*thứ Hai/);
    applyPlan(db, plan);
    const [b] = listBudgetRows(db);
    expect(b).toMatchObject({ amount: 400_000, startDay: 17, weekendRule: 'after' });
  });

  it('tạo ngân sách mới cần amount; nhận "400k"; tên danh mục sai chỉ cảnh báo', () => {
    const db = createTestDb();
    saveCategory(db, { name: 'Ăn uống', color: '#000000', icon: 'x' });
    const plan = planProfile(
      db,
      JSON.stringify({
        budgets: [
          { name: 'Ăn', amount: '2tr', categories: ['Ăn uống', 'Không có'] },
          { name: 'Thiếu tiền' },
        ],
      }),
      noop,
    );
    expect(plan.warnings.join('|')).toMatch(/Không thấy danh mục "Không có"/);
    expect(plan.warnings.join('|')).toMatch(/Thiếu tiền.*amount/);
    applyPlan(db, plan);
    expect(listBudgetRows(db)).toHaveLength(1);
    expect(listBudgetRows(db)[0].amount).toBe(2_000_000);
  });

  it('startDay ngoài 1–31 bị từ chối, không ghi gì', () => {
    const db = createTestDb();
    saveBudget(db, { name: 'AI', amount: 540_000 });
    const plan = planProfile(db, JSON.stringify({ budgets: [{ name: 'AI', startDay: 40 }] }), noop);
    expect(plan.steps).toHaveLength(0);
    expect(plan.warnings[0]).toMatch(/startDay/);
  });

  it('dọn tag: xoá, đổi tên, tạo; tag không có thì cảnh báo', () => {
    const db = createTestDb();
    ensureTag(db, 'Băng');
    ensureTag(db, 'Chan ga');
    const plan = planProfile(
      db,
      JSON.stringify({
        tags: { delete: ['#bang', 'Không có'], rename: { 'Chan ga': 'Chân gà' }, create: ['Lương'] },
      }),
      noop,
    );
    expect(plan.warnings).toHaveLength(1);
    applyPlan(db, plan);
    expect(listTags(db).map((t) => t.name).sort()).toEqual(['Chân gà', 'Lương']);
  });

  it('cài đặt: chỉ nhận khoá hợp lệ', () => {
    const calls: unknown[] = [];
    const plan = planProfile(
      createTestDb(),
      JSON.stringify({ settings: { startDayOfMonth: 17, language: 'fr', secret: 1 } }),
      (p) => calls.push(p),
    );
    expect(plan.warnings).toHaveLength(2);
    applyPlan(createTestDb(), plan);
    expect(calls).toEqual([{ startDayOfMonth: 17 }]);
  });

  it('xuất mẫu rồi dán lại không tạo thay đổi lạ', () => {
    const db = createTestDb();
    saveBudget(db, { name: 'Cắt tóc', amount: 40_000, startDay: 17, weekendRule: 'after' });
    const text = exportProfile(db, {
      userName: '',
      startDayOfMonth: 1,
      safetyThreshold: 0,
      language: 'vi',
      haptics: true,
      hideBalance: false,
    } as never);
    const plan = planProfile(db, text, noop);
    expect(plan.error).toBeNull();
    applyPlan(db, plan);
    expect(listBudgetRows(db)[0]).toMatchObject({ amount: 40_000, startDay: 17, weekendRule: 'after' });
  });
});
