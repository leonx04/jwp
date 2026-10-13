# JWP — Plan phát triển app quản lý chi tiêu

> Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router · SQLite (Drizzle)
> Dự án: `E:\Co-pro\App\JWP` — `Base` chỉ dùng để ghi chú / học.
> **Local-first**: mọi dữ liệu nằm trên máy (SQLite), không cần backend. Sao lưu bằng file JSON/CSV. Firebase để sau nếu cần đồng bộ nhiều máy.
> Test: máy ảo Android (Pixel_API36) + Huawei JAD-AL00 của người dùng (arm64, API 31, không có Google Play Services).
> Trạng thái: ✅ Giai đoạn 0–3 xong (+ logo ngân hàng, ví trả sau) · ⏭ đang làm: **Đợt 2 — sửa lỗi, nhẹ & mượt** (mục 15)

---

## 1. Tính năng chính

| Nhóm | Nội dung |
|---|---|
| Ví & giao dịch | Nhiều ví, thu / chi, danh mục có màu + icon, tìm kiếm, lọc |
| **Chuyển tiền giữa ví** | Chuyển qua lại, phí chuyển, rút tiền mặt, điều chỉnh số dư, chuyển định kỳ (mục 3) |
| **Tag & gợi ý thông minh** | Tag nhiều-nhiều, gợi ý tiêu đề / danh mục / tag theo lịch sử và **số tiền tương tự**, lịch sử giá (mục 4) |
| **Dự trù & lịch thu chi** | Đặt lịch khoản thu (lương...) và chi (tiền nhà, trả góp...), dòng tiền dự kiến, cảnh báo âm tiền, chi tiêu an toàn mỗi ngày |
| **Nhắc nhở** | Thông báo popup có nút hành động, nhắc trước hạn, quá hạn, nhắc nợ |
| **Sổ nợ** | Ai nợ tôi / tôi nợ ai, trả từng phần, vay thêm, lãi, tổng hợp "nếu trả hết nợ thì còn bao nhiêu" |
| Ngân sách | Hạn mức chi theo tháng cho danh mục / ví, thanh tiến độ, cảnh báo sắp vượt |
| Thống kê | Biểu đồ danh mục, theo tháng, so sánh tháng trước, báo cáo có bộ lọc |
| **Sao lưu** | Xuất / khôi phục JSON, xuất CSV, chia sẻ file (Zalo, Drive, Email...) |
| **Import Ivy Wallet** | Đọc đúng file backup Ivy (UTF-16BE), dữ liệu khớp 100% |
| **Giao diện** | Sáng / Tối / Hệ thống / AMOLED, chọn màu chủ đạo, animation mượt |
| **Tiền Việt** | `1.500.000 ₫`, rút gọn `1,5 Tr`, không thừa / thiếu đơn vị |
| Riêng tư | Ẩn số dư (chạm để hiện) |

---

## 2. Tính năng tham khảo từ Ivy Wallet

Nguồn: https://github.com/Ivy-Apps/ivy-wallet (Kotlin, GPL-3.0, ngừng phát triển từ 11/2024).
JWP **viết lại từ đầu bằng TypeScript**, chỉ tham khảo tính năng và cấu trúc dữ liệu, **không sao chép code** (nếu chép code thì JWP buộc phải theo giấy phép GPL-3.0).

| Tính năng Ivy | JWP | Giai đoạn |
|---|---|---|
| Ví, danh mục, giao dịch thu/chi/chuyển | Có | 2 |
| Ví "không tính vào tổng số dư" (`includeInBalance`) | Có — vd quỹ du lịch tách riêng | 2 |
| Gợi ý tiêu đề cũ (`showTitleSuggestions`) | Có, **nâng cấp**: gợi ý theo số tiền, giờ, danh mục | 2 |
| Tag + gắn tag giao dịch | Có | 2 |
| Planned payments (khoản định kỳ / một lần) | Có, **nâng cấp**: lịch thu, ngày cuối tháng, cuối tuần, ước tính | 3 |
| Số dư dự kiến (balance + planned) | Có, **nâng cấp**: dòng tiền theo ngày, chi tiêu an toàn | 3 |
| Thông báo nhắc | Có, **nâng cấp**: nút hành động, quá hạn, giờ yên lặng | 4 |
| Loans + loan records (trả bớt / vay thêm / lãi) | Có, thành **Sổ nợ** theo người | 5 |
| Backup JSON, xuất CSV, import | Có | 1 · 6 |
| Budgets (ngân sách theo danh mục/ví) | Có | 7 |
| Reports có bộ lọc, Pie chart, tìm kiếm | Có | 7 |
| Ngày bắt đầu tháng (`start_date_of_month`) | Có — vd tháng tính từ ngày nhận lương | 7 |
| Chuyển khoản tính như thu/chi trong thống kê (`transfers_as_inc_exp`) | Có, tuỳ chọn (Ivy của bạn đang bật) | 7 |
| Ẩn số dư | Có | 8 |
| Khoá app bằng vân tay | **Không** (đã bỏ theo yêu cầu) | — |
| AMOLED, sáng/tối/tự động | Có | 0 · 8 |
| Bàn phím số tuỳ chọn (`standardKeypadLayout`) | Có — bàn phím riêng có phím `000` | 2 |
| Thẻ ví / danh mục dạng gọn (compact) | Có, tuỳ chọn | 8 |
| Tỷ giá, nhiều loại tiền | **Không** (chỉ VND) | — |
| Widget màn hình chính | Để sau (cần dev build, không chạy trong Expo Go) | sau |
| Đăng nhập / đồng bộ cloud | Để sau (Firebase) | sau |

---

## 3. Chuyển tiền giữa các ví

| Tính năng | Chi tiết |
|---|---|
| Chuyển khoản | Ví nguồn → ví đích, số tiền, ngày, ghi chú. Ví nguồn bị trừ, ví đích được cộng |
| Đảo chiều nhanh | Nút ⇅ đổi ví nguồn / đích |
| Cặp ví hay dùng | Chip gợi ý "MB bank → Momo", "TP Bank → Tiền mặt" theo lịch sử |
| Phí chuyển | Tuỳ chọn: ghi thêm một khoản chi "Phí giao dịch" gắn với lần chuyển |
| Rút tiền mặt / nạp ví | Là chuyển khoản (Ngân hàng → Tiền mặt, Ngân hàng → Momo) |
| Điều chỉnh số dư | Nhập số dư thực tế → app tạo giao dịch điều chỉnh (không tính vào thống kê) |
| Chuyển định kỳ | Lịch loại "chuyển khoản" (vd mỗi tháng 1 triệu vào quỹ du lịch) |
| Thống kê | Mặc định không tính chuyển khoản là thu/chi; có tuỳ chọn như Ivy |

---

## 4. Tag & gợi ý thông minh

**Tag:** nhiều tag cho một giao dịch (vd `#du-lich-da-lat`, `#cong-ty`, `#gia-dinh`), có màu, tạo nhanh ngay khi nhập, lọc / thống kê theo tag.

**Gợi ý khi nhập giao dịch** — tính bằng SQL ngay trên máy, không cần mạng:

| Gợi ý | Cách tính |
|---|---|
| Tiêu đề khi đang gõ | Tìm trong lịch sử, **không phân biệt dấu** ("ca phe" khớp "Cà phê"), xếp theo số lần dùng + gần đây |
| Chọn tiêu đề → tự điền | Danh mục, ví, tag của lần gần nhất dùng tiêu đề đó; điền số tiền nếu đang trống |
| Theo **số tiền tương tự** | Nhập 35.000 ₫ → các khoản cùng loại có số tiền ±15% (trùng khớp được ưu tiên), vd "Cà phê · Ăn uống (12 lần)" |
| Theo thời điểm | Ưu tiên khoản hay xảy ra vào cùng khung giờ / ngày trong tuần (cà phê buổi sáng, đổ xăng cuối tuần) |
| Tag | Tag hay đi cùng danh mục / tiêu đề đã chọn + tag dùng gần đây |
| Lịch sử giá | "Lần trước 35.000 ₫ (3 ngày trước) · trung bình 32.000 ₫ · cao nhất 45.000 ₫" |

Bật / tắt gợi ý trong Cài đặt. Có test cho bộ chuẩn hoá tiếng Việt và thuật toán xếp hạng.

---

## 5. Dữ liệu Ivy Wallet — kết quả phân tích & cách import

File: `IvyWalletBackup_*/data*.json` (đã thêm vào `.gitignore` — **không bao giờ commit**).

| Phát hiện | Cách xử lý |
|---|---|
| Mã hoá **UTF-16 Big-Endian** (BOM `FE FF`) | Nhận diện BOM: UTF-8 / UTF-16LE / UTF-16BE |
| 7 ví, 18 danh mục, 495 giao dịch (406 chi · 51 thu · 38 chuyển) | Import đầy đủ |
| 143 giao dịch `dateTime = null` + `dueDate` = **các kỳ Ivy sinh trước ~3 năm** từ quy tắc định kỳ | **Không** import thành giao dịch; chỉ import **quy tắc**, app tự sinh kỳ. Test: kỳ do JWP sinh ra phải trùng khớp 143 ngày của Ivy |
| 6 quy tắc định kỳ (đều là CHI, hằng tháng) | → bảng `schedules`. 1 khoản một lần bị dời ngày (18/09 → 22/10) → lưu "ghi đè kỳ". 1 khoản một lần (280.000 ₫) không còn kỳ nào → trạng thái đã kết thúc |
| Số tiền dạng số thực nhưng đều nguyên | Lưu **INTEGER (đồng)** |
| Không có "số dư ban đầu" — số dư = Σ giao dịch | Tính giống Ivy |
| Chuyển khoản có `toAccountId`, `toAmount` | Trừ ví nguồn, cộng ví đích |
| Màu ARGB số nguyên có dấu (`-49056`) | → hex `#FF4060` |
| Icon tên Ivy (`fooddrink`, `ic_vue_*`…), có icon rỗng | Bảng ánh xạ + icon mặc định |
| Giao dịch không danh mục / không tiêu đề; ví "Tiền mặt" thiếu `orderNum` | "Chưa phân loại", tiêu đề rỗng. **Ivy không ghi giá trị mặc định** vào file → thiếu `orderNum` = 0 (xếp đầu), thiếu `includeInBalance` = true |
| Thời gian UTC (ms) | Hiển thị giờ Việt Nam |
| `settings.bufferAmount = 4.000.000` | → "Ngưỡng an toàn" trong dự trù |
| `settings.theme = DARK` | → theme Tối |
| `sharedPrefs`: `transfers_as_inc_exp=true`, `hide_current_balance=false`, `lock_app=false` | → cài đặt tương ứng |
| Ivy còn có `tags`, `tagAssociations`, `budgets`, `loans`, `loanRecords`, `isDeleted`, `includeInBalance`, `description` — **file của bạn không có** | Bộ import vẫn hỗ trợ (tuỳ chọn), bỏ qua bản ghi `isDeleted = true` |

**Đáp án kiểm thử (đã xác nhận khớp app Ivy):**

| Ví | Số dư |
|---|---|
| Tiền mặt | 2.000 ₫ |
| TP Bank | 935 ₫ |
| Techcombank | 400 ₫ |
| Ví Shoppe | 10.000 ₫ |
| MB bank | 60.279 ₫ |
| Momo | 0 ₫ |
| Quỹ du lịch Momo | 100.000 ₫ |
| **Tổng** | **173.614 ₫** |

**Luồng import:** chọn file (.json / .zip) → nhận diện mã hoá → kiểm tra cấu trúc (zod) → **màn xem trước** (số lượng + số dư từng ví) → xác nhận → ghi trong **một SQLite transaction** → kiểm tra lại số lượng & tổng tiền. Lưu id gốc Ivy để import lại không bị trùng.

---

## 6. Dự trù & lịch thu chi

### 6.1. Lịch (schedule)
| Thuộc tính | Lựa chọn |
|---|---|
| Loại | Thu (lương, thưởng...) / Chi (tiền nhà, trả góp, điện nước...) / Chuyển khoản (để tiết kiệm) |
| Lặp lại | Một lần / mỗi N ngày / tuần (chọn thứ) / tháng (ngày X hoặc **ngày cuối tháng**) / năm |
| Ngày 29–31 | Tháng không đủ ngày → lấy ngày cuối tháng (31/01 → 28 hoặc 29/02) |
| Rơi vào cuối tuần | Giữ nguyên / lùi về thứ Sáu / dời sang thứ Hai |
| Kết thúc | Không bao giờ / đến ngày / sau N lần |
| Số tiền | Cố định, hoặc **ước tính** (điện, nước) → nhập số thực tế khi xác nhận |
| Khi đến hạn | **Chờ xác nhận** (mặc định) / **Tự ghi nhận** khi mở app |

**Trạng thái mỗi kỳ:** Sắp tới → Đến hạn → Quá hạn → Đã thanh toán (tạo giao dịch thật) / Bỏ qua / Dời ngày.
Chỉ lưu quy tắc + các kỳ đã xử lý / ghi đè; kỳ tương lai được **tính ra khi cần**.

### 6.2. Dòng tiền dự kiến
- Dòng thời gian 7 / 30 / 90 ngày: số dư hôm nay → từng khoản thu/chi dự kiến → **số dư sau mỗi khoản**.
- Biểu đồ đường số dư dự kiến, vùng đỏ dưới **ngưỡng an toàn**.
- **Cảnh báo:** "Ngày 19/10 số dư dự kiến âm 2.826.386 ₫".
- **Chi tiêu an toàn:** `(số dư − các khoản phải trả trước kỳ thu tiếp theo − ngưỡng an toàn) ÷ số ngày còn lại`.
- Cảnh báo theo ví: "Tiền nhà trả từ MB bank nhưng ví chỉ còn 60.279 ₫".

---

## 7. Nhắc nhở & thông báo

**Nền tảng:** `expo-notifications` — thông báo **cục bộ**, **không cần Firebase/Google**, nhưng **phải dùng bản dev build** (xem kết quả spike bên dưới).

| Loại | Ví dụ nội dung | Mặc định |
|---|---|---|
| Sắp đến hạn chi | "💸 Ngày mai: Tiền nhà 3.000.000 ₫ · MB bank (còn 60.279 ₫ ⚠)" | 1 ngày trước, 09:00 + đúng ngày |
| Khoản thu | "💰 Hôm nay nhận lương 15.000.000 ₫ — xác nhận đã nhận?" | Đúng ngày, 09:00 |
| Quá hạn | "⏰ Quá hạn 2 ngày: Trả góp 1.131.000 ₫" | Mỗi ngày 09:00 đến khi xử lý |
| Nợ đến hạn | "🤝 Hôm nay hạn A trả bạn 300.000 ₫" | Đúng ngày |
| Vượt ngân sách | "Ăn uống đã dùng 90% ngân sách tháng" | Bật |
| Tóm tắt buổi sáng | "Hôm nay có 2 khoản cần trả: 1.300.000 ₫" | Tắt |
| Nhắc ghi chép | "Hôm nay bạn đã ghi chi tiêu chưa?" | Tắt, 21:00 |

- **Popup heads-up**: kênh Android mức HIGH + âm thanh. Kênh không sửa được sau khi tạo → định nghĩa sẵn: `payments`, `income`, `debts`, `daily`.
- **Nút hành động**: `Đã thanh toán` · `Nhắc lại sau 1 giờ` · `Mở`.
- Giờ yên lặng, giờ nhắc mặc định, bật/tắt từng loại; thẻ "Sắp tới 7 ngày" ở Tổng quan.
- Lên lịch theo **cửa sổ trượt** (~60 ngày tới), đồng bộ lại khi mở app / sửa lịch / import.
- Màn **"Kiểm tra thông báo"** + hướng dẫn cài đặt cho Huawei (cho phép thông báo, banner, khởi chạy ứng dụng thủ công).

**Kết quả spike Giai đoạn 0** (máy ảo Android 16 / API 36, bản dev build):

| Thử | Kết quả |
|---|---|
| Expo Go Android | ❌ Chỉ cần import `expo-notifications` là ném lỗi (SDK 53+) → app nạp thư viện có điều kiện, trong Expo Go phần thông báo tự tắt |
| Hộp thoại xin quyền (Android 13+) | ✅ "Allow JWP to send you notifications?" |
| Popup heads-up + 3 nút hành động | ✅ Đã thanh toán · Nhắc lại sau · Mở |
| Bấm nút khi app ở nền (không mở app) | ✅ JS nhận được, ẩn thông báo, hẹn nhắc lại |
| App bị tắt hẳn, đến giờ hẹn | ✅ Vẫn hiện thông báo |
| Độ đúng giờ | ⚠ Trễ ~30 giây – 1,5 phút: Android 12+ chỉ cho báo thức chính xác khi người dùng bật "Báo thức & lời nhắc" cho app. Nhắc lúc 09:00 đến 09:01 là chấp nhận được; Giai đoạn 4 thêm nút mở cài đặt này cho ai cần chính xác |
| Huawei EMUI | ⏳ Chưa thử — cần cài bản dev build lên P40 |
| Icon nhỏ trên thanh trạng thái | ⏳ Đang là hình tròn mặc định → Giai đoạn 4 thêm icon đơn sắc (`expo-notifications` plugin `icon`) |

---

## 8. Sổ nợ

- Người → Khoản nợ (**Họ nợ tôi** / **Tôi nợ họ**, gốc, ngày, hạn, ghi chú) → Các lần ghi nhận: **trả bớt**, **vay thêm**, **lãi** (giống loan records của Ivy).
- Tổng hợp: họ nợ tôi · tôi nợ họ · **nếu trả hết nợ ngay còn bao nhiêu (hoặc thiếu bao nhiêu)** · nếu thu hết nợ · tài sản ròng.
- Theo từng người: bù trừ hai chiều, thanh tiến độ, nhãn quá hạn, lịch sử.
- Liên kết ví **bật mặc định** (chọn ví khi tạo), tắt được cho từng khoản (nợ cũ trước khi dùng app).
- Nhắc nợ qua thông báo + chia sẻ tin nhắn nhắc nợ (Zalo, Messenger).

---

## 9. Định dạng tiền Việt (`src/lib/money`)

| Trường hợp | Kết quả |
|---|---|
| Đầy đủ | `1.500.000 ₫` (chấm ngăn nghìn, NBSP trước ₫, **một đơn vị duy nhất**, không `,00`) |
| Rút gọn | `850 ₫` · `150k` · `1Tr` · `1,5Tr` · `2,35 Tỷ` (phẩy thập phân, ≤ 2 số lẻ, bỏ `,0`) |
| Dấu | `−50.000 ₫` (chi, đỏ) · `+50.000 ₫` (thu, xanh) · trung tính cho chuyển khoản |
| Nhập | Bàn phím riêng có phím `000`, tự chèn dấu chấm khi gõ, chặn số 0 đầu & số quá lớn |
| Dán / nhập nhanh | `1.500.000`, `1,500,000`, `1.5tr`, `150k`, `2 tỷ` |
| Cài đặt | Ký hiệu `₫` / `đ` / `VND` |

---

## 10. Sao lưu & xuất file

| Tính năng | Chi tiết |
|---|---|
| Xuất JSON | `{ app: "JWP", schemaVersion, exportedAt, data }`, UTF-8, tên `JWP_2026-10-11_0212.json` — gồm lịch, sổ nợ, tag, ngân sách, cài đặt |
| Khôi phục JSON | **Thay thế** (tự sao lưu bản hiện tại trước) hoặc **Gộp** theo id |
| Xuất CSV | Giao dịch / Sổ nợ / Lịch, lọc theo ngày, **UTF-8 BOM**, tiền là số nguyên thô |
| Chia sẻ | `expo-sharing` → Zalo, Drive, Email… |

---

## 11. Công nghệ

Tất cả chạy trong Expo Go **trừ thông báo** (cần dev build: `npx expo run:android`, lần build đầu ~25 phút, các lần sau nhanh hơn nhiều).

| Mục đích | Thư viện | Cài ở giai đoạn |
|---|---|---|
| Điều hướng | expo-router | 0 |
| Cơ sở dữ liệu | expo-sqlite + drizzle-orm 0.45 (migration, live query) | 0 |
| Cài đặt (theme, ký hiệu tiền) | zustand + `expo-sqlite/kv-store` (đọc đồng bộ, không nháy màu khi mở app) | 0 |
| Thông báo | expo-notifications (local) | 0 |
| Animation / cử chỉ | react-native-reanimated + react-native-gesture-handler | 0 |
| Font | Be Vietnam Pro (@expo-google-fonts) | 0 |
| Phản hồi | expo-haptics, expo-linear-gradient | 0 |
| Kiểm tra dữ liệu, ngày | zod, date-fns | 0 |
| File | expo-file-system, expo-document-picker, expo-sharing | 1 · 6 |
| Danh sách dài | @shopify/flash-list | 2 |
| Bottom sheet | @gorhom/bottom-sheet | 2 |
| Chọn ngày | @react-native-community/datetimepicker | 2 |
| Biểu đồ | react-native-svg + d3-shape (tự vẽ, nhẹ) — đã bỏ Skia/victory-native ở Đợt 2 | 3 · 7 |

Không dùng MMKV / module native ngoài Expo Go. Khi cần → dev build `npx expo run:android`.

---

## 12. Cấu trúc thư mục

```
src/
├── app/                 # Chỉ chứa route (Expo Router)
│   ├── (tabs)/          # Tổng quan · Giao dịch · [＋] · Lịch · Thêm
│   └── settings/ ...    # transaction/[id], schedule/[id], debt/[id], import/ivy ...
├── db/                  # schema.ts, client.ts, DatabaseProvider.tsx
├── features/
│   ├── accounts/ categories/ transactions/ tags/
│   ├── suggestions/     # gợi ý tiêu đề / tag / danh mục
│   ├── schedules/ forecast/ notifications/
│   ├── debts/ budgets/ stats/ backup/ settings/
├── lib/                 # money/, encoding/, text/ (bỏ dấu), date/, recurrence/
├── components/ui/       # AppText, Button, Card, Screen, AmountText, ...
└── theme/               # buildTheme(mode, accent), ThemeProvider
drizzle/                 # migration SQL do drizzle-kit sinh ra (không sửa tay)
```

---

## 13. Các giai đoạn

| # | Giai đoạn | Kết quả kiểm chứng |
|---|---|---|
| 0 ✅ | Nền tảng + **spike thông báo** | Expo Router, DB + migration, money lib + test, mã hoá + test, theme động (sáng/tối/AMOLED + màu), font, khung 5 tab, màn kiểm tra thông báo. Chạy được trên máy ảo (Expo Go + dev build), 143 test pass |
| 1 ✅ | **Import Ivy** | Số dư 7 ví khớp bảng mục 5 (test tự động) · kỳ sinh ra khớp 143 kỳ của Ivy |
| 2 | Ví, danh mục, giao dịch, **chuyển tiền, tag, gợi ý** | Tổng quan, danh sách theo ngày, thêm/sửa bằng bottom sheet, chuyển khoản + phí, điều chỉnh số dư, vuốt xoá, gợi ý theo số tiền |
| 3 | **Lịch thu chi & dự trù** | Engine lặp lại (test ngày cuối tháng, cuối tuần), dòng tiền dự kiến, chi tiêu an toàn |
| 4 | **Nhắc nhở** | Popup + nút hành động, cửa sổ trượt, màn kiểm tra thông báo hoàn chỉnh |
| 5 | **Sổ nợ** | Đầy đủ mục 8, có nhắc nợ |
| 6 | **Sao lưu** | Xuất → khôi phục ra dữ liệu y hệt (test), CSV mở đúng trong Excel |
| 7 | Thống kê, tìm kiếm, **ngân sách** | Biểu đồ, báo cáo lọc, ngày bắt đầu tháng, ngân sách + cảnh báo |
| 8 | Hoàn thiện | Ẩn số dư, animation, haptics, màn trống, thử 5.000 giao dịch |

**Test tự động:** tiền, mã hoá, bỏ dấu tiếng Việt, gợi ý, mapper Ivy (fixture ẩn danh), số dư, engine lặp lại, dự trù, sổ nợ, CSV, backup round-trip.

---

## 14. Quyết định đã chốt
- Tên app: **JWP** · dự án riêng tại `E:\Co-pro\App\JWP`
- Số dư import khớp Ivy Wallet ✅
- Local-first, không backend; Firebase tìm hiểu sau
- Sổ nợ mặc định trừ/cộng vào ví, tắt được cho từng khoản
- Tham khảo tính năng Ivy, không chép code (GPL-3.0)

---

## 15. Đợt 2 — sửa lỗi, nhẹ & mượt (v0.2)

Phản hồi sau khi cài APK lên máy thật (11/10/2026): app văng khi **dời ngày** và khi **đặt lịch nhận lương**, giật/lag và **nóng máy**, cài xong **190 MB**, icon danh mục ít, chưa có nhập bill bằng ảnh, chưa có sao lưu / xuất file, thống kê sơ sài, muốn xem lịch dạng **calendar**, rút gọn tiền `1k` / `1Tr`, logo app + hiệu ứng mở app.

### 15.1. Nguyên nhân đã xác định
| Vấn đề | Nguyên nhân | Hướng sửa |
|---|---|---|
| Văng app khi dời ngày / đặt lịch lương | `DateTimePickerAndroid.open({ design: 'material' })` bắt buộc theme Material Components, theme Expo không phải → crash | ✅ Bỏ `design: 'material'` (`pickDateTime.ts`); kiểm lại mọi chỗ chọn ngày/giờ |
| APK 73 MB, cài xong ~190 MB | **46 MB dex** chưa bật R8 · **Skia 11 MB** (chỉ dùng cho nền + 1 biểu đồ) · ML Kit OCR 11 MB · ART biên dịch thêm khi cài | Bật R8 + shrinkResources · bỏ Skia/victory-native → SVG · chỉ build arm64-v8a (+ armeabi-v7a) · ảnh WebP |
| Giật, nóng máy | **Làm mờ thời gian thực** (BlurView dimezis) trên thanh tab + header: chụp lại nội dung mỗi khung hình khi cuộn · canvas Skia toàn màn hình · bóng đổ nhiều lớp | Android: bỏ blur, dùng lớp phủ mờ đục tĩnh; nền gradient tĩnh; giảm bóng; rà re-render |

### 15.2. Phương án nhẹ & mượt (đã chọn ✅)
| Phương án | Giảm | Đánh đổi | Chọn |
|---|---|---|---|
| R8 minify + shrinkResources (`expo-build-properties`) | ~30 MB APK | Build release lâu hơn chút | ✅ |
| Bỏ Skia + victory-native, tự vẽ biểu đồ bằng react-native-svg + d3-shape | ~11 MB, ít GPU | Tự viết component biểu đồ | ✅ |
| Chỉ arm64-v8a (+ armeabi-v7a cho máy cũ) | đã làm | Không chạy trên máy x86 | ✅ |
| Bỏ blur thật trên Android, giữ GlassView trên iOS 26 | hết nóng máy khi cuộn | Kính "đục" thay vì mờ thật | ✅ |
| Logo ngân hàng 128px PNG → 96px WebP | ~70% dung lượng ảnh | — | ✅ |
| Bỏ ML Kit OCR, dùng OCR đám mây | 11 MB | Tốn phí, cần mạng, lộ dữ liệu | ❌ giữ OCR trên máy |
| Tách APK theo ABI / AAB qua Play Store | thêm vài MB | Cần tài khoản Play | để sau |

### 15.3. Phân công (agent chạy song song, mỗi agent sở hữu file riêng)
| Agent | Việc | File sở hữu |
|---|---|---|
| **A · perf-size** | R8/shrink + ABI qua `expo-build-properties`; bỏ blur Android; nền không Skia; giảm bóng; rà re-render & animation; logo ngân hàng → WebP; rà font thừa | `app.json` (mục plugins), `src/components/glass/*`, `src/components/ui/Screen.tsx`, `scripts/gen-bank-icons.js`, `assets/banks/*`, `src/lib/banks/logos.ts` |
| **B · stats-charts** | Bộ biểu đồ SVG (đường/vùng, cột, donut, sparkline, animation nhẹ) thay victory-native; màn **Thống kê**: kỳ tháng/năm, cơ cấu danh mục, so sánh tháng, xu hướng 6 tháng, nhận xét tự động | `src/components/charts/*`, `src/features/stats/*`, `src/app/stats/*` |
| **C · icons-categories** | ~150 icon chọn lọc theo nhóm + tìm kiếm tiếng Việt; danh mục dùng được **logo ngân hàng**; danh mục mặc định hợp người Việt | `src/lib/icons/*`, `src/components/ui/Pickers.tsx`, `src/features/categories/*`, `src/features/onboarding/defaults.ts`, `src/features/accounts/components/BankPicker.tsx`, `AccountEditScreen.tsx` |
| **D · receipts** | Đọc biên lai MB/TCB/VCB/TPBank/MoMo/ShopeePay… (parser + test), **quét ảnh** & **dán ảnh** từ bàn phím/clipboard, xem trước + sửa trước khi lưu, chống trùng bằng mã GD; chip gợi ý bậc số tiền | `src/features/receipts/*`, `src/app/receipt/*`, `TransactionEditorScreen.tsx`, `src/features/transactions/repository.ts` |
| **E · backup** | Xuất JSON (JWP đầy đủ + **dạng Ivy Wallet**), khôi phục (thay thế có tự sao lưu / gộp), **CSV chuẩn** (UTF-8 BOM, mở đúng Excel), chia sẻ / lưu vào máy, test round-trip | `src/features/backup/*`, `src/app/backup/*` |
| **F · calendar** | Lịch tháng trực quan trong tab Lịch (chuyển Danh sách ⇄ Lịch): chấm thu/chi theo ngày, tổng ngày, bấm ngày xem chi tiết, vuốt đổi tháng, ngày âm lịch | `src/features/schedules/components/Calendar*`, `src/features/schedules/screens/ScheduleScreen.tsx`, `src/lib/date/lunar.ts` |
| **G · brand-format** | Rút gọn tiền `1k` · `1Tr` · `1,5Tr` · `2,3 Tỷ`; **logo app** (icon, adaptive, monochrome, splash); **hiệu ứng mở app** ≤ 600 ms | `src/lib/money/*`, `assets/icon*`, `assets/splash*`, `assets/brand/*`, `app.json` (icon/splash), `src/app/_layout.tsx`, `src/components/brand/*` |
| **H · credit-today** | Thẻ ví trả sau (dư nợ, kỳ này phải trả, hạn, **Trả bill**); mục trả góp khi mua; thẻ **Hôm nay** (được tiêu bao nhiêu, đã tiêu, còn mấy ngày đến lương); thông báo **báo cáo buổi sáng** từng ví | `src/features/credit/components/*`, `src/features/today/*`, `OverviewScreen.tsx`, `AccountDetailScreen.tsx`, `src/features/notifications/*` |
| **Sau cùng · QA** | Build lại dev build, chạy máy ảo kiểm tra mọi luồng, sửa lỗi tích hợp, build APK release mới | — |

Quy tắc chung cho agent: không sửa file ngoài phần sở hữu (cần thì ghi vào báo cáo); không cài thêm package; không chạy Metro / máy ảo / Gradle; không git commit; chỉ chạy `npx tsc --noEmit` (bỏ qua lỗi ở file của agent khác) và `npx jest <thư mục của mình>`.

## 16. Đợt 3 — Sổ nợ · Đối chiếu · Ngân sách · Quỹ · Tự đọc thông báo

Hiện trạng: bảng `people / debts / debt_records / budgets` **đã có** (migration 0001, backup/restore đã xử lý) nhưng chưa có repository / màn hình nào → làm tiếp trên nền đó. Giao dịch gắn `debt_id` **không tính vào thống kê** (đã loại ở `stats`, `today`, `calendar`).
Thứ tự làm (theo độ phụ thuộc & rủi ro): **1 Sổ nợ → 3 Đối chiếu → 4 Ngân sách → 5 Quỹ → 2 Tự đọc thông báo** (mục 2 cần module native + build riêng nên để cuối).
Mỗi phase nhỏ: `tsc` + jest đúng thư mục + commit; thử trên máy qua Metro (JS) — riêng phase N cần build debug mới.

| Phase | Việc | File chính |
|---|---|---|
| **D1** | Sổ nợ — lõi: `compute.ts` (còn lại = gốc − trả + vay thêm + lãi, trạng thái quá hạn / sắp hạn, tổng "tôi nợ" / "họ nợ tôi") + `repository.ts` (tạo nợ + giao dịch ví gắn `debt_id`, trả bớt, vay thêm, lãi, đóng/xoá) + `queries.ts` + test | `src/features/debts/*` |
| **D2** | Màn **Sổ nợ** `/debts` (gom theo người, 2 tổng), chi tiết `/debt/[id]` (lịch sử, nút Trả / Vay thêm / Lãi / Đóng), thêm-sửa `/debt/edit` | `src/app/debt*`, `src/features/debts/screens/*` |
| **D3** | Nối vào app: mục ở tab Thêm, thẻ tóm tắt ở Tổng quan, nhắc hạn trả (thông báo), gợi ý biến giao dịch cũ ("Nợ a Quý", "Mượn a Toàn"…) thành khoản nợ | Overview, More, notifications |
| **R1** | **Đối chiếu số dư**: nhập số dư thật → chênh lệch + gợi ý nguyên nhân (giao dịch đúng bằng số chênh, phí chuyển khoản, giao dịch thiếu gần nhất) → tạo điều chỉnh / thêm giao dịch thiếu; lưu ngày đối chiếu gần nhất mỗi ví | `src/features/reconcile/*`, `src/app/account/reconcile.tsx` |
| **B1** | Ngân sách — lõi: chi theo kỳ (`startDayOfMonth`), lọc danh mục / ví, % dùng, tốc độ chi → dự báo vượt + test | `src/features/budgets/*` |
| **B2** | Màn `/budgets` (thanh tiến độ), thêm-sửa; thẻ ngân sách gần vượt ở Tổng quan; cảnh báo 80% / 100% sau khi lưu giao dịch | screens + Overview |
| **G1** | Quỹ / mục tiêu tiết kiệm: bảng `goals` (migration mới) gắn ví (tiến độ = số dư ví), hạn, số cần góp mỗi tháng; màn `/goals` + thẻ Tổng quan | `src/features/goals/*` |
| **N1** | Module native `jwp-notif` (NotificationListenerService, chỉ app ngân hàng / ví trong danh sách, lưu hàng đợi trên máy, không mạng); quyền truy cập thông báo | `modules/jwp-notif/*` |
| **N2** | Parser thông báo biến động số dư (số tiền, +/−, nội dung, số dư sau GD) + test; màn nhật ký để gửi mẫu thật chỉnh parser | `src/features/capture/parse.ts` |
| **N3** | Bảng `pending_imports` (migration), hộp "Chờ xác nhận": xác nhận → mở form giao dịch điền sẵn; bỏ qua; chống trùng bằng `externalRef` | `src/features/capture/*`, `/inbox` |
| **N4** | Cài đặt "Tự đọc thông báo": bật, chọn app ↔ ví, hướng dẫn Huawei (khởi chạy tự động); số dư sau GD dùng làm gợi ý đối chiếu | settings, reconcile |
| **QA** | `tsc` + `jest` + `expo lint`, build debug (N) → thử máy → build release → báo cáo | — |
