// Khoản lặp, gợi ý đối chiếu, đổ xăng, khởi động
export const recurring: Record<string, string> = {
  'Khoản lặp hằng tháng': 'Monthly recurring items',
  'App tìm các khoản xuất hiện đều đặn mỗi tháng (tiền nhà, đăng ký, lương…) mà bạn chưa đặt lịch. Tạo lịch để được nhắc trước hạn và thấy trong dự báo dòng tiền.':
    'The app looks for items that show up every month (rent, subscriptions, salary…) that you have not scheduled. Create a schedule to be reminded before the due date and to see it in the cash-flow forecast.',
  'Đã tạo lịch “{title}”': 'Created the schedule “{title}”',
  'Chưa phát hiện khoản lặp nào': 'No recurring items found yet',
  'Cần một khoản xuất hiện ít nhất 3 tháng liên tiếp, cùng ngày và số tiền gần nhau. Ghi chép thêm vài tháng là app sẽ nhận ra.':
    'An item must appear for at least 3 months in a row, on a similar day and amount. Keep recording for a few more months and the app will spot it.',
  'Số tiền thay đổi, lấy mức trung vị ·': 'The amount varies, using the median ·',
  'Tạo lịch': 'Create schedule',
  'Không phải khoản lặp': 'Not recurring',
  // Gợi ý đối chiếu số dư
  '“{label}” {abs} xuất hiện hai lần gần nhau — có thể ghi trùng, xoá một khoản sẽ khớp.':
    '“{label}” {abs} appears twice close together — possibly recorded twice; deleting one would match.',
  '“{label}” {amount} đang ghi là {type} — nếu thật ra là {type2} thì số dư sẽ khớp.':
    '“{label}” {amount} is recorded as {type} — if it is actually {type2} the balance would match.',
  'Khoản thu “{label}” {abs} đang ở ví {accountId} — có thể thuộc ví này.':
    'Income “{label}” {abs} is in the wallet {accountId} — it may belong to this wallet.',
  khác: 'another',
  'Khoản chi “{label}” {abs} đang ở ví {accountId} — có thể thật ra trả từ ví này.':
    'Expense “{label}” {abs} is in the wallet {accountId} — it may actually have been paid from this wallet.',
  'Khoản chi “{label}” {abs} ở ví này — có thể thật ra trả từ ví khác.':
    'Expense “{label}” {abs} is in this wallet — it may actually have been paid from another wallet.',
  'Khoản thu “{label}” {abs} ở ví này — có thể thật ra vào ví khác.':
    'Income “{label}” {abs} is in this wallet — it may actually have gone into another wallet.',
  '{abs} là mức phí ngân hàng hay gặp (phí chuyển khoản, SMS banking, duy trì tài khoản…) — có thể bạn chưa ghi.':
    '{abs} is a common bank fee (transfer fee, SMS banking, account maintenance…) — you may not have recorded it.',
  'Có thể thiếu một khoản thu {abs} chưa ghi (lương, tiền nhận, lãi…).':
    'There may be an unrecorded income of {abs} (salary, money received, interest…).',
  'Có thể thiếu một khoản chi {abs} chưa ghi.': 'There may be an unrecorded expense of {abs}.',
  // Đổ xăng
  'Bằng giá lần đổ trước': 'Same as the last fill-up',
  Tăng: 'Up',
  Giảm: 'Down',
  'Giá xăng hôm nay (đồng / lít)': 'Fuel price today (VND / liter)',
  'Chạm để nhập, vd 21.350': 'Tap to enter, e.g. 21,350',
  'Dùng giá lần trước {price}': 'Use last price {price}',
  '{daysAgo} ngày trước': '{daysAgo} days ago',
  // Khởi động / dữ liệu
  'Đã tự ghi nhận {posted} khoản theo lịch': 'Automatically recorded {posted} scheduled items',
  'Không mở được dữ liệu': 'Could not open the data',
  'Cập nhật cấu trúc cơ sở dữ liệu thất bại. Dữ liệu cũ vẫn còn nguyên trong máy.':
    'Updating the database structure failed. Your old data is still safely on this device.',
  'Số dư dự kiến: cuối kỳ {last}, thấp nhất {lowest}':
    'Projected balance: {last} at the end, lowest {lowest}',
  '{title}: {label}. Đổi biểu tượng': '{title}: {label}. Change icon',
  'Đã ghi {title} · {amount}': 'Recorded {title} · {amount}',
};
