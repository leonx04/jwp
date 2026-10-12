import { categories } from '@/db/schema';
import {
  ensureFeeCategory,
  FEE_CATEGORY_ID,
  listCategories,
  saveCategory,
} from '@/features/categories/repository';
import { ICON_CHOICES } from '@/lib/icons';
import { createTestDb } from '@/test/testDb';

import { createDefaultData, DEFAULT_CATEGORIES, DEFAULT_CATEGORY_COUNT } from './defaults';

describe('danh mục mặc định', () => {
  it('tên không trùng, icon nằm trong bộ chọn', () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(DEFAULT_CATEGORIES.filter((c) => !ICON_CHOICES.includes(c.icon))).toEqual([]);
    expect(DEFAULT_CATEGORY_COUNT).toBe(DEFAULT_CATEGORIES.length);
  });

  it('tạo đủ danh mục, có sẵn danh mục phí với id cố định', () => {
    const db = createTestDb();
    createDefaultData(db);
    const list = listCategories(db);
    expect(list).toHaveLength(DEFAULT_CATEGORY_COUNT);
    expect(list[0].name).toBe('Ăn uống');
    expect(list.find((c) => c.id === FEE_CATEGORY_ID)).toBeDefined();
    // Phí chuyển khoản gắn vào đúng danh mục có sẵn, không tạo thêm
    expect(ensureFeeCategory(db)).toBe(FEE_CATEGORY_ID);
    expect(listCategories(db)).toHaveLength(DEFAULT_CATEGORY_COUNT);
  });

  it('chạy lại không trùng, bỏ qua danh mục đã có cùng tên (khác dấu / hoa thường)', () => {
    const db = createTestDb();
    saveCategory(db, { name: 'LUONG', color: '#000000', icon: 'cash-outline' });
    ensureFeeCategory(db);
    createDefaultData(db);
    createDefaultData(db);
    const names = db.select({ name: categories.name }).from(categories).all().map((c) => c.name);
    expect(names.filter((n) => n === 'Lương')).toHaveLength(0);
    expect(names.filter((n) => n === 'LUONG')).toHaveLength(1);
    expect(names).toHaveLength(DEFAULT_CATEGORY_COUNT);
  });
});
