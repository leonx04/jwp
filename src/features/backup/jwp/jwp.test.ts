import { listBudgetRows, saveBudget } from '@/features/budgets/repository';
import { createTestDb } from '@/test/testDb';

import { collectBackupData, createJwpBackup, serializeJwpBackup } from './export';
import { readJwpBackup } from './read';
import { restoreReplace } from './restore';

describe('sao lưu JWP', () => {
  it('xuất rồi khôi phục giữ nguyên chu kỳ riêng của ngân sách', () => {
    const source = createTestDb();
    saveBudget(source, { name: 'Lương ngày 5', amount: 1_000_000, startDay: 5 });
    saveBudget(source, { name: 'Chung', amount: 500_000 });

    const json = serializeJwpBackup(createJwpBackup(collectBackupData(source, {})));
    const backup = readJwpBackup(new TextEncoder().encode(json));

    const target = createTestDb();
    restoreReplace(target, backup);
    expect(listBudgetRows(target).map((b) => [b.name, b.startDay])).toEqual([
      ['Lương ngày 5', 5],
      ['Chung', null],
    ]);
  });
});
