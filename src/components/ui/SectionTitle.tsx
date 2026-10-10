import { AppText } from './AppText';

/** Tiêu đề nhỏ phía trên một nhóm nội dung */
export function SectionTitle({ children }: { children: string }) {
  return (
    <AppText variant="label" color="textMuted" style={{ marginTop: 4 }}>
      {/* Viết hoa bằng JS: textTransform trên Android lỗi với chuỗi ngắn có dấu ("Ví" → "ví") */}
      {children.toUpperCase()}
    </AppText>
  );
}
