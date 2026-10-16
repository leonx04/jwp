import { saveAccount } from '@/features/accounts/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import { listTags } from './repository';
import { applyTagProposal, listTagProposals } from './suggestRepository';

describe('gợi ý & gắn tag từ lịch sử', () => {
  it('tạo tag và gắn vào giao dịch cũ; chạy lại không gắn trùng và không gợi ý lại', () => {
    const db = createTestDb();
    const acc = saveAccount(db, {
      name: 'MB',
      color: '#000',
      icon: 'cash-outline',
      includeInBalance: true,
    });
    for (const d of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']) {
      saveTransaction(db, {
        type: 'expense',
        amount: 30_000,
        accountId: acc,
        title: 'Ăn sáng',
        date: vnDateToMs(d, '08:00'),
      });
    }
    saveTransaction(db, {
      type: 'expense',
      amount: 1,
      accountId: acc,
      title: 'Điều chỉnh',
      date: vnDateToMs('2026-09-05'),
      isAdjustment: true,
    });

    const [p] = listTagProposals(db);
    expect(p).toMatchObject({ name: 'Ăn sáng', count: 4 });
    expect(applyTagProposal(db, p)).toBe(4);
    expect(applyTagProposal(db, p)).toBe(0);
    expect(listTags(db)).toMatchObject([{ name: 'Ăn sáng', usage: 4 }]);
    expect(listTagProposals(db)).toEqual([]);
  });
});
