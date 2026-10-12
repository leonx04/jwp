import { csvCell, transactionsToCsv, vnDateTime } from './csv';

describe('csv', () => {
  it('escape dấu phẩy, ngoặc kép, xuống dòng', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('nói "hi"')).toBe('"nói ""hi"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(-5000)).toBe('-5000');
  });

  it('chặn công thức Excel', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('@a')).toBe("'@a");
  });

  it('đổi giờ sang UTC+7', () => {
    expect(vnDateTime(Date.UTC(2026, 9, 12, 17, 30))).toEqual(['2026-10-13', '00:30']);
  });

  it('xuất giao dịch có BOM và tên ví / danh mục', () => {
    const csv = transactionsToCsv({
      accounts: [{ id: 'a', name: 'MB bank' }],
      categories: [{ id: 'c', name: 'Ăn uống' }],
      transactions: [
        {
          id: 't',
          type: 'expense',
          amount: 60000,
          accountId: 'a',
          toAccountId: null,
          categoryId: 'c',
          title: 'Bún, trưa',
          note: null,
          date: Date.UTC(2026, 9, 12, 5, 0),
          isAdjustment: false,
        },
      ],
    } as never);
    expect(csv.startsWith('﻿Ngày,Giờ')).toBe(true);
    expect(csv).toContain('2026-10-12,12:00,Chi,60000,MB bank,,Ăn uống,"Bún, trưa",');
  });
});
