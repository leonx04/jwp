// Alert.alert của React Native nhận chuỗi thô (không qua AppText) → dịch tại một chỗ duy nhất thay vì sửa 40 nơi gọi.
import { Alert } from 'react-native';

import { t } from './index';

const original = Alert.alert.bind(Alert);

Alert.alert = (title, message, buttons, options) =>
  original(
    t(title),
    message ? t(message) : message,
    buttons?.map((button) => (button.text ? { ...button, text: t(button.text) } : button)),
    options,
  );
