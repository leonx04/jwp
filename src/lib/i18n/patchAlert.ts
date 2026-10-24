// Alert.alert của React Native nhận chuỗi thô (không qua AppText) → dịch tại một chỗ duy nhất thay vì sửa 40 nơi gọi.
// Khi DialogHost đã gắn ở root layout, hộp thoại hiện theo giao diện app thay cho hộp xám của hệ thống.
import { Alert } from 'react-native';

import { showDialog, useDialogs } from '@/components/feedback/dialogStore';

import { t } from './index';

const original = Alert.alert.bind(Alert);

Alert.alert = (title, message, buttons, options) => {
  const text = {
    title: t(title),
    message: message ? t(message) : message,
    buttons: buttons?.map((button) => (button.text ? { ...button, text: t(button.text) } : button)),
  };
  if (!useDialogs.getState().hostMounted) {
    original(text.title, text.message, text.buttons, options);
    return;
  }
  showDialog({
    title: text.title,
    message: text.message,
    buttons: text.buttons?.map((b) => ({
      text: b.text ?? 'OK',
      style: b.style,
      onPress: b.onPress ? () => b.onPress?.() : undefined,
    })),
    cancelable: options?.cancelable,
    onDismiss: options?.onDismiss,
  });
};
