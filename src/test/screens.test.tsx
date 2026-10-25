// Dựng các màn chính trên DB thật (bộ nhớ) để bắt lỗi kiểu "màn trắng" trước khi lên máy.
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { saveAccount } from '@/features/accounts/repository';
import { DebtsScreen } from '@/features/debts/screens/DebtsScreen';
import { saveDebt, saveDebtTerms } from '@/features/debts/repository';
import { saveTransaction } from '@/features/transactions/repository';
import { todayVn, vnDateToMs } from '@/lib/date';
import { ThemeProvider } from '@/theme';

import { OverviewScreen } from '@/features/overview';
import { TransactionsScreen } from '@/features/transactions/screens/TransactionsScreen';
import { PlanScreen } from '@/features/plan/screens/PlanScreen';
import { InsightsScreen } from '@/features/insights/screens/InsightsScreen';
import { SettingsScreen } from '@/features/settings';

jest.mock('@/db/client', () => {
  const { createTestDb } = jest.requireActual('@/test/testDb');
  return { db: createTestDb(), sqlite: {}, DATABASE_NAME: 'test.db' };
});
jest.mock('expo-sqlite', () => ({
  addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: () => Promise.resolve() }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function mount(ui: React.ReactElement) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider preference="light" amoled={false} accent="indigo">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
}

jest.setTimeout(60_000);

const SCREENS = [
  ['Hôm nay', OverviewScreen],
  ['Sổ', TransactionsScreen],
  ['Kế hoạch', PlanScreen],
  ['Phân tích', InsightsScreen],
  ['Sổ nợ', DebtsScreen],
  ['Cài đặt', SettingsScreen],
] as const;

// Lỗi React (vd hook sai thứ tự, key trùng) chỉ in ra console.error → coi như test hỏng
let errors: unknown[][] = [];
beforeEach(() => {
  errors = [];
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    // Bản giả của worklets không đánh dấu hàm 'worklet' → RNGH báo nhầm; trên máy thật không có
    if (String(args[0]).includes('Some of the callbacks in the gesture are worklets')) return;
    errors.push(args);
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  expect(errors).toEqual([]);
});

describe('DB trống (lần đầu mở app)', () => {
  it.each(SCREENS)('màn %s dựng được', async (_name, Screen) => {
    await mount(<Screen />);
    expect(screen.toJSON()).toBeTruthy();
  });
});

describe('có dữ liệu', () => {
  beforeAll(() => {
    const today = todayVn();
    const at = vnDateToMs(today, '12:00');
    const wallet = saveAccount(db, {
      name: 'Ví chính',
      color: '#16A34A',
      icon: 'cash-outline',
      includeInBalance: true,
    });
    saveTransaction(db, {
      type: 'income',
      amount: 15_000_000,
      accountId: wallet,
      title: 'Lương',
      date: at,
    });
    saveTransaction(db, {
      type: 'expense',
      amount: 45_000,
      accountId: wallet,
      title: 'Cơm trưa',
      date: at,
    });
    saveDebt(db, {
      personName: 'a Quý',
      direction: 'borrowed',
      amount: 110_000,
      date: at,
      accountId: wallet,
    });
    const loan = saveDebt(db, {
      personName: 'Ngân hàng',
      direction: 'borrowed',
      amount: 20_000_000,
      date: at,
      accountId: wallet,
    });
    saveDebtTerms(db, loan, { annualRate: 12, months: 12, method: 'annuity', startDate: today });
  });

  it.each(SCREENS)('màn %s dựng được', async (_name, Screen) => {
    await mount(<Screen />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('Hôm nay: thẻ chính hiện số còn tiêu được, kèm số dư và thu chi tháng', async () => {
    await mount(<OverviewScreen />);
    expect(screen.getByText('CÒN TIÊU ĐƯỢC HÔM NAY')).toBeTruthy();
    expect(screen.getByText('Số dư')).toBeTruthy();
    expect(screen.getByText('Chi tháng')).toBeTruthy();
  });

  it('Sổ hiện giao dịch vừa ghi', async () => {
    await mount(<TransactionsScreen />);
    expect(screen.getAllByText('Cơm trưa').length).toBeGreaterThan(0);
  });

  it('Sổ nợ hiện người mình nợ', async () => {
    await mount(<DebtsScreen />);
    expect(screen.getAllByText(/a Quý/).length).toBeGreaterThan(0);
  });
});
