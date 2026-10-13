// Giữ báo cáo buổi sáng luôn mới: tính lại khi mở app / quay lại app, khi dữ liệu thu chi đổi,
// khi đổi cài đặt liên quan. Gắn một lần (gắn trùng chỗ khác cũng không sao: dùng chung bộ hẹn giờ).
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { db } from '@/db';
import { useSettings } from '@/features/settings/store';

import { notificationsSupported } from '../module';
import { requestMorningBriefingRefresh } from '../morningBriefing';
import { requestReminderRefresh } from '../reminderSync';

const WATCHED = new Set([
  'transactions',
  'accounts',
  'schedules',
  'schedule_occurrences',
  'debts',
  'debt_records',
]);

export function useMorningBriefingSync() {
  useEffect(() => {
    if (!notificationsSupported || Platform.OS === 'web') return;
    requestMorningBriefingRefresh(db, 1500);
    requestReminderRefresh(db, 2500);

    const data = addDatabaseChangeListener(({ tableName }) => {
      if (WATCHED.has(tableName)) {
        requestMorningBriefingRefresh(db);
        requestReminderRefresh(db);
      }
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestMorningBriefingRefresh(db, 1500);
      requestReminderRefresh(db, 2500);
    });
    const settings = useSettings.subscribe((state, prev) => {
      if (
        state.notifications !== prev.notifications ||
        state.currencySymbol !== prev.currencySymbol ||
        state.safetyThreshold !== prev.safetyThreshold
      ) {
        requestMorningBriefingRefresh(db, 500);
        requestReminderRefresh(db, 800);
      }
    });

    return () => {
      data.remove();
      app.remove();
      settings();
    };
  }, []);
}
