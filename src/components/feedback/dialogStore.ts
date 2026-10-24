// Hộp thoại theo giao diện app (thay hộp Alert xám của Android). Gọi được từ bất kỳ đâu:
// Alert.alert(...) cũ được chuyển sang đây (src/lib/i18n/patchAlert.ts), code mới dùng confirm().
// Hộp thoại xếp hàng: bấm nút trong hộp này mở hộp khác thì hộp sau hiện ngay sau đó.
import { create } from 'zustand';

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type Dialog = {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  /** Bấm ra ngoài / nút Back được đóng hộp (mặc định: khi có nút kiểu 'cancel') */
  cancelable: boolean;
  onDismiss?: () => void;
};

type DialogState = {
  queue: Dialog[];
  /** Có DialogHost đang gắn ở root layout (không có → dùng Alert gốc của hệ thống) */
  hostMounted: boolean;
  setHostMounted: (mounted: boolean) => void;
};

let counter = 0;

export const useDialogs = create<DialogState>()((set) => ({
  queue: [],
  hostMounted: false,
  setHostMounted: (hostMounted) => set({ hostMounted }),
}));

export function showDialog(input: {
  title: string;
  message?: string;
  buttons?: DialogButton[];
  cancelable?: boolean;
  onDismiss?: () => void;
}): number {
  const buttons = input.buttons?.length ? input.buttons : [{ text: 'OK' }];
  const dialog: Dialog = {
    id: ++counter,
    title: input.title,
    message: input.message,
    buttons,
    cancelable: input.cancelable ?? buttons.some((b) => b.style === 'cancel'),
    onDismiss: input.onDismiss,
  };
  useDialogs.setState((s) => ({ queue: [...s.queue, dialog] }));
  return dialog.id;
}

const remove = (id: number) => {
  const dialog = useDialogs.getState().queue.find((d) => d.id === id);
  if (dialog) useDialogs.setState((s) => ({ queue: s.queue.filter((d) => d.id !== id) }));
  return dialog;
};

/** Bấm nút thứ `index`: đóng hộp trước rồi mới chạy onPress (để onPress mở được hộp mới) */
export function pressDialogButton(id: number, index: number): void {
  remove(id)?.buttons[index]?.onPress?.();
}

/** Bấm ra ngoài / Back: chỉ đóng khi hộp cho phép; chạy nút 'cancel' nếu có */
export function dismissDialog(id: number): void {
  const dialog = useDialogs.getState().queue.find((d) => d.id === id);
  if (!dialog?.cancelable) return;
  remove(id);
  dialog.buttons.find((b) => b.style === 'cancel')?.onPress?.();
  dialog.onDismiss?.();
}

/** Hỏi xác nhận, trả về true khi người dùng đồng ý */
export function confirm({
  title,
  message,
  confirmText = 'Đồng ý',
  cancelText = 'Huỷ',
  destructive = false,
}: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    showDialog({
      title,
      message,
      buttons: [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
    });
  });
}
