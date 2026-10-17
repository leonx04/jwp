// Vá thư viện react-native-android-widget (chạy sau mỗi lần `npm install`).
// Lý do: thư viện xử lý "chạm widget → mở app / mở liên kết" bằng broadcast rồi startActivity từ receiver; Android
// (đặc biệt Huawei) chặn kiểu này ("Background activity start") nên chạm widget không mở được màn hình.
// Bản vá cho OPEN_URI / OPEN_APP dùng thẳng PendingIntent.getActivity. File đã vá nằm ở patches/.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const lib = path.join(root, 'node_modules', 'react-native-android-widget');
const target = path.join(lib, 'android/src/main/java/com/reactnativeandroidwidget/RNWidget.java');
const patched = path.join(root, 'patches/react-native-android-widget/RNWidget.java');

if (!fs.existsSync(target)) process.exit(0); // chưa cài thư viện (vd: bước cài đầu tiên)

const version = JSON.parse(fs.readFileSync(path.join(lib, 'package.json'), 'utf8')).version;
if (version !== '0.22.1') {
  console.warn(`[apply-widget-patch] Bỏ qua: bản vá viết cho 0.22.1, đang cài ${version}. Kiểm tra lại RNWidget.registerClickTask.`);
  process.exit(0);
}
if (fs.readFileSync(target, 'utf8').includes('JWP patch')) process.exit(0); // đã vá

fs.copyFileSync(patched, target);
console.log('[apply-widget-patch] Đã vá RNWidget.java (mở app / liên kết khi chạm widget).');
