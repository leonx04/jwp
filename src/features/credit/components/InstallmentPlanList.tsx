// Danh sách kế hoạch trả góp của một ví trả sau (màn chi tiết ví).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Card } from '@/components/ui';
import { db } from '@/db';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { formatDate } from '@/lib/date';
import { createStyles, useTheme } from '@/theme';

import type { InstallmentInfo } from '../queries';
import { removeInstallmentPlans } from '../repository';

export function InstallmentPlanList({ installments }: { installments: InstallmentInfo[] }) {
  const styles = useStyles();
  if (!installments.length) return null;
  return (
    <Card style={styles.list}>
      {installments.map((plan, index) => (
        <View key={plan.scheduleId}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <PlanRow plan={plan} />
        </View>
      ))}
    </Card>
  );
}

function PlanRow({ plan }: { plan: InstallmentInfo }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const hideBalance = useSettings((s) => s.hideBalance);
  const mask = (text: string) => (hideBalance ? '••••••' : text);

  const left = Math.max(0, plan.months - plan.dueCount);
  const remaining = plan.amount * left;
  const done = left === 0;

  const remove = () =>
    Alert.alert(
      'Xoá kế hoạch trả góp?',
      'Khoản mua vẫn giữ nguyên. Phần chưa tới hạn sẽ tính hết vào bill kỳ tới.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            removeInstallmentPlans(db, plan.transactionId);
            showSnackbar({ text: 'Đã xoá kế hoạch trả góp', tone: 'success' });
          },
        },
      ],
    );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/transaction/${plan.transactionId}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.titles}>
          <AppText variant="bodyMedium" numberOfLines={1}>
            {plan.title || 'Trả góp'}
          </AppText>
          <AppText variant="caption" color="textMuted" style={styles.tabular}>
            Kỳ {Math.min(plan.dueCount, plan.months)}/{plan.months} · mỗi kỳ{' '}
            {mask(format.compact(plan.amount))}
          </AppText>
        </View>
        <View style={styles.right}>
          <AppText variant="label" color="textMuted">
            {done ? 'Đã xong' : 'Còn lại'}
          </AppText>
          <AppText
            variant="bodyMedium"
            style={styles.tabular}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {done ? '—' : mask(format.money(remaining))}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xoá kế hoạch trả góp ${plan.title}`}
          hitSlop={10}
          onPress={remove}
          style={styles.delete}
        >
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <ProgressBar
        value={plan.months ? Math.min(plan.dueCount, plan.months) / plan.months : 0}
        color={done ? colors.income : colors.primary}
        height={4}
      />
      {plan.nextDueDate && !done ? (
        <AppText variant="caption" color="textMuted">
          Kỳ tới hạn {formatDate(plan.nextDueDate, false)}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  list: {
    gap: 0,
    paddingVertical: t.spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: t.colors.border,
  },
  row: {
    gap: t.spacing.sm,
    paddingVertical: t.spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  delete: {
    padding: 4,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
}));
