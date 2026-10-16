// Tự đọc thông báo / SMS ngân hàng: hộp chờ, quy tắc phân loại, cài đặt
export const capture: Record<string, string> = {
  'Cụm từ cần ít nhất {MIN_PATTERN_LENGTH} ký tự.':
    'The phrase needs at least {MIN_PATTERN_LENGTH} characters.',
  'Chưa chọn danh mục.': 'Choose a category.',
  'Danh mục không còn tồn tại.': 'This category no longer exists.',
  'Đã có quy tắc với cụm từ này.': 'A rule with this phrase already exists.',
  'Chuyển tiền giữa ví': 'Transfer between wallets',
  'App đọc từ thông báo ngân hàng — bấm để kiểm tra và ghi':
    'Read from a bank notification — tap to review and record',
  'App đọc thông báo (và SMS) biến động số dư của ngân hàng / ví điện tử ngay trên máy, rồi gợi ý ghi giao dịch. Không gửi đi đâu, không cần mật khẩu ngân hàng.':
    'The app reads balance-change notifications (and SMS) from your bank / e-wallet right on your phone, then suggests recording the transaction. Nothing is sent anywhere and no bank password is needed.',
  'Bản app này chưa có module đọc thông báo (đang chạy Expo Go hoặc bản cài cũ). Cần cài bản JWP mới build.':
    'This build has no notification-reading module (running in Expo Go or an old install). Install a freshly built JWP.',
  'Thông báo có tên này được gợi ý là chuyển giữa các ví của bạn. Khi một ngân hàng báo trừ và ngân hàng khác báo cộng đúng số tiền trong vòng 2 phút, app luôn gộp thành một lần chuyển tiền.':
    'Notifications containing this name are suggested as transfers between your own wallets. When one bank reports a debit and another reports a credit of the same amount within 2 minutes, the app always merges them into one transfer.',
  'Cài đặt › Ứng dụng › Khởi chạy ứng dụng › JWP › chọn “Quản lý thủ công” rồi bật Tự động khởi chạy, Khởi chạy phụ, Chạy trong nền. Nếu không, hệ thống có thể giết dịch vụ đọc thông báo.':
    'Settings › Apps › App launch › JWP › choose “Manage manually”, then turn on Auto-launch, Secondary launch and Run in background. Otherwise the system may kill the notification service.',
  'Thanh toán thành công': 'Payment successful',
  'Thanh toán 35.000đ cho Highlands Coffee': 'Payment of 35,000đ to Highlands Coffee',
  'Chờ xác nhận': 'Pending',
  'Đã ghi': 'Recorded',
  'Đã bỏ qua': 'Skipped',
  'Không đọc được': 'Unreadable',
  'Cấp quyền truy cập thông báo': 'Grant notification access',
  'Android sẽ mở danh sách ứng dụng được đọc thông báo. Chọn JWP và bật lên.':
    'Android will open the list of apps allowed to read notifications. Choose JWP and turn it on.',
  'Để sau': 'Later',
  'Mở cài đặt': 'Open settings',
  'Chưa được cấp quyền đọc SMS': 'SMS read permission not granted',
  'Đã thêm {pending} giao dịch mẫu vào hộp chờ': 'Added {pending} sample transactions to the inbox',
  'Đã chép nhật ký — dán cho mình để chỉnh bộ đọc':
    'Log copied — paste it to me so I can tune the reader',
  'Tự đọc thông báo': 'Read notifications',
  'Bật tự đọc': 'Turn on auto-read',
  'Bắt thông báo của các app ngân hàng bên dưới': 'Catch notifications from the bank apps below',
  'Quyền truy cập thông báo': 'Notification access',
  'Đã bật': 'Enabled',
  'Chưa bật — bấm để mở cài đặt hệ thống': 'Not enabled — tap to open system settings',
  'Đọc cả SMS biến động số dư': 'Also read balance-change SMS',
  'Chỉ tin nhắn từ tên chữ (MBBANK, TPBank…), không đọc số điện thoại cá nhân':
    'Only messages from alphabetic senders (MBBANK, TPBank…), never personal phone numbers',
  'Xem {pending} giao dịch chờ xác nhận': 'View {pending} pending transactions',
  'Xem hộp chờ xác nhận': 'View the pending inbox',
  'Quy tắc phân loại': 'Categorization rules',
  'Tự gán danh mục theo nội dung, tuỳ chọn tự ghi luôn':
    'Assign a category from the content, optionally record automatically',
  'Chuyển tiền giữa ví của bạn': 'Transfers between your wallets',
  'Tên của bạn': 'Your name',
  'vd: Nguyễn Xuân Dũng': 'e.g. Nguyen Xuan Dung',
  'Tự ghi khi đã gộp thành chuyển tiền': 'Record automatically once merged into a transfer',
  'Không cần bấm xác nhận cho các cặp trừ/cộng khớp nhau':
    'No confirmation needed for matching debit / credit pairs',
  'App được đọc': 'Apps to read',
  'Máy Huawei: để app không bị tắt nền': 'Huawei phones: keep the app from being killed',
  'Nhật ký ({length})': 'Log ({length})',
  'Thử bằng tin mẫu': 'Try with sample messages',
  'Chép nhật ký': 'Copy log',
  'Xoá nhật ký': 'Clear log',
  'Chưa bắt được thông báo nào. Khi có, nội dung gốc hiện ở đây để chỉnh bộ đọc nếu cần.':
    'No notification caught yet. When one arrives, the original text shows here so the reader can be tuned.',
  'Giao dịch app tự đọc từ thông báo / SMS ngân hàng. Kiểm tra rồi bấm Ghi — app mở form đã điền sẵn số tiền, ví và nội dung.':
    'Transactions the app read from bank notifications / SMS. Review, then tap Record — the app opens a form with the amount, wallet and note filled in.',
  'Hai thông báo (một trừ, một cộng) cùng số tiền, sát nhau → gộp thành một lần chuyển tiền, không tính là chi tiêu hay thu nhập.':
    'Two notifications (one debit, one credit) with the same amount close together → merged into one transfer, not counted as spending or income.',
  'Không có giao dịch nào đang chờ': 'Nothing is pending',
  'Khi ngân hàng báo biến động số dư, giao dịch sẽ hiện ở đây.':
    'When your bank reports a balance change, the transaction shows up here.',
  'Cài đặt tự đọc': 'Auto-read settings',
  'Có vẻ bạn đã ghi lần chuyển này rồi.': 'You seem to have recorded this transfer already.',
  'Ghi chuyển khoản': 'Record transfer',
  'Đã ghi rồi': 'Already recorded',
  'Bỏ qua': 'Skip',
  'Không có nội dung': 'No content',
  '(theo quy tắc “{pattern}”{autoAccept})': '(by the rule “{pattern}”{autoAccept})',
  ', tự ghi': ', auto-record',
  '(trước giờ hay dùng cho nội dung này)': '(usually used for this kind of note)',
  'Có tên bạn trong nội dung — có thể là chuyển từ/đến ví khác của chính bạn.':
    'Your name appears in the note — it may be a transfer to / from another wallet of yours.',
  'Ghi là chuyển khoản': 'Record as transfer',
  'Ghi giao dịch': 'Record transaction',
  'Đã lưu quy tắc': 'Rule saved',
  'Xoá quy tắc?': 'Delete rule?',
  'Giao dịch đã ghi không bị ảnh hưởng.': 'Recorded transactions are not affected.',
  'Sửa quy tắc': 'Edit rule',
  'Thêm quy tắc': 'Add rule',
  'Nội dung chứa': 'Content contains',
  'vd: highlands, grab, tên người chuyển': 'e.g. highlands, grab, sender name',
  'Áp dụng cho': 'Applies to',
  'Thu và chi': 'Income and expense',
  'Chỉ khoản chi': 'Expenses only',
  'Chỉ khoản thu': 'Income only',
  'Tự ghi, không cần xác nhận': 'Auto-record, no confirmation',
  'Khớp là ghi luôn vào đúng ví của ngân hàng. Chỉ bật cho khoản bạn chắc chắn.':
    'A match is recorded straight into that bank’s wallet. Only turn this on for items you are sure about.',
  'Xoá quy tắc': 'Delete rule',
  'Giao dịch tự đọc có nội dung chứa cụm từ của quy tắc sẽ được điền sẵn danh mục. Bật “Tự ghi” để ghi luôn, không cần xác nhận. Chưa có quy tắc thì app vẫn đoán theo những lần bạn đã ghi trước đó.':
    'Auto-read transactions whose content contains the rule’s phrase get the category pre-filled. Turn on “Auto-record” to record them without confirmation. With no rules the app still guesses from what you recorded before.',
  'khoản thu': 'income',
  'khoản chi': 'expense',
  'Chưa có quy tắc nào': 'No rules yet',
  'Ví dụ: nội dung chứa “highlands” → Cà phê. Cũng có thể tạo nhanh sau khi ghi một giao dịch từ hộp chờ.':
    'Example: content contains “highlands” → Coffee. You can also create one right after recording a transaction from the inbox.',
  'Chứa “{pattern}”': 'Contains “{pattern}”',
  'Danh mục đã xoá': 'Deleted category',
  'chỉ {type}': 'only {type}',
  'tự ghi': 'auto-record',
};
