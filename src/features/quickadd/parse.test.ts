import { toVnDate, vnDateToMs } from '@/lib/date';

import { parseQuickEntry, type QuickContext } from './parse';

// Thứ Sáu 16/10/2026, 10:30 giờ VN
const NOW = vnDateToMs('2026-10-16', '10:30');

const ctx: QuickContext = {
  now: NOW,
  accounts: [
    { id: 'cash', name: 'Tiền mặt' },
    { id: 'momo', name: 'Ví MoMo' },
    { id: 'vcb', name: 'Vietcombank' },
  ],
  categories: [
    { id: 'food', name: 'Ăn uống' },
    { id: 'fuel', name: 'Xăng xe' },
    { id: 'salary', name: 'Lương' },
  ],
  tags: [{ id: 'work', name: 'Công việc' }],
  history: [
    { title: 'Cafe sáng', categoryId: 'food' },
    { title: 'Cafe bạn', categoryId: 'food' },
    { title: 'Đổ xăng', categoryId: 'fuel' },
  ],
  defaultAccountId: 'cash',
};

const parse = (text: string) => parseQuickEntry(text, ctx);
const dayOf = (ms: number) => toVnDate(ms);

describe('parseQuickEntry', () => {
  it('đọc số tiền, tiêu đề, ví mặc định, danh mục từ lịch sử', () => {
    const e = parse('cafe 35k');
    expect(e).toMatchObject({
      type: 'expense',
      amount: 35_000,
      title: 'Cafe',
      accountId: 'cash',
      categoryId: 'food',
      categorySource: 'history',
    });
    expect(dayOf(e.date)).toBe('2026-10-16');
  });

  it('nhận ngày tương đối và ví theo tên', () => {
    const e = parse('cafe 35k hôm qua momo');
    expect(e.accountId).toBe('momo');
    expect(dayOf(e.date)).toBe('2026-10-15');
    expect(e.title).toBe('Cafe');
  });

  it('thứ trong tuần, tuần trước, ngày cụ thể', () => {
    expect(dayOf(parse('đổ xăng 80k thứ 2').date)).toBe('2026-10-12');
    expect(dayOf(parse('đổ xăng 80k thứ 6').date)).toBe('2026-10-16');
    expect(dayOf(parse('đổ xăng 80k thứ 6 tuần trước').date)).toBe('2026-10-09');
    expect(dayOf(parse('ăn trưa 50k ngày 5').date)).toBe('2026-10-05');
    expect(dayOf(parse('ăn trưa 50k 03/10').date)).toBe('2026-10-03');
    expect(dayOf(parse('ăn trưa 50k 20/12').date)).toBe('2025-12-20');
  });

  it('buổi trong ngày đặt giờ', () => {
    expect(vnDateToMs('2026-10-15', '19:00')).toBe(parse('ăn phở 45k tối qua').date);
  });

  it('đơn vị viết tắt và số trần', () => {
    expect(parse('lương 15tr').amount).toBe(15_000_000);
    expect(parse('đổ xăng 1tr2').amount).toBe(1_200_000);
    expect(parse('mua 2 ly cafe 70k').amount).toBe(70_000);
    expect(parse('mua 2 ly cafe 70k').title).toBe('Mua 2 ly cafe');
    const bare = parse('trà sữa 45');
    expect(bare).toMatchObject({ amount: 45_000, assumedThousand: true });
    expect(parse('tiền nhà 3 tr').amount).toBe(3_000_000);
    expect(parse('không có số tiền').amount).toBeNull();
  });

  it('thu nhập theo từ khoá + danh mục theo tên', () => {
    const e = parse('nhận lương 15tr vcb');
    expect(e).toMatchObject({
      type: 'income',
      amount: 15_000_000,
      accountId: 'vcb',
      categoryId: 'salary',
      categorySource: 'name',
    });
  });

  it('chuyển khoản giữa hai ví theo thứ tự xuất hiện', () => {
    const e = parse('chuyển 500k vcb sang momo');
    expect(e).toMatchObject({ type: 'transfer', amount: 500_000, accountId: 'vcb', toAccountId: 'momo' });
    expect(e.categoryId).toBeNull();
  });

  it('#tag có sẵn / mới, tag có sẵn theo tên', () => {
    const e = parse('họp khách 200k #Công việc #mới');
    expect(e.tagIds).toEqual(['work']);
    expect(e.newTagNames).toEqual(['mới']);
    const byName = parse('ăn trưa 60k công việc');
    expect(byName.tagIds).toEqual(['work']);
  });

  it('tên danh mục dài thắng tên ngắn nằm trong nó', () => {
    const e = parseQuickEntry('ăn uống 100k', {
      ...ctx,
      categories: [
        { id: 'a', name: 'Ăn' },
        { id: 'au', name: 'Ăn uống' },
      ],
    });
    expect(e.categoryId).toBe('au');
  });
});
