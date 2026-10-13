import { saveAccount } from '@/features/accounts/repository';
import { listSchedules } from '@/features/schedules/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { vnDateToMs } from '@/lib/date';
import { createTestDb } from '@/test/testDb';

import {
  createScheduleFromSuggestion,
  dismissSuggestion,
  listRecurringSuggestions,
} from './repository';

const setup = () => {
  const db = createTestDb();
  const mb = saveAccount(db, {
    name: 'MB',
    color: '#000',
    icon: 'bank:MB',
    includeInBalance: true,
  });
  const add = (date: string, amount: number, title: string, extra = {}) =>
    saveTransaction(db, {
      type: 'expense',
      amount,
      accountId: mb,
      title,
      date: vnDateToMs(date, '09:00'),
      ...extra,
    });
  return { db, mb, add };
};

describe('listRecurringSuggestions', () => {
  it('thấy khoản lặp, bỏ qua giao dịch điều chỉnh số dư', () => {
    const { db, add } = setup();
    for (const d of ['2026-07-25', '2026-08-25', '2026-09-25']) add(d, 513_000, 'Claude Code');
    for (const d of ['2026-07-03', '2026-08-03', '2026-09-03'])
      add(d, 100_000, 'Điều chỉnh', { isAdjustment: true });
    const r = listRecurringSuggestions(db, '2026-10-12');
    expect(r.map((s) => s.title)).toEqual(['Claude Code']);
    expect(r[0].nextDate).toBe('2026-10-25');
  });

  it('tạo lịch từ gợi ý → không gợi ý lại, lịch có đúng thông số', () => {
    const { db, mb, add } = setup();
    for (const d of ['2026-07-25', '2026-08-25', '2026-09-25']) add(d, 513_000, 'Claude Code');
    const [s] = listRecurringSuggestions(db, '2026-10-12');
    createScheduleFromSuggestion(db, s);
    expect(listRecurringSuggestions(db, '2026-10-12')).toHaveLength(0);
    const [sch] = listSchedules(db);
    expect(sch).toMatchObject({
      type: 'expense',
      amount: 513_000,
      accountId: mb,
      title: 'Claude Code',
      frequency: 'monthly',
      startDate: '2026-10-25',
      autoPost: false,
      active: true,
    });
  });

  it('bỏ qua một gợi ý → không hiện lại', () => {
    const { db, add } = setup();
    for (const d of ['2026-07-14', '2026-08-14', '2026-09-14']) add(d, 99_000, 'Gym');
    const [s] = listRecurringSuggestions(db, '2026-10-12');
    dismissSuggestion(s.key);
    expect(listRecurringSuggestions(db, '2026-10-12')).toHaveLength(0);
  });

  it('khoản cuối tháng → lịch dùng ngày cuối tháng (-1)', () => {
    const { db, add } = setup();
    add('2026-07-31', 10, 'Phí duy trì');
    add('2026-08-31', 10, 'Phí duy trì');
    add('2026-09-30', 10, 'Phí duy trì');
    createScheduleFromSuggestion(db, listRecurringSuggestions(db, '2026-10-12')[0]);
    expect(listSchedules(db)[0].monthDay).toBe(-1);
  });
});
