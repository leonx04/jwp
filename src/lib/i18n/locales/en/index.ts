// Gộp các file dịch tiếng Anh theo nhóm. Thêm nhóm mới: tạo file rồi rải vào đây.
import { accounts } from './accounts';
import { budgets } from './budgets';
import { categories } from './categories';
import { goals } from './goals';
import { recurring } from './recurring';
import { tags } from './tags';
import { debts } from './debts';
import { schedules } from './schedules';
import { stats } from './stats';
import { credit } from './credit';
import { notifications } from './notifications';
import { capture } from './capture';
import { backup } from './backup';
import { fragments } from './fragments';
import { ask } from './ask';
import { dataquality } from './dataquality';
import { flow } from './flow';
import { fuel } from './fuel';
import { profile } from './profile';
import { quickadd } from './quickadd';
import { salary } from './salary';
import { tet } from './tet';
import { widget } from './widget';
import { wrapped } from './wrapped';
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
  ...accounts,
  ...budgets,
  ...categories,
  ...goals,
  ...recurring,
  ...tags,
  ...debts,
  ...schedules,
  ...stats,
  ...credit,
  ...notifications,
  ...capture,
  ...backup,
  ...fragments,
  ...salary,
  ...quickadd,
  ...profile,
  ...flow,
  ...dataquality,
  ...fuel,
  ...ask,
  ...wrapped,
  ...widget,
  ...tet,
};
