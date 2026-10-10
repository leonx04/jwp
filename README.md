# JWP — Quản lý chi tiêu

App quản lý chi tiêu cá nhân, dữ liệu lưu **trên máy** (SQLite), không cần backend.
Kế hoạch đầy đủ: [docs/PLAN.md](docs/PLAN.md).

## Lệnh hay dùng

```bash
npm start                 # chạy Metro (Expo Go)
npm run check             # typecheck + lint + test — chạy trước khi coi là xong
npm test                  # chỉ chạy test
npm run format            # định dạng code bằng Prettier
npm run db:generate       # sinh migration sau khi sửa src/db/schema.ts
npx expo run:android      # build bản cài riêng (dev build) — cần cho thông báo
```

## Expo Go hay bản dev build?

| | Expo Go | Dev build (`npx expo run:android`) |
|---|---|---|
| Ví, giao dịch, theme, DB | ✅ | ✅ |
| Thông báo nhắc | ❌ — Expo Go Android (SDK 53+) ném lỗi khi nạp `expo-notifications` | ✅ |
| Tên + icon app riêng "JWP" | ❌ | ✅ |

App tự nhận biết đang chạy trong Expo Go và tắt phần thông báo (xem `src/features/notifications/module.ts`), các phần khác vẫn chạy.

## Cấu trúc

```
src/
├── app/          # Chỉ route (Expo Router). Mỗi file = một màn hình, _layout.tsx = bộ điều hướng
├── db/           # schema.ts (Drizzle), client.ts, DatabaseProvider (chạy migration), useLiveData
├── features/     # Mỗi tính năng một thư mục: screens/, components/, hooks/, logic + test
├── lib/          # Hàm thuần dùng chung, có test: money/, encoding/, text/
├── components/ui # Component giao diện dùng chung (AppText, Button, Card, AmountText...)
└── theme/        # buildTheme(sáng/tối/AMOLED, màu chủ đạo), ThemeProvider
drizzle/          # Migration SQL do drizzle-kit sinh — KHÔNG sửa tay
```

## Đổi cấu trúc cơ sở dữ liệu

1. Sửa `src/db/schema.ts`
2. `npm run db:generate` → sinh file mới trong `drizzle/`
3. `npx expo start -c` (xoá cache để Babel nhúng lại file `.sql`)
4. Mở app: migration tự chạy khi khởi động

## Quy ước

- Tiền: số nguyên (đồng). Hiển thị qua `src/lib/money` (`1.500.000 ₫`, `1,5 Tr`).
- Không bao giờ commit dữ liệu cá nhân (`IvyWalletBackup_*`, file sao lưu `JWP_*.json`).
- Ivy Wallet (GPL-3.0) chỉ dùng để tham khảo tính năng, không chép code.
