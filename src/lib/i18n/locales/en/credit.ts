// Ví trả sau / thẻ tín dụng, trả góp, nhập biên lai
export const credit: Record<string, string> = {
  'Trả nợ ví trả sau': 'Pay off pay-later wallet',
  'Chưa có ví để trả nợ': 'No wallet to pay from',
  'Hãy tạo một ví thường (ngân hàng, tiền mặt) trước.':
    'Create a regular wallet (bank, cash) first.',
  'Trả nợ ví {name}?': 'Pay off {name}?',
  'Trả {amount} từ {name} vào {name2}. Dư nợ sẽ giảm tương ứng, {name3} bị trừ {amount2}.':
    'Pay {amount} from {name} into {name2}. The amount owed goes down accordingly and {name3} is charged {amount2}.',
  'Đã trả {amount} cho {name}': 'Paid {amount} to {name}',
  'Chưa trả được': 'Could not pay',
  'Số kỳ trả góp không hợp lệ.': 'The number of installments is not valid.',
  'Không tìm thấy ví.': 'Wallet not found.',
  'Chưa cài ngày chốt sao kê & hạn trả — sửa ví để app tính bill':
    'Statement and due days are not set — edit the wallet so the app can work out the bill',
  'Quá hạn {daysUntilDue} ngày · còn phải trả {dueAmount} (hạn {due})':
    '{daysUntilDue} days overdue · {dueAmount} still to pay (due {due})',
  'hạn hôm nay': 'due today',
  'hạn ngày mai': 'due tomorrow',
  'còn {days} ngày': '{days} days left',
  'Kỳ này phải trả {dueAmount} trước {due} · {when}':
    'This period: pay {dueAmount} before {due} · {when}',
  'Chưa tới kỳ chốt · dự kiến phải trả {estimatedAmount} trước {date} (bill chốt {closeDate})':
    'Statement not closed yet · expect to pay {estimatedAmount} before {date} (bill closes {closeDate})',
  'Đã trả đủ kỳ này': 'Paid in full this period',
  'Kỳ này không có bill': 'No bill this period',
  'Kỳ sau ~{estimatedAmount} · hạn {date}': 'Next period ~{estimatedAmount} · due {date}',
  'Hạn mức {creditLimit} · còn {available}': 'Limit {creditLimit} · {available} available',
  'Chưa đặt hạn mức': 'No credit limit set',
  'Dư nợ': 'Amount owed',
  'Đã trả hết · Lưu trữ ví': 'Fully paid · Archive wallet',
  'Trả bill {dueAmount}': 'Pay bill {dueAmount}',
  'Ví trả sau {name}': 'Pay-later wallet {name}',
  'Xoá kế hoạch trả góp?': 'Delete installment plan?',
  'Khoản mua vẫn giữ nguyên. Phần chưa tới hạn sẽ tính hết vào bill kỳ tới.':
    'The purchase stays as it is. The part not yet due moves entirely into the next bill.',
  'Đã xoá kế hoạch trả góp': 'Installment plan deleted',
  'Đã xong': 'Done',
  'Còn lại': 'Remaining',
  'Xoá kế hoạch trả góp {title}': 'Delete installment plan {title}',
  'Chia thành {months} kỳ trong bill {name}': 'Split into {months} periods on the {name} bill',
  'Chia khoản mua thành nhiều kỳ': 'Split the purchase into installments',
  'Số kỳ': 'Number of periods',
  '{m} tháng': '{m} months',
  'Phí mỗi tháng': 'Monthly fee',
  '0 nếu trả góp 0%': '0 for 0% installments',
  'Mỗi kỳ': 'Per period',
  'Tổng phải trả': 'Total to pay',
  '{total} (phí {fee})': '{total} (fee {fee})',
  'Kỳ đầu tiên': 'First period',
  'hạn {firstDue}': 'due {firstDue}',
  'Nhập giá mua để xem số tiền mỗi kỳ.': 'Enter the price to see the amount per period.',
  // Nhập biên lai bằng ảnh
  'Không đọc được ảnh': 'Could not read the image',
  'Clipboard chưa có ảnh. Hãy sao chép ảnh biên lai trước.':
    'The clipboard has no image. Copy a receipt image first.',
  'Người {type}: {counterparty}': 'Counterparty ({type}): {counterparty}',
  chuyển: 'sent',
  nhận: 'received',
  'Đã lưu {length} giao dịch': 'Saved {length} transactions',
  'Lưu {length} giao dịch': 'Save {length} transactions',
  'Ảnh được đọc ngay trên máy, không gửi đi đâu. Chọn nhiều ảnh cùng lúc để nhập hàng loạt.':
    'Images are read on your phone and never sent anywhere. Pick several at once to import in bulk.',
  'Chọn ảnh từ thư viện': 'Choose images from the gallery',
  'Dán ảnh từ clipboard': 'Paste image from clipboard',
  'Kiểm tra lại · {length}': 'Review · {length}',
  'Phóng to ảnh biên lai': 'Zoom the receipt image',
  'Bấm vào ảnh để phóng to': 'Tap the image to zoom',
  'Có vẻ đã nhập rồi (trùng mã giao dịch)': 'Looks already imported (same transaction code)',
  'Đọc chưa chắc chắn, hãy kiểm tra': 'Not sure about the reading, please check',
  'Nguồn tiền theo biên lai: {sourceName}': 'Source of funds on the receipt: {sourceName}',
  'Biên lai ghi nguồn tiền từ {sourceName} nhưng chưa có ví khớp. Hãy chọn ví đúng.':
    'The receipt shows funds from {sourceName} but no wallet matches. Please pick the right wallet.',
  'Gợi ý: {categoryHint}': 'Suggestion: {categoryHint}',
  'Chưa có ảnh nào': 'No images yet',
  'Chụp màn hình biên lai chuyển khoản / ví điện tử rồi chọn ảnh ở trên.':
    'Screenshot a bank transfer / e-wallet receipt, then choose the image above.',
};
