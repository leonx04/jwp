import { vnDateToMs } from '@/lib/date';

import {
  autoBackupName,
  backupNudge,
  DEFAULT_AUTO_BACKUP,
  isBackupDue,
  namesToPrune,
} from './auto';

const DAY = 86_400_000;

describe('isBackupDue', () => {
  it('chưa từng sao lưu → đến hạn', () => {
    expect(isBackupDue(null, 1000, 3)).toBe(true);
  });
  it('đủ số ngày mới đến hạn', () => {
    const last = 1_000_000_000_000;
    expect(isBackupDue(last, last + 2 * DAY, 3)).toBe(false);
    expect(isBackupDue(last, last + 3 * DAY, 3)).toBe(true);
  });
});

describe('autoBackupName', () => {
  it('theo giờ Việt Nam, sắp theo thời gian', () => {
    const a = autoBackupName(vnDateToMs('2026-10-12', '20:15'));
    const b = autoBackupName(vnDateToMs('2026-10-13', '07:05'));
    expect(a).toBe('JWP-auto-20261012-2015.json');
    expect(b).toBe('JWP-auto-20261013-0705.json');
    expect(a < b).toBe(true);
  });
});

describe('namesToPrune', () => {
  const names = [
    'JWP-auto-20261010-0800.json',
    'JWP-auto-20261011-0800.json',
    'JWP-auto-20261012-0800.json',
    'JWP-auto-20261013-0800.json',
    'truoc-khi-khoi-phuc-1.json',
    'anh.png',
  ];
  it('chỉ giữ N bản mới nhất, không đụng file khác', () => {
    expect(namesToPrune(names, 2)).toEqual([
      'JWP-auto-20261011-0800.json',
      'JWP-auto-20261010-0800.json',
    ]);
    expect(namesToPrune(names, 10)).toEqual([]);
  });
  it('luôn giữ ít nhất một bản', () => {
    expect(namesToPrune(names, 0)).toHaveLength(3);
  });
});

describe('backupNudge', () => {
  const now = 1_800_000_000_000;
  const off = { ...DEFAULT_AUTO_BACKUP };
  const on = { ...DEFAULT_AUTO_BACKUP, enabled: true, lastAt: now - DAY };

  it('chưa bật: chỉ nhắc khi đã có đủ giao dịch và không đang hoãn', () => {
    expect(backupNudge(off, { transactions: 3, now, snoozedUntil: null })).toBeNull();
    expect(backupNudge(off, { transactions: 10, now, snoozedUntil: null })).toBe('enable');
    expect(backupNudge(off, { transactions: 50, now, snoozedUntil: now + DAY })).toBeNull();
    expect(backupNudge(off, { transactions: 50, now, snoozedUntil: now - 1 })).toBe('enable');
  });

  it('đã bật: báo lỗi lần trước, hoặc quá lâu chưa sao lưu được', () => {
    const args = { transactions: 50, now, snoozedUntil: null };
    expect(backupNudge(on, args)).toBeNull();
    expect(backupNudge({ ...on, lastError: 'hết chỗ' }, args)).toBe('failing');
    expect(backupNudge({ ...on, lastAt: now - 10 * DAY }, args)).toBe('stale');
    expect(backupNudge({ ...on, lastAt: null }, args)).toBeNull();
  });
});
