// Ngân sách
export const budgets: Record<string, string> = {
  'Vượt ngân sách “{name}” {remaining}': 'Over budget “{name}” by {remaining}',
  'Ngân sách “{name}” đã dùng {ratio}%, còn {remaining}':
    'Budget “{name}” is {ratio}% used, {remaining} left',
  'Chưa đặt tên ngân sách.': 'Give the budget a name.',
  'Hạn mức phải lớn hơn 0.': 'The limit must be greater than 0.',
  'Hạn mức quá lớn.': 'The limit is too large.',
  'Vượt ngân sách': 'Over budget',
  'Chu kỳ bắt đầu': 'Cycle starts',
  'Chu kỳ bắt đầu ngày': 'Cycle start day',
  'Theo cài đặt chung': 'Follow the general setting',
  'Ngày 31 (cuối tháng)': 'Day 31 (end of month)',
  'Chu kỳ {start} – {end}': 'Cycle {start} – {end}',
  'Ngày phải từ 1 đến 31.': 'The day must be between 1 and 31.',
  'Ngày bắt đầu chu kỳ phải từ 1 đến 31.': 'The cycle start day must be between 1 and 31.',
  'Chỉ áp dụng cho ngân sách này, ví dụ lương về ngày 5 thì chọn ngày 5 để kỳ chạy từ 5 đến 4 tháng sau. Ngày 31 = cuối tháng.':
    'Applies to this budget only. For example, if you are paid on the 5th, pick day 5 so the period runs from the 5th to the 4th of next month. Day 31 = end of month.',
  'Đã chi {spent} / {limit}': 'Spent {spent} / {limit}',
  '{spent} / {limit} · tối đa {perDay}/ngày ({daysLeft} ngày)':
    '{spent} / {limit} · up to {perDay}/day ({daysLeft} days)',
  'Vượt {remaining}': 'Over by {remaining}',
  'Còn {remaining} · tối đa {perDay}/ngày ({daysLeft} ngày)':
    '{remaining} left · up to {perDay}/day ({daysLeft} days)',
  '· giữ tốc độ này sẽ vượt (~{projected})': '· at this pace you will go over (~{projected})',
  'Ngân sách tháng này': 'This month’s budgets',
  'Đã lưu ngân sách': 'Budget saved',
  'Xoá ngân sách?': 'Delete budget?',
  'Giao dịch không bị ảnh hưởng.': 'Transactions are not affected.',
  'Sửa ngân sách': 'Edit budget',
  'Thêm ngân sách': 'Add budget',
  Tên: 'Name',
  'vd: Ăn uống tháng': 'e.g. Monthly food',
  'Hạn mức mỗi tháng': 'Monthly limit',
  'Danh mục áp dụng': 'Applies to categories',
  'Mọi khoản chi': 'All expenses',
  'Ví áp dụng': 'Applies to wallets',
  'Chọn ví': 'Choose wallets',
  'Xoá ngân sách': 'Delete budget',
  'Chưa có ngân sách nào': 'No budgets yet',
  'Đặt hạn mức chi mỗi tháng cho Ăn uống, Đổ xăng… app sẽ báo khi gần hết hoặc có nguy cơ vượt.':
    'Set a monthly limit for Food, Fuel… and the app warns you when it runs low or is likely to be exceeded.',
  'Chỉ tính khoản chi (không tính chuyển khoản, điều chỉnh số dư, sổ nợ). Kỳ theo ngày bắt đầu tháng trong cài đặt.':
    'Only expenses count (not transfers, balance adjustments or the debt book). The period follows the month start day in settings.',
  'Không chọn = tính mọi khoản chi.': 'None selected = all expenses count.',
  'Không chọn = tính mọi ví.': 'None selected = all wallets count.',
};
