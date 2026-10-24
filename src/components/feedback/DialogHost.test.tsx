jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: () => Promise.resolve() }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme';

import { DialogHost } from './DialogHost';
import { showDialog, useDialogs } from './dialogStore';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

it('hiện hộp thoại, bấm nút thì đóng và chạy hành động', async () => {
  const onDelete = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider preference="light" amoled={false} accent="indigo">
        <DialogHost />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  expect(useDialogs.getState().hostMounted).toBe(true);

  await act(async () => {
    showDialog({
      title: 'Xoá khoản nợ?',
      message: 'Các lần trả cũng bị xoá.',
      buttons: [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: onDelete },
      ],
    });
  });
  expect(screen.getByText('Xoá khoản nợ?')).toBeTruthy();
  expect(screen.getByText('Các lần trả cũng bị xoá.')).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByText('Xoá'));
  });
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Xoá khoản nợ?')).toBeNull();
}, 30_000);
