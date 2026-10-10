// Nhật ký các lần người dùng bấm vào thông báo / nút hành động — để màn kiểm tra hiển thị kết quả spike.
// Chỉ giữ trong bộ nhớ (không lưu xuống máy).
import { create } from 'zustand';

export type ResponseLogEntry = {
  at: number;
  action: string;
  title: string;
  /** App có đang mở (tiền cảnh/nền) khi nhận sự kiện không */
  source: 'listener' | 'cold-start';
};

type ResponseLogState = {
  entries: ResponseLogEntry[];
  add: (entry: ResponseLogEntry) => void;
};

export const useResponseLog = create<ResponseLogState>()((set) => ({
  entries: [],
  add: (entry) => set((state) => ({ entries: [entry, ...state.entries].slice(0, 10) })),
}));
