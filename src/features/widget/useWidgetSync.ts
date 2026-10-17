// Giữ widget luôn mới: khi dữ liệu liên quan đổi (thêm giao dịch, sửa ngân sách…) thì vẽ lại các widget đang ở màn hình chính.
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { db } from '@/db';

import { loadWidgetData } from './data';
import { renderWidgetByName, WIDGET_NAMES } from './widgets';

const WATCHED = new Set(['transactions', 'accounts', 'schedules', 'schedule_occurrences', 'budgets']);
const DEBOUNCE_MS = 1500;

function refreshWidgets() {
  try {
    const data = loadWidgetData(db);
    for (const widgetName of WIDGET_NAMES) {
      void requestWidgetUpdate({
        widgetName,
        renderWidget: (info) => renderWidgetByName(widgetName, data, info),
      }).catch(() => undefined);
    }
  } catch {
    // Widget chỉ là phần phụ: lỗi ở đây không được làm hỏng app
  }
}

export function useWidgetSync() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    refreshWidgets();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (!WATCHED.has(tableName)) return;
      clearTimeout(timer);
      timer = setTimeout(refreshWidgets, DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
}
