import { Alert } from 'react-native';

import '@/lib/i18n/patchAlert';

import { confirm, dismissDialog, pressDialogButton, showDialog, useDialogs } from './dialogStore';

const current = () => useDialogs.getState().queue[0];

beforeEach(() => useDialogs.setState({ queue: [], hostMounted: true }));

describe('hộp thoại theo giao diện app', () => {
  it('không truyền nút → một nút OK; không có nút huỷ thì không đóng khi bấm ra ngoài', () => {
    const id = showDialog({ title: 'Đã lưu' });
    expect(current().buttons).toEqual([{ text: 'OK' }]);
    dismissDialog(id);
    expect(current()?.id).toBe(id);
    pressDialogButton(id, 0);
    expect(current()).toBeUndefined();
  });

  it('bấm nút: đóng hộp trước rồi chạy onPress, hộp mở trong onPress hiện tiếp theo', () => {
    const seen: (number | undefined)[] = [];
    const id = showDialog({
      title: 'Xoá?',
      buttons: [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            seen.push(useDialogs.getState().queue.length);
            showDialog({ title: 'Chưa xoá được' });
          },
        },
      ],
    });
    pressDialogButton(id, 1);
    expect(seen).toEqual([0]);
    expect(current().title).toBe('Chưa xoá được');
  });

  it('confirm(): Đồng ý → true, bấm ra ngoài → false', async () => {
    const yes = confirm({ title: 'Trả hết?' });
    pressDialogButton(current().id, 1);
    await expect(yes).resolves.toBe(true);

    const no = confirm({ title: 'Xoá khoản nợ?', destructive: true });
    expect(current().buttons[1].style).toBe('destructive');
    dismissDialog(current().id);
    await expect(no).resolves.toBe(false);
  });

  it('Alert.alert cũ được chuyển vào hàng đợi, giữ kiểu nút và hành động', () => {
    const onDelete = jest.fn();
    Alert.alert('Xoá lần ghi này?', 'Không hoàn tác được.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: onDelete },
    ]);
    expect(current()).toMatchObject({
      title: 'Xoá lần ghi này?',
      message: 'Không hoàn tác được.',
      cancelable: true,
    });
    expect(current().buttons.map((b) => b.style)).toEqual(['cancel', 'destructive']);
    pressDialogButton(current().id, 1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('chưa gắn DialogHost (tác vụ nền) → dùng hộp của hệ thống', () => {
    useDialogs.setState({ hostMounted: false });
    Alert.alert('Lỗi');
    expect(useDialogs.getState().queue).toHaveLength(0);
  });
});
