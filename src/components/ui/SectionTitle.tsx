import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';

type SectionTitleProps = {
  children: string;
  /** 'section': tiêu đề khu vực (đậm, màu chữ chính) · 'label': nhãn biểu mẫu (nhỏ, màu phụ) */
  tone?: 'section' | 'label';
  /** Nội dung bên phải (vd liên kết "Xem tất cả") */
  right?: ReactNode;
};

/** Tiêu đề nhóm nội dung — viết thường kiểu câu (không VIẾT HOA) cho cảm giác nhẹ nhàng */
export function SectionTitle({ children, tone = 'label', right }: SectionTitleProps) {
  const title =
    tone === 'section' ? (
      <AppText variant="heading" style={{ fontSize: 18, lineHeight: 24 }}>
        {children}
      </AppText>
    ) : (
      <AppText
        variant="bodyMedium"
        color="textMuted"
        style={{ fontSize: 14, lineHeight: 20, marginTop: 2 }}
      >
        {children}
      </AppText>
    );
  if (!right) return title;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {title}
      {right}
    </View>
  );
}
