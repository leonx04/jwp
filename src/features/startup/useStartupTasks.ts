// Việc chạy khi mở app và mỗi lần app quay lại tiền cảnh:
// - tự ghi nhận các kỳ đến hạn của lịch "Tự ghi nhận"
// - đồng bộ lại lịch thông báo nhắc nhở (Giai đoạn 4)
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { db } from '@/db';
import { processAutoPost } from '@/features/schedules/repository';

type Task = () => void | Promise<void>;

const extraTasks: Task[] = [];

/** Cho phép tính năng khác đăng ký việc cần chạy khi app mở / quay lại */
export function registerStartupTask(task: Task) {
  extraTasks.push(task);
}

function runAll() {
  try {
    const posted = processAutoPost(db);
    if (posted > 0)
      showSnackbar({ text: `Đã tự ghi nhận ${posted} khoản theo lịch`, tone: 'success' });
  } catch (error) {
    console.warn('[startup] processAutoPost lỗi:', error);
  }
  for (const task of extraTasks) {
    Promise.resolve()
      .then(task)
      .catch((error: unknown) => console.warn('[startup] tác vụ lỗi:', error));
  }
}

export function useStartupTasks() {
  useEffect(() => {
    runAll();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') runAll();
    });
    return () => subscription.remove();
  }, []);
}
