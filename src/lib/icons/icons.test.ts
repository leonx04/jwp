import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';

import { mapIvyIcon } from '@/features/backup/ivy/icons';
import { BANKS, bankIcon } from '@/lib/banks';
import { normalizeForSearch } from '@/lib/text';

import {
  DEFAULT_ACCOUNT_ICON,
  DEFAULT_CATEGORY_ICON,
  ICON_CHOICES,
  ICON_GROUPS,
  iconInfo,
  UNCATEGORIZED_ICON,
} from './index';
import {
  BANK_GROUP_KEY,
  filterIconGroups,
  iconOptionGroups,
  iconOptionLabel,
  suggestedBank,
  suggestIcons,
} from './search';

const exists = (name: string) => Object.prototype.hasOwnProperty.call(glyphMap, name);

describe('icon', () => {
  it('mọi icon trong bộ chọn đều có trong Ionicons', () => {
    const missing = ICON_CHOICES.filter((name) => !exists(name));
    expect(missing).toEqual([]);
    expect(new Set(ICON_CHOICES).size).toBe(ICON_CHOICES.length);
  });

  it('bộ icon đủ lớn, mỗi nhóm có tên tiếng Việt và từ khoá không dấu', () => {
    expect(ICON_CHOICES.length).toBeGreaterThanOrEqual(150);
    expect(new Set(ICON_GROUPS.map((g) => g.key)).size).toBe(ICON_GROUPS.length);
    for (const group of ICON_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.icons.length).toBeGreaterThan(0);
      for (const icon of group.icons) {
        expect(icon.label.length).toBeGreaterThan(0);
        // Từ khoá phải đã chuẩn hoá để so khớp không dấu
        expect(icon.keywords).toBe(normalizeForSearch(icon.keywords));
      }
    }
  });

  it('giữ mọi icon cũ để danh mục / ví đã lưu vẫn tìm thấy trong bộ chọn', () => {
    const previous = [
      'wallet-outline', 'cash-outline', 'card-outline', 'business-outline', 'phone-portrait-outline',
      'trending-up-outline', 'save-outline', 'diamond-outline', 'restaurant-outline', 'fast-food-outline',
      'cafe-outline', 'beer-outline', 'pizza-outline', 'ice-cream-outline', 'cart-outline',
      'bag-handle-outline', 'basket-outline', 'shirt-outline', 'gift-outline', 'car-outline', 'bus-outline',
      'bicycle-outline', 'airplane-outline', 'train-outline', 'speedometer-outline', 'home-outline',
      'receipt-outline', 'flash-outline', 'water-outline', 'wifi-outline', 'tv-outline', 'construct-outline',
      'medkit-outline', 'fitness-outline', 'barbell-outline', 'cut-outline', 'color-palette-outline',
      'heart-outline', 'paw-outline', 'school-outline', 'book-outline', 'briefcase-outline', 'laptop-outline',
      'code-slash-outline', 'game-controller-outline', 'film-outline', 'musical-notes-outline',
      'football-outline', 'planet-outline', 'people-outline', 'person-outline', 'happy-outline',
      'chatbubble-ellipses-outline', 'swap-horizontal-outline', 'document-text-outline', 'pricetag-outline',
      'star-outline',
    ];
    expect(previous.filter((name) => !ICON_CHOICES.includes(name as never))).toEqual([]);
  });

  it('icon mặc định tồn tại', () => {
    for (const name of [DEFAULT_ACCOUNT_ICON, DEFAULT_CATEGORY_ICON, UNCATEGORIZED_ICON]) {
      expect(exists(name)).toBe(true);
    }
  });

  it('iconInfo trả tên tiếng Việt + nhóm', () => {
    expect(iconInfo('cafe-outline')).toMatchObject({ label: 'Cà phê', group: 'food' });
    expect(iconInfo('khong-co')).toBeNull();
    expect(iconInfo(null)).toBeNull();
  });

  it('mọi icon ánh xạ từ Ivy (kể cả tên lạ) đều tồn tại', () => {
    const ivyNames = [
      'cash',
      'bills',
      'fooddrink',
      'shopping',
      'loan',
      'work',
      'family',
      'coffee',
      'ic_vue_design_scissors',
      'ic_vue_shop_bag1',
      'ic_vue_messages_msg_favorite',
      'orderfood2',
      'atom',
      'unknown_icon_xyz',
      '',
    ];
    for (const name of ivyNames) {
      expect(exists(mapIvyIcon(name, 'category'))).toBe(true);
      expect(exists(mapIvyIcon(name, 'account'))).toBe(true);
    }
  });
});

describe('nhóm chọn icon (kể cả logo ngân hàng)', () => {
  const icons = (groups: ReturnType<typeof iconOptionGroups>) =>
    groups.flatMap((g) => g.options.map((o) => o.icon));

  it('có nhóm "Ngân hàng & ví" với đủ ngân hàng, ví đặt nhóm logo lên đầu', () => {
    const category = iconOptionGroups('category');
    const bankGroup = category.find((g) => g.key === BANK_GROUP_KEY)!;
    expect(bankGroup.options).toHaveLength(BANKS.length);
    expect(bankGroup.options[0].icon).toBe(bankIcon('MB'));
    expect(category[0].key).toBe('food');
    expect(iconOptionGroups('account')[0].key).toBe(BANK_GROUP_KEY);
    // Không trùng icon giữa các nhóm
    expect(new Set(icons(category)).size).toBe(icons(category).length);
  });

  it('tìm không dấu theo tên, từ khoá, mã ngân hàng', () => {
    const all = iconOptionGroups('category');
    const find = (q: string) => icons(filterIconGroups(all, q));
    expect(find('cà phê')[0]).toBe('cafe-outline');
    expect(find('ca phe')[0]).toBe('cafe-outline');
    expect(find('xang')).toContain('speedometer-outline');
    expect(find('Gửi xe')).toContain('key-outline');
    expect(find('điện')).toContain('flash-outline');
    expect(find('trả góp')).toContain('calendar-number-outline');
    expect(find('vcb')).toEqual([bankIcon('VCB')]);
    expect(find('momo')).toContain(bankIcon('MOMO'));
    expect(find('shopee')).toEqual(expect.arrayContaining(['cart-outline', bankIcon('SHOPEEPAY')]));
    expect(find('   ')).toEqual(icons(all));
    expect(find('zzzzqqq')).toEqual([]);
  });

  it('gợi ý icon theo tên danh mục / ví', () => {
    expect(suggestIcons('Ăn uống')[0]).toBe('restaurant-outline');
    expect(suggestIcons('Cà phê')[0]).toBe('cafe-outline');
    expect(suggestIcons('Xăng xe')).toContain('speedometer-outline');
    expect(suggestIcons('Hiếu hỉ')).toContain('mail-outline');
    expect(suggestIcons('Biếu bố mẹ')).toContain('people-circle-outline');
    expect(suggestIcons('Tiền mặt')).toContain('cash-outline');
    expect(suggestIcons('Shopee')[0]).toBe(bankIcon('SHOPEEPAY'));
    expect(suggestIcons('Shopee', { banks: false })).not.toContain(bankIcon('SHOPEEPAY'));
    expect(suggestIcons('Trả góp & trả sau')).toEqual(
      expect.arrayContaining(['calendar-number-outline', 'hourglass-outline']),
    );
    expect(suggestIcons('cà phê', { limit: 1 })).toHaveLength(1);
    expect(suggestIcons('')).toEqual([]);
  });

  it('tên hiển thị của icon / logo', () => {
    expect(iconOptionLabel(bankIcon('TCB'))).toBe('Techcombank');
    expect(iconOptionLabel('cafe-outline')).toBe('Cà phê');
    expect(iconOptionLabel('alarm-outline')).toBeNull();
  });

  it('gợi ý logo theo tên ví, trừ khi ví đã dùng logo đó', () => {
    expect(suggestedBank('MB bank', 'wallet-outline')?.code).toBe('MB');
    expect(suggestedBank('MB bank', bankIcon('MB'))).toBeNull();
    expect(suggestedBank('Tiền mặt', 'cash-outline')).toBeNull();
  });
});
