// Định nghĩa kênh + nhóm nút hành động của thông báo.
// LƯU Ý: kênh Android tạo rồi thì KHÔNG đổi được mức quan trọng/âm thanh (chỉ đổi tên, mô tả).
// Muốn đổi → tạo kênh với id mới. Vì vậy thiết kế sẵn các kênh ngay từ đầu.
import type { NotificationsModule } from './module';

export const CHANNELS = {
  payments: { name: 'Khoản phải trả', description: 'Nhắc trước hạn, đến hạn và quá hạn' },
  income: { name: 'Khoản thu', description: 'Lương, khoản thu dự kiến cần xác nhận' },
  debts: { name: 'Sổ nợ', description: 'Hạn trả nợ, nhắc thu nợ' },
  daily: { name: 'Nhắc hằng ngày', description: 'Tóm tắt buổi sáng, nhắc ghi chép' },
} as const;

export type ChannelId = keyof typeof CHANNELS;

/** Nhóm nút hành động hiển thị dưới thông báo khoản phải trả */
export const PAYMENT_CATEGORY = 'payment-due';

export const ACTIONS = {
  markPaid: 'mark-paid',
  snooze: 'snooze',
  open: 'open',
} as const;

export async function setupChannelsAndCategories(N: NotificationsModule): Promise<void> {
  await Promise.all(
    (Object.keys(CHANNELS) as ChannelId[]).map((id) =>
      N.setNotificationChannelAsync(id, {
        name: CHANNELS[id].name,
        description: CHANNELS[id].description,
        // HIGH: hiện popup (heads-up) trên đầu màn hình + âm thanh. 'daily' nhẹ hơn: không popup.
        importance: id === 'daily' ? N.AndroidImportance.DEFAULT : N.AndroidImportance.HIGH,
        // Không đặt `sound`: trường này chỉ nhận tên file âm thanh tuỳ chỉnh; bỏ trống = âm mặc định của máy
        vibrationPattern: [0, 200, 120, 200],
        lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
      }),
    ),
  );

  await N.setNotificationCategoryAsync(PAYMENT_CATEGORY, [
    {
      identifier: ACTIONS.markPaid,
      buttonTitle: 'Đã thanh toán',
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTIONS.snooze,
      buttonTitle: 'Nhắc lại sau',
      // Không mở app: thử xem JS có nhận được sự kiện khi app ở nền không (mục tiêu của spike)
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTIONS.open,
      buttonTitle: 'Mở',
      options: { opensAppToForeground: true },
    },
  ]);
}
