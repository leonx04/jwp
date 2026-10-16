// Đoạn chữ ghép cạnh biểu thức trong JSX (vd "{n} ví đang dùng") — AppText dịch từng đoạn, giữ khoảng trắng.
// Thêm khoá ở đây khi script scripts/i18n-scan.py còn thấy chữ tiếng Việt trên màn hình.
export const fragments: Record<string, string> = {
  // Đơn vị tiền rút gọn
  Tr: 'M',
  Tỷ: 'B',
  // Nhãn ngắn (tránh bị cắt)
  'Thu dự kiến': 'Income',
  'Chi dự kiến': 'Spending',
  'Tìm: cà phê, lương… (gõ có dấu = khớp đúng dấu)':
    'Search: coffee, salary… (accents = exact match)',
  '% so với': '% vs',
  '% so với tháng trước': '% vs last month',
  '1. Mở Ivy Wallet → Cài đặt → Backup data → lưu file .zip.':
    '1. Open Ivy Wallet → Settings → Backup data → save the .zip file.',
  '2. Bấm nút dưới đây và chọn file đó (.zip hoặc file .json bên trong).':
    '2. Tap the button below and choose that file (.zip or the .json inside).',
  // Tổng quan / Ví
  'ví đang dùng': 'wallets in use',
  // Thống kê
  'so với': 'vs',
  'Dự kiến cuối kỳ': 'Projected by period end',
  'giao dịch': 'transactions',
  // Báo cáo
  'so với tháng trước': 'vs last month',
  'Chi trung bình khoảng': 'Average spending about',
  '/ngày': '/day',
  // Sổ nợ
  'Nếu bù trừ hết: bạn': 'If everything is settled: you',
  'được nhận lại': 'get back',
  'còn phải trả': 'still owe',
  'Tìm thấy': 'Found',
  'khoản nợ trong giao dịch cũ': 'debts in past transactions',
  'Xem ›': 'View ›',
  Hiện: 'Show',
  Ẩn: 'Hide',
  'khoản đã xong / đã đóng': 'finished / closed',
  'Đã trả dư': 'Overpaid by',
  'so với số nợ.': 'compared to the debt.',
  // Lịch / lặp
  '· kỳ tới': '· next',
  'Lần gần nhất': 'Last on',
  '· kỳ tới dự kiến': '· next expected',
  'giữ tốc độ này sẽ vượt': 'at this pace you will go over',
  // Sao lưu / import
  'Bản sao luôn nằm trong thư mục riêng của app; chọn thêm thư mục ngoài để không mất khi gỡ app hoặc đổi máy.':
    'Backups are always kept in the app’s private folder; choose an external folder too so they survive uninstalling or changing phones.',
  'Chọn file sao lưu JWP. Khi thay thế, dữ liệu hiện tại được lưu lại trước':
    'Choose a JWP backup file. When replacing, the current data is saved first',
  'Chọn file sao lưu JWP. Khi thay thế, dữ liệu hiện tại được lưu lại trước khi ghi đè.':
    'Choose a JWP backup file. When replacing, the current data is saved before it is overwritten.',
  '1. Mở Ivy Wallet → Cài đặt → Backup data → lưu file .zip.\n2. Bấm nút dưới đây và chọn file đó (.zip hoặc file .json bên trong).\n3. Xem trước số dư từng ví, xác nhận để import.':
    '1. Open Ivy Wallet → Settings → Backup data → save the .zip file.\n2. Tap the button below and choose that file (.zip or the .json inside).\n3. Preview each wallet’s balance, then confirm to import.',
  'Gắn ví: tiến độ = số dư ví. Không gắn: bạn tự nhập số đã góp.':
    'Linked wallet: progress = wallet balance. No wallet: you enter the saved amount yourself.',
  // Tiêu đề màn hình & nhãn trợ năng
  'Lịch thu chi': 'Cash-flow calendar',
  'Tất cả lịch': 'All schedules',
  'Thêm lịch': 'Add schedule',
  'Quay lại': 'Back',
  'Kỳ trước': 'Previous',
  'Kỳ sau': 'Next',
  'Ẩn số dư': 'Hide balance',
  'Hiện số dư': 'Show balance',
  'Tổng số dư': 'Total balance',
};
