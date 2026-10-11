import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

/**
 * Mở hộp chọn ngày / giờ của hệ thống (theo giờ Việt Nam). Trả về thời điểm mới hoặc null nếu huỷ.
 * KHÔNG dùng design: 'material' — kiểu đó bắt buộc theme app là Theme.MaterialComponents,
 * theme mặc định của Expo không phải → Android văng app khi mở hộp chọn.
 */
export function pickDateTime(value: number, mode: 'date' | 'time'): Promise<number | null> {
  if (Platform.OS !== 'android') return Promise.resolve(null);
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode,
      is24Hour: true,
      timeZoneName: 'Asia/Ho_Chi_Minh',
      onChange: (event, date) => resolve(event.type === 'set' && date ? date.getTime() : null),
    });
  });
}
