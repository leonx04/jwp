// Bọc expo-haptics: cùng API, nhưng tôn trọng công tắc "Rung khi chạm" trong Giao diện.
import * as Native from 'expo-haptics';

import { useSettings } from '@/features/settings/store';

export const ImpactFeedbackStyle = Native.ImpactFeedbackStyle;
export const NotificationFeedbackType = Native.NotificationFeedbackType;

const enabled = () => useSettings.getState().haptics;
const off = () => Promise.resolve();

export const impactAsync: typeof Native.impactAsync = (style) =>
  enabled() ? Native.impactAsync(style) : off();
export const notificationAsync: typeof Native.notificationAsync = (type) =>
  enabled() ? Native.notificationAsync(type) : off();
export const selectionAsync: typeof Native.selectionAsync = () =>
  enabled() ? Native.selectionAsync() : off();
