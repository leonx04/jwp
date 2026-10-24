// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  // Tắt các rule định dạng trùng với Prettier (Prettier lo format, ESLint lo lỗi logic)
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*', 'drizzle/*'],
  },
  // Màu giao diện lấy từ theme (useTheme().colors) để đúng cả sáng / tối / AMOLED và màu chủ đạo;
  // màu dữ liệu mặc định lấy từ SWATCH (src/theme/swatches.ts). Không viết mã màu '#…' trong .tsx.
  {
    files: ['src/**/*.tsx'],
    ignores: [
      '**/*.test.tsx',
      // Bảng màu cho người dùng chọn
      'src/components/ui/Pickers.tsx',
      // Logo ngân hàng nằm trên nền trắng cố định
      'src/components/ui/BankMark.tsx',
      // Logo và màn chờ: màu thương hiệu cố định, trùng màn chờ native (app.json)
      'src/components/brand/**',
      // Widget vẽ bằng view native, không có theme
      'src/features/widget/**',
      // Thẻ "Wrapped" dạng story: chữ trắng cố định trên gradient
      'src/features/wrapped/**',
      // Màn Thêm sẽ được thay khi đổi điều hướng (bước 5 của kế hoạch refactor)
      'src/features/more/screens/MoreScreen.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message:
            "Không viết mã màu cứng: dùng useTheme().colors (màu giao diện) hoặc SWATCH từ '@/theme' (màu dữ liệu).",
        },
      ],
    },
  },
]);
