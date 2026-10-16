// Gộp các file dịch tiếng Anh theo nhóm. Thêm nhóm mới: tạo file rồi rải vào đây.
import { common } from './common';
import { components } from './components';
import { more } from './more';
import { navigation } from './navigation';
import { overview } from './overview';
import { settings } from './settings';
import { today } from './today';
import { transactions } from './transactions';

export const en: Record<string, string> = {
  ...common,
  ...components,
  ...navigation,
  ...overview,
  ...more,
  ...transactions,
  ...settings,
  ...today,
};
