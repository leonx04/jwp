import { View, type ViewProps } from 'react-native';

import { createStyles } from '@/theme';

export function Card({ style, ...rest }: ViewProps) {
  const styles = useStyles();
  return <View style={[styles.card, style]} {...rest} />;
}

const useStyles = createStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    padding: t.spacing.lg,
    gap: t.spacing.md,
    // Nền tối: dùng viền thay bóng đổ (bóng không thấy trên nền tối)
    borderWidth: t.dark ? 1 : 0,
    borderColor: t.colors.border,
    shadowColor: '#000',
    shadowOpacity: t.dark ? 0 : 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: t.dark ? 0 : 1,
  },
}));
