import { AppText } from './AppText';

/** Tiêu đề nhỏ phía trên một nhóm nội dung */
export function SectionTitle({ children }: { children: string }) {
  return (
    <AppText variant="label" color="textMuted" style={{ textTransform: 'uppercase', marginTop: 4 }}>
      {children}
    </AppText>
  );
}
