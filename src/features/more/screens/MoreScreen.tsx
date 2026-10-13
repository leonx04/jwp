import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';

import { AppText, Card, ListRow, Screen, SectionTitle } from '@/components/ui';
import type { IconName } from '@/lib/icons';

type Item = { icon: IconName; title: string; subtitle: string; href: Href; color?: string };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Phân tích & công cụ',
    items: [
      {
        icon: 'stats-chart-outline',
        title: 'Thống kê',
        subtitle: 'Biểu đồ, xu hướng chi tiêu, so sánh kỳ trước',
        href: '/stats',
        color: '#7C3AED',
      },
      {
        icon: 'scan-outline',
        title: 'Nhập từ ảnh biên lai',
        subtitle: 'Chụp màn hình chuyển khoản, đọc ngay trên máy',
        href: '/receipt-scan',
        color: '#F59E0B',
      },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      {
        icon: 'speedometer-outline',
        title: 'Ngân sách',
        subtitle: 'Hạn mức chi mỗi tháng, cảnh báo sắp hết',
        href: '/budgets',
        color: '#F59E0B',
      },
      {
        icon: 'flag-outline',
        title: 'Quỹ tiết kiệm',
        subtitle: 'Mục tiêu, tiến độ, cần góp mỗi tháng',
        href: '/goals',
        color: '#7C3AED',
      },
      {
        icon: 'people-outline',
        title: 'Sổ nợ',
        subtitle: 'Ai nợ bạn, bạn nợ ai, nhắc hạn trả',
        href: '/debts',
        color: '#E11D48',
      },
      {
        icon: 'wallet-outline',
        title: 'Ví',
        subtitle: 'Thêm, sửa, lưu trữ, điều chỉnh số dư',
        href: '/accounts',
        color: '#16A34A',
      },
      {
        icon: 'pricetags-outline',
        title: 'Danh mục',
        subtitle: 'Màu, biểu tượng, thứ tự',
        href: '/categories',
        color: '#F97316',
      },
      {
        icon: 'pricetag-outline',
        title: 'Tag',
        subtitle: 'Gom giao dịch theo chủ đề',
        href: '/tags',
        color: '#DB2777',
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
        color: '#0EA5E9',
      },
      {
        icon: 'download-outline',
        title: 'Import từ Ivy Wallet',
        subtitle: 'Ví, giao dịch, lịch định kỳ, khoản vay',
        href: '/import/ivy',
        color: '#2563EB',
      },
    ],
  },
  {
    title: 'Cài đặt',
    items: [
      {
        icon: 'color-palette-outline',
        title: 'Giao diện',
        subtitle: 'Sáng / Tối / AMOLED, màu chủ đạo, ký hiệu tiền',
        href: '/settings/appearance',
        color: '#7C3AED',
      },
      {
        icon: 'mail-unread-outline',
        title: 'Tự đọc thông báo ngân hàng',
        subtitle: 'Gợi ý ghi giao dịch từ thông báo / SMS biến động số dư',
        href: '/settings/capture',
        color: '#7C3AED',
      },
      {
        icon: 'notifications-outline',
        title: 'Thông báo',
        subtitle: 'Thử popup, nút hành động, hướng dẫn Huawei',
        href: '/settings/notifications',
        color: '#0D9488',
      },
    ],
  },
];

export function MoreScreen() {
  return (
    <Screen tabBar largeTitle title="Thêm">
      {SECTIONS.map((section) => (
        <Card key={section.title} style={{ gap: 0, paddingVertical: 8 }}>
          <SectionTitle>{section.title}</SectionTitle>
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
