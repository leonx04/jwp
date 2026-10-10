import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';

import { mapIvyIcon } from '@/features/backup/ivy/icons';

import {
  DEFAULT_ACCOUNT_ICON,
  DEFAULT_CATEGORY_ICON,
  ICON_CHOICES,
  UNCATEGORIZED_ICON,
} from './index';

const exists = (name: string) => Object.prototype.hasOwnProperty.call(glyphMap, name);

describe('icon', () => {
  it('mọi icon trong bộ chọn đều có trong Ionicons', () => {
    const missing = ICON_CHOICES.filter((name) => !exists(name));
    expect(missing).toEqual([]);
    expect(new Set(ICON_CHOICES).size).toBe(ICON_CHOICES.length);
  });

  it('icon mặc định tồn tại', () => {
    for (const name of [DEFAULT_ACCOUNT_ICON, DEFAULT_CATEGORY_ICON, UNCATEGORIZED_ICON]) {
      expect(exists(name)).toBe(true);
    }
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
