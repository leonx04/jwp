import { useEffect } from 'react';
import { AppState } from 'react-native';

import { db } from '@/db';

import { runAutoBackupIfDue } from './auto';

/** Chờ app ổn định rồi mới sao lưu, để không tranh tài nguyên lúc khởi động */
const STARTUP_DELAY_MS = 20_000;

/** Gắn một lần ở gốc app: sao lưu tự động khi đến hạn (lúc mở app và mỗi lần quay lại app). */
export function useAutoBackup() {
  useEffect(() => {
    const run = () => {
      try {
        runAutoBackupIfDue(db);
      } catch {
        // đã được ghi vào cấu hình (lastError); không làm hỏng app
      }
    };
    const timer = setTimeout(run, STARTUP_DELAY_MS);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && run());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
}
