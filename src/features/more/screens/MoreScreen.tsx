import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Card, ListRow, Screen, SectionTitle } from '@/components/ui';
import type { IconName } from '@/lib/icons';
import { rgba, useTheme } from '@/theme';

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
        icon: 'git-network-outline',
        title: 'Dòng chảy đồng lương',
        subtitle: 'Lương vào đi đâu: sơ đồ từ thu nhập tới từng khoản chi',
        href: '/flow',
        color: '#0EA5E9',
      },
      {
        icon: 'chatbubble-ellipses-outline',
        title: 'Hỏi app',
        subtitle: 'Hỏi bằng tiếng Việt: tháng này tiêu bao nhiêu, cafe mấy lần…',
        href: '/ask',
        color: '#7C3AED',
      },
      {
        icon: 'speedometer-outline',
        title: 'Xăng xe',
        subtitle: 'Giá xăng mỗi lít, chi phí theo tháng, dự kiến lần đổ tới',
        href: '/fuel',
        color: '#F59E0B',
      },
      {
        icon: 'sparkles-outline',
        title: 'Tổng kết',
        subtitle: 'Kỳ này bạn chi gì nhiều nhất, ngày nào, nơi nào — vuốt từng thẻ',
        href: '/wrapped',
        color: '#DB2777',
      },
      {
        icon: 'gift-outline',
        title: 'Quỹ Tết & thưởng',
        subtitle: 'Thưởng Tết, chi phí Tết và mỗi tháng cần để dành bao nhiêu',
        href: '/tet',
        color: '#EF4444',
      },
      {
        icon: 'trending-up-outline',
        title: 'Mô phỏng tăng lương',
        subtitle: 'Lương tăng thì tiền dư, tiết kiệm và các quỹ thay đổi ra sao',
        href: '/salary',
        color: '#16A34A',
      },
      {
        icon: 'document-text-outline',
        title: 'Báo cáo tháng',
        subtitle: 'Còn lại bao nhiêu, so tháng trước, khoản chi lớn, chia sẻ',
        href: '/report',
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
        icon: 'repeat-outline',
        title: 'Khoản lặp phát hiện được',
        subtitle: 'Tiền nhà, đăng ký, lương… gợi ý tạo lịch nhắc',
        href: '/recurring',
        color: '#0EA5E9',
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
        icon: 'shield-checkmark-outline',
        title: 'Kiểm tra dữ liệu',
        subtitle: 'Tìm giao dịch trùng, ngày sai, số tiền lạ, tag thừa để dọn',
        href: '/data-check',
        color: '#16A34A',
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
        icon: 'code-slash-outline',
        title: 'Cài đặt cá nhân (dán JSON)',
        subtitle: 'Đặt ngân sách theo ngày lương, dọn tag, tuỳ chọn — dán một lần',
        href: '/settings/profile',
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

/** Sáu chức năng dùng nhiều nhất → ô bento lớn ở đầu màn */
const FEATURED: { icon: IconName; title: string; href: Href; color: string }[] = [
  { icon: 'stats-chart', title: 'Thống kê', href: '/stats', color: '#7C3AED' },
  { icon: 'speedometer', title: 'Ngân sách', href: '/budgets', color: '#F59E0B' },
  { icon: 'wallet', title: 'Ví', href: '/accounts', color: '#16A34A' },
  { icon: 'people', title: 'Sổ nợ', href: '/debts', color: '#E11D48' },
  { icon: 'flag', title: 'Quỹ tiết kiệm', href: '/goals', color: '#0EA5E9' },
  { icon: 'document-text', title: 'Báo cáo tháng', href: '/report', color: '#DB2777' },
];

const FEATURED_HREFS = new Set(FEATURED.map((f) => String(f.href)));

export function MoreScreen() {
  const { colors } = useTheme();
  return (
    <Screen tabBar largeTitle title="Thêm">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {FEATURED.map((f) => (
          <Pressable
            key={f.title}
            accessibilityRole="button"
            onPress={() => router.push(f.href)}
            style={({ pressed }) => [
              {
                width: '48%',
                flexGrow: 1,
                minHeight: 104,
                padding: 16,
                borderRadius: 28,
                justifyContent: 'space-between',
                backgroundColor: rgba(f.color, colors.dark ? 0.18 : 0.11),
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: rgba(f.color, colors.dark ? 0.32 : 0.2),
              }}
            >
              <Ionicons name={f.icon} size={22} color={f.color} />
            </View>
            <AppText variant="heading">{f.title}</AppText>
          </Pressable>
        ))}
      </View>
      {SECTIONS.map((section) => (
        <Card key={section.title} style={{ gap: 0, paddingVertical: 8 }}>
          <SectionTitle>{section.title}</SectionTitle>
          {section.items
            .filter((item) => !FEATURED_HREFS.has(String(item.href)))
            .map((item) => (
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
