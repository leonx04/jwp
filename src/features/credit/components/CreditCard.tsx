// Thẻ ví trả sau (SPayLater, MoMo trả sau, thẻ tín dụng): dư nợ, hạn mức đã dùng, kỳ này phải trả,
// kỳ sau ước tính, trả góp chưa tới hạn, nút "Trả bill" (= chuyển tiền từ ví thanh toán vào ví trả sau).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo, type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, Card, IconBadge, type TextColor } from '@/components/ui';
import { db } from '@/db';
import { setAccountArchived } from '@/features/accounts/repository';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { formatDate } from '@/lib/date';
import { toAppIcon } from '@/lib/icons';
import { createStyles, useTheme } from '@/theme';

import type { CreditSummary } from '../queries';
import type { CreditStatus } from '../statement';

const MASK = '••••••';
/** Dùng trên 80% hạn mức → tô màu cảnh báo */
const HIGH_UTILIZATION = 0.8;

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type StatementLine = { icon: IoniconName; tone: TextColor; text: string };

/** Dòng trạng thái kỳ sao kê hiện tại */
export function statementLine(
  status: CreditStatus,
  money: (amount: number) => string,
): StatementLine {
  const current = status.current;
  if (!current) {
    return {
      icon: 'information-circle-outline',
      tone: 'textMuted',
      text: 'Chưa cài ngày chốt sao kê & hạn trả — sửa ví để app tính bill',
    };
  }
  const due = formatDate(current.dueDate, false);
  if (current.overdue) {
    return {
      icon: 'alert-circle',
      tone: 'expense',
      text: `Quá hạn ${-current.daysUntilDue} ngày · còn phải trả ${money(current.dueAmount)} (hạn ${due})`,
    };
  }
  if (current.dueAmount > 0) {
    const days = current.daysUntilDue;
    const when = days === 0 ? 'hạn hôm nay' : days === 1 ? 'hạn ngày mai' : `còn ${days} ngày`;
    return {
      icon: 'calendar-outline',
      tone: days <= 3 ? 'warning' : 'text',
      text: `Kỳ này phải trả ${money(current.dueAmount)} trước ${due} · ${when}`,
    };
  }
  // Kỳ vừa chốt không còn gì phải trả, nhưng đang nợ → khoản nợ đó sẽ vào bill kỳ sau
  const next = status.next;
  if (next && next.estimatedAmount > 0) {
    return {
      icon: 'calendar-outline',
      tone: 'text',
      text: `Chưa tới kỳ chốt · dự kiến phải trả ${money(next.estimatedAmount)} trước ${formatDate(next.dueDate, false)} (bill chốt ${formatDate(next.closeDate, false)})`,
    };
  }
  if (current.statementBalance > 0 || current.paid > 0) {
    return { icon: 'checkmark-circle', tone: 'income', text: 'Đã trả đủ kỳ này' };
  }
  return { icon: 'checkmark-circle-outline', tone: 'textMuted', text: 'Kỳ này không có bill' };
}

type CreditCardProps = {
  summary: CreditSummary;
  /** Bấm vào thẻ (vd mở chi tiết ví). Không truyền → thẻ không bấm được */
  onPress?: () => void;
};

export const CreditCard = memo(function CreditCard({ summary, onPress }: CreditCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const hideBalance = useSettings((s) => s.hideBalance);
  const mask = (text: string) => (hideBalance ? MASK : text);
  const compact = (amount: number) => mask(format.compact(amount));

  const { account, status, installments } = summary;
  const current = status.current;
  const line = statementLine(status, compact);
  const high = (status.utilization ?? 0) > HIGH_UTILIZATION;

  const extras: string[] = [];
  if (status.next && status.next.estimatedAmount > 0) {
    extras.push(
      `Kỳ sau ~${compact(status.next.estimatedAmount)} · hạn ${formatDate(status.next.dueDate, false)}`,
    );
  }

  const payBill = () =>
    router.push({
      pathname: '/transaction/new',
      params: {
        type: 'transfer',
        ...(account.paymentAccountId ? { accountId: account.paymentAccountId } : {}),
        toAccountId: account.id,
        amount: String(current?.dueAmount ?? 0),
        title: `Trả bill ${account.name}`,
      },
    });

  const urgent = !!current && (current.overdue || current.daysUntilDue <= 3);

  const body = (
    <Card style={styles.content}>
      <View style={styles.header}>
        <IconBadge icon={toAppIcon(account.icon, 'card-outline')} color={account.color} size={40} />
        <View style={styles.titles}>
          <AppText variant="heading" numberOfLines={1}>
            {account.name}
          </AppText>
          <AppText
            variant="caption"
            color="textMuted"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {account.creditLimit
              ? `Hạn mức ${compact(account.creditLimit)} · còn ${compact(Math.max(0, status.available ?? 0))}`
              : 'Chưa đặt hạn mức'}
          </AppText>
        </View>
        <View style={styles.owed}>
          <AppText variant="label" color="textMuted">
            Dư nợ
          </AppText>
          <AppText
            variant="heading"
            style={styles.tabular}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {mask(format.money(status.owed))}
          </AppText>
        </View>
      </View>

      {status.utilization != null ? (
        <View style={styles.usage}>
          <ProgressBar
            value={status.utilization}
            color={high ? colors.warning : colors.primary}
            style={{ flex: 1 }}
          />
          <AppText
            variant="label"
            color={high ? 'warning' : 'textMuted'}
            style={[styles.tabular, styles.percent]}
          >
            {Math.round(status.utilization * 100)}%
          </AppText>
        </View>
      ) : null}

      <View style={styles.line}>
        <Ionicons name={line.icon} size={18} color={colors[line.tone]} />
        <AppText variant="bodyMedium" color={line.tone} style={styles.lineText}>
          {line.text}
        </AppText>
      </View>

      {/* Kỳ trả góp / vay sắp tới: coi như khoản phải trả có hạn, giống bill trả sau */}
      {installments
        .filter((plan) => plan.nextDueDate)
        .map((plan) => (
          <View key={plan.scheduleId} style={styles.line}>
            <Ionicons name="calendar-outline" size={18} color={colors.text} />
            <AppText variant="bodyMedium" style={styles.lineText}>
              {plan.title}: phải trả {compact(plan.amount)} trước{' '}
              {formatDate(plan.nextDueDate!, false)}
            </AppText>
          </View>
        ))}

      {extras.length ? (
        <AppText variant="caption" color="textMuted" style={styles.tabular}>
          {extras.join('  ·  ')}
        </AppText>
      ) : null}

      {/* Khoản vay (không hạn mức) đã trả hết → đề nghị lưu trữ ví cho gọn */}
      {status.owed === 0 && !account.creditLimit ? (
        <Button
          size="sm"
          icon="archive-outline"
          variant="secondary"
          title="Đã trả hết · Lưu trữ ví"
          onPress={() => setAccountArchived(db, account.id, true)}
          style={styles.pay}
        />
      ) : null}

      {current && current.dueAmount > 0 ? (
        <Button
          size="sm"
          icon="card-outline"
          variant={urgent ? 'primary' : 'secondary'}
          title={`Trả bill ${compact(current.dueAmount)}`}
          onPress={payBill}
          style={styles.pay}
        />
      ) : null}
    </Card>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ví trả sau ${account.name}`}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
});

const useStyles = createStyles((t) => ({
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  content: {
    gap: t.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  owed: {
    alignItems: 'flex-end',
    maxWidth: '45%',
  },
  usage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  percent: {
    minWidth: 34,
    textAlign: 'right',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
  },
  lineText: {
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  pay: {
    alignSelf: 'flex-start',
  },
}));
