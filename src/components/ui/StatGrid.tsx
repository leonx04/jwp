import { View } from 'react-native';

import { createStyles } from '@/theme';

import { AppText } from './AppText';

type Stat = { label: string; value: string | number; hint?: string };

/** Lưới ô số liệu nhỏ (2–3 cột) */
export function StatGrid({ items, columns = 3 }: { items: Stat[]; columns?: 2 | 3 }) {
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={[styles.cell, { width: `${100 / columns}%` }]}>
          <AppText variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
            {item.value}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {item.label}
          </AppText>
          {item.hint ? (
            <AppText variant="label" color="textMuted" numberOfLines={1}>
              {item.hint}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: t.spacing.md,
  },
  cell: {
    paddingRight: t.spacing.sm,
  },
}));
