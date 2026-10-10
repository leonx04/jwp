import type { ReactNode } from 'react';
import { View } from 'react-native';

import { createStyles } from '@/theme';

import { AppText } from './AppText';
import { IconBadge, type IconName } from './IconBadge';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <IconBadge icon={icon} size={64} />
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {description ? (
        <AppText color="textMuted" style={styles.center}>
          {description}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.xl,
    paddingHorizontal: t.spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
}));
