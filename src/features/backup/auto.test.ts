import { vnDateToMs } from '@/lib/date';

import { autoBackupName, isBackupDue, namesToPrune } from './auto';

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
