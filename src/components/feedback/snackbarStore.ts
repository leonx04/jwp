// Thông báo ngắn ở cuối màn hình (vd "Đã xoá giao dịch · Hoàn tác"). Gọi được từ bất kỳ đâu.
import { create } from 'zustand';

export type SnackbarMessage = {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'success' | 'error';
};

type SnackbarState = {
  current: SnackbarMessage | null;
  show: (message: Omit<SnackbarMessage, 'id'>) => void;
  hide: () => void;
};

let counter = 0;

export const useSnackbar = create<SnackbarState>()((set) => ({
  current: null,
  show: (message) => set({ current: { ...message, id: ++counter } }),
  hide: () => set({ current: null }),
}));

export const showSnackbar = (message: Omit<SnackbarMessage, 'id'>) =>
  useSnackbar.getState().show(message);
