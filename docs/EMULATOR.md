# Chạy JWP trên máy ảo

Máy ảo `JWP_Lite`: Android 14, x86_64, 2 GB RAM, đồ hoạ dùng card máy tính. Chạy bằng dòng lệnh, không cần mở Android Studio, nên tốn ít RAM hơn nhiều.

## Lần đầu

```powershell
.\scripts\emulator.ps1          # tạo và bật máy ảo
npx expo run:android            # build bản debug và cài vào máy ảo
cd android; .\gradlew --stop    # tắt Gradle cho đỡ RAM sau khi build xong
```

`expo run:android` chỉ build đúng kiến trúc của máy đang cắm (x86_64 với máy ảo), nên không cần sửa `buildArchs` trong `app.json`; bản release vẫn chỉ có arm64-v8a và armeabi-v7a.

## Hằng ngày

```powershell
.\scripts\emulator.ps1
npx expo start                  # chỉ khởi động Metro, mở app JWP trong máy ảo là tự nối
```

Chỉ cần build lại (`npx expo run:android`) khi đổi thư viện có code native, `app.json`, hoặc `modules/`.

## Thử các tính năng cần điện thoại thật

| Tính năng | Cách thử trên máy ảo |
| --- | --- |
| Bắt giao dịch từ SMS | `adb emu sms send 8xxx "TK 1234 -125,000VND Shopee"` |
| Widget | Giữ màn hình chính → Widgets → JWP |
| Thông báo hẹn giờ | Settings → System → Date & time, tắt tự động rồi tua giờ |
| Chạy task nền ngay | `adb shell cmd jobscheduler run -f com.jungnguyen.jwp <job-id>` |
| Quét hoá đơn (OCR) | Camera sau của máy ảo là cảnh ảo; dễ hơn là chọn ảnh từ thư viện sau khi `adb push hoadon.jpg /sdcard/Pictures/` |

## Khi máy ảo chậm

- Bật ảo hoá trong BIOS (Intel VT-x / AMD-V) và Windows Hypervisor Platform.
- Đóng Android Studio nếu đang mở.
- `.\scripts\emulator.ps1 -Wipe` khi máy ảo bị lỗi lạ.
