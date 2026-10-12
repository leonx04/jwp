import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

/**
 * Thời điểm mở hộp chọn đang hiện (0 = không có). Android chỉ hiện một hộp — gọi open() lần hai thì
 * native cập nhật hộp cũ và KHÔNG bao giờ trả kết quả cho lần gọi sau.
 */
let openedAt = 0;
/**
 * Khi hộp đang hiện, người dùng không bấm được giao diện phía sau → lần gọi thứ hai chỉ có thể là bấm
 * đúp (trong lúc hộp chưa kịp hiện) hoặc khoá bị kẹt (hộp mất khi Activity bị tạo lại). Quá ngưỡng này
 * thì coi như kẹt và mở hộp mới.
 */
const DOUBLE_TAP_MS = 1500;

/**
 * Mở hộp chọn ngày / giờ của hệ thống (theo giờ Việt Nam). Trả về thời điểm mới hoặc null nếu huỷ / lỗi.
 * KHÔNG dùng design: 'material' — kiểu đó bắt buộc theme app là Theme.MaterialComponents,
 * theme mặc định của Expo không phải → Android văng app khi mở hộp chọn.
 */
export function pickDateTime(value: number, mode: 'date' | 'time'): Promise<number | null> {
  if (Platform.OS !== 'android') return Promise.resolve(null);
  // Bấm hai lần liên tiếp → bỏ qua lần sau (kết quả thuộc về lần bấm đầu)
  const now = Date.now();
  if (openedAt && now - openedAt < DOUBLE_TAP_MS) return Promise.resolve(null);
  // Giá trị hỏng (NaN do ngày lỗi) → mở ở thời điểm hiện tại thay vì truyền ngày không hợp lệ xuống native
  const initial = Number.isFinite(value) ? value : now;

  return new Promise<number | null>((resolve) => {
    let settled = false;
    const finish = (result: number | null) => {
      if (settled) return;
      settled = true;
      if (openedAt === now) openedAt = 0;
      resolve(result);
    };
    openedAt = now;
    try {
      DateTimePickerAndroid.open({
        value: new Date(initial),
        mode,
        is24Hour: true,
        timeZoneName: 'Asia/Ho_Chi_Minh',
        // Tuần bắt đầu từ thứ Hai như lịch Việt Nam (0 = Chủ nhật)
        firstDayOfWeek: mode === 'date' ? 1 : undefined,
        onValueChange: (_event, date) => {
          const ms = date?.getTime();
          finish(ms != null && Number.isFinite(ms) ? ms : null);
        },
        onDismiss: () => finish(null),
        onNeutralButtonPress: () => finish(null),
        onError: () => finish(null),
      });
    } catch {
      finish(null);
    }
  });
}
