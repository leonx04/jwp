import { ICON_CHOICES } from '@/lib/icons';

import { proposeIconChanges, suggestCategoryIcon } from './iconSuggest';

describe('proposeIconChanges', () => {
  it('đổi icon chung chung theo tên; giữ logo ngân hàng và icon đã chọn có chủ đích', () => {
    const changes = proposeIconChanges([
      { id: '1', name: 'Lương', icon: 'star-outline' },
      { id: '2', name: 'Gửi Mẹ', icon: 'pricetag-outline' },
      { id: '3', name: 'Spaylater', icon: 'bank:SHOPEEPAY' },
      { id: '4', name: 'Cà Phê', icon: 'cafe-outline' },
      { id: '5', name: 'Cắt Tóc', icon: null },
      { id: '6', name: 'Nạp Điện Thoại', icon: 'chatbubble-ellipses-outline' },
    ]);
    const byName = Object.fromEntries(changes.map((c) => [c.name, c.to]));
    expect(byName['Lương']).toBe('cash-outline');
    expect(byName['Gửi Mẹ']).toBe('heart-outline');
    expect(byName['Nạp Điện Thoại']).toBe('phone-portrait-outline');
    expect(byName['Cắt Tóc']).toBeTruthy();
    expect(byName['Spaylater']).toBeUndefined();
    expect(byName['Cà Phê']).toBeUndefined();
  });

  it('không đề xuất khi icon đã đúng; mọi icon bảng chọn tay đều có trong bộ chọn', () => {
    expect(proposeIconChanges([{ id: '1', name: 'Lương', icon: 'cash-outline' }])).toEqual([]);
    for (const name of ['Lương', 'Cho Mượn', 'Gửi Mẹ', 'Nạp Điện Thoại', 'Claude Code', 'Lazada']) {
      const icon = suggestCategoryIcon(name);
      expect(icon && (ICON_CHOICES as readonly string[]).includes(icon)).toBe(true);
    }
  });
});
