// Giữ widget luôn mới: khi dữ liệu liên quan đổi (thêm giao dịch, sửa ngân sách…) thì vẽ lại các widget đang ở màn hình chính.
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { db } from '@/db';
import { SNAPSHOT_TABLES } from '@/features/forecast/snapshot';

import { renderWidgetForInfo } from './render';
import { WIDGET_NAMES } from './widgets';

const WATCHED = new Set<string>([...SNAPSHOT_TABLES, 'budgets']);
const DEBOUNCE_MS = 1500;

function refreshWidgets() {
  try {
    for (const widgetName of WIDGET_NAMES) {
      void requestWidgetUpdate({
        widgetName,
        renderWidget: (info) => renderWidgetForInfo(db, info),
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
