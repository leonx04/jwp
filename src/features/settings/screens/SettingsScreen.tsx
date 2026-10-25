// Cài đặt: mở từ nút bánh răng ở tab Hôm nay. Gom các mục cài đặt và dữ liệu (trước nằm ở tab Thêm).
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';

import { AppText, Card, ListRow, Screen, SectionTitle } from '@/components/ui';
import { AppLockRow } from '@/features/security/AppLockRow';
import type { AppIcon } from '@/lib/icons';
import { SWATCH } from '@/theme';

type Item = { icon: AppIcon; title: string; subtitle: string; href: Href; color: string };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Ứng dụng',
    items: [
      {
        icon: 'color-palette-outline',
        title: 'Giao diện',
        subtitle: 'Sáng / Tối / AMOLED, màu chủ đạo, ký hiệu tiền',
        href: '/settings/appearance',
        color: SWATCH.violet,
      },
      {
        icon: 'notifications-outline',
        title: 'Thông báo',
        subtitle: 'Báo cáo buổi sáng, nhắc hạn, thử thông báo',
        href: '/settings/notifications',
        color: SWATCH.teal,
      },
      {
        icon: 'apps-outline',
        title: 'Widget màn hình chính',
        subtitle: 'Thêm widget Hôm nay được tiêu và Ngân sách ra màn hình chính',
        href: '/settings/widgets',
        color: SWATCH.sky,
      },
      {
        icon: 'mail-unread-outline',
        title: 'Tự đọc thông báo ngân hàng',
        subtitle: 'Gợi ý ghi giao dịch từ thông báo / SMS biến động số dư',
        href: '/settings/capture',
        color: SWATCH.indigo,
      },
    ],
  },
  {
    title: 'Ví, danh mục, tag',
    items: [
      {
        icon: 'wallet-outline',
        title: 'Ví',
        subtitle: 'Thêm, sửa, lưu trữ, điều chỉnh số dư',
        href: '/accounts',
        color: SWATCH.green,
      },
      {
        icon: 'pricetags-outline',
        title: 'Danh mục',
        subtitle: 'Màu, biểu tượng, thứ tự',
        href: '/categories',
        color: SWATCH.orange,
      },
      {
        icon: 'pricetag-outline',
        title: 'Tag',
        subtitle: 'Gom giao dịch theo chủ đề',
        href: '/tags',
        color: SWATCH.pink,
      },
    ],
  },
  {
    title: 'Dữ liệu',
    items: [
      {
        icon: 'save-outline',
        title: 'Sao lưu & xuất dữ liệu',
        subtitle: 'JSON, CSV, khôi phục từ file',
        href: '/backup',
        color: SWATCH.sky,
      },
      {
        icon: 'shield-checkmark-outline',
        title: 'Kiểm tra dữ liệu',
        subtitle: 'Tìm giao dịch trùng, ngày sai, số tiền lạ, tag thừa để dọn',
        href: '/data-check',
        color: SWATCH.green,
      },
      {
        icon: 'scan-outline',
        title: 'Nhập từ ảnh biên lai',
        subtitle: 'Chụp màn hình chuyển khoản, đọc ngay trên máy',
        href: '/receipt-scan',
        color: SWATCH.violet,
      },
      {
        icon: 'download-outline',
        title: 'Import từ Ivy Wallet',
        subtitle: 'Ví, giao dịch, lịch định kỳ, khoản vay',
        href: '/import/ivy',
        color: SWATCH.blue,
      },
      {
        icon: 'code-slash-outline',
        title: 'Cài đặt cá nhân (dán JSON)',
        subtitle: 'Đặt ngân sách theo ngày lương, dọn tag, tuỳ chọn — dán một lần',
        href: '/settings/profile',
        color: SWATCH.gray,
      },
    ],
  },
];

export function SettingsScreen() {
  return (
    <Screen title="Cài đặt">
      {SECTIONS.map((section, index) => (
        <Card key={section.title} style={{ gap: 0, paddingVertical: 8 }}>
          <SectionTitle>{section.title}</SectionTitle>
          {index === 0 ? <AppLockRow /> : null}
          {section.items.map((item) => (
            <ListRow
              key={item.title}
              icon={item.icon}
              iconColor={item.color}
              title={item.title}
              subtitle={item.subtitle}
              onPress={() => router.push(item.href)}
            />
          ))}
        </Card>
      ))}
      <AppText variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
        JWP {Constants.expoConfig?.version ?? ''} · dữ liệu lưu trên máy, không cần internet
      </AppText>
    </Screen>
  );
}
