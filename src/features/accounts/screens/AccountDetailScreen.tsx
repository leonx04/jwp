import { t } from '@/lib/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import {
  AmountText,
  AppText,
  Card,
  EmptyState,
  IconBadge,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { CreditCard, InstallmentPlanList } from '@/features/credit/components';
import { getCreditSummary } from '@/features/credit/queries';
import { useScheduleOverview } from '@/features/schedules/hooks';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { useTransactions } from '@/features/transactions/hooks';
import { formatDate, todayVn } from '@/lib/date';
import { toAppIcon, type IconName } from '@/lib/icons';
import { createStyles, rgba, useTheme } from '@/theme';

import { getAccountBalance, listAccounts } from '../repository';

export function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const hideBalance = useSettings((s) => s.hideBalance);
  const format = useMoneyFormat();
  // Lịch chi sắp tới (45 ngày) lấy từ ví này — chưa là giao dịch nên chưa tính vào dư nợ
  const { data: overview } = useScheduleOverview(45);
  const { data: account } = useLiveData(
    ['accounts'],
    () => listAccounts(db, { includeArchived: true }).find((a) => a.id === id) ?? null,
    [id],
  );
  const { data: balance = 0 } = useLiveData(['transactions'], () => getAccountBalance(db, id), [
    id,
  ]);
  const { data: recent = [] } = useTransactions({ accountId: id, limit: 30 });
  // Ví trả sau: dư nợ, kỳ sao kê, kế hoạch trả góp
  const { data: credit = null } = useLiveData(
    ['transactions', 'accounts', 'schedules'],
    () => {
      const acc = listAccounts(db, { includeArchived: true }).find((a) => a.id === id);
      return acc?.isCredit ? getCreditSummary(db, acc, todayVn()) : null;
    },
    [id],
  );

  const planned =
    credit && overview
      ? overview.occurrences.filter(
          (o) =>
            o.type === 'expense' &&
            o.schedule.accountId === id &&
            !o.scheduleId.startsWith('credit:') &&
            o.status !== 'paid' &&
            o.status !== 'skipped',
        )
      : [];

  if (account === null) {
    return (
      <Screen title="Ví">
        <Card>
          <EmptyState icon="wallet-outline" title="Ví không còn tồn tại" />
        </Card>
      </Screen>
    );
  }

  const actions: { label: string; icon: IconName; href: Href; tone: string }[] = [
    {
      label: 'Chi',
      icon: 'arrow-up',
      href: `/transaction/new?type=expense&accountId=${id}`,
      tone: colors.expense,
    },
    {
      label: 'Thu',
      icon: 'arrow-down',
      href: `/transaction/new?type=income&accountId=${id}`,
      tone: colors.income,
    },
    {
      label: 'Chuyển',
      icon: 'swap-horizontal',
      href: `/transaction/new?type=transfer&accountId=${id}`,
      tone: colors.primary,
    },
    {
      label: 'Đối chiếu',
      icon: 'options',
      href: `/account/adjust?id=${id}`,
      tone: colors.primary,
    },
  ];

  return (
    <Screen
      title={account?.name ?? ''}
      headerRight={
        <IconButton
          icon="create-outline"
          accessibilityLabel={t('Sửa ví')}
          onPress={() => router.push({ pathname: '/account/edit', params: { id } })}
        />
      }
    >
      {credit ? (
        <CreditCard summary={credit} />
      ) : (
        <Card style={{ alignItems: 'center', gap: 6 }}>
          {account ? (
            <IconBadge
              icon={toAppIcon(account.icon, 'wallet-outline')}
              color={account.color}
              size={52}
            />
          ) : null}
          <AppText variant="label" color="textMuted">
            Số dư
          </AppText>
          {hideBalance ? (
            <AppText variant="display">••••••</AppText>
          ) : (
            <AmountText amount={balance} variant="display" />
          )}
          {account && !account.includeInBalance ? (
            <AppText variant="caption" color="textMuted">
              Không tính vào tổng số dư
            </AppText>
          ) : null}
        </Card>
      )}

      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable key={a.label} onPress={() => router.push(a.href)} style={styles.action}>
            <View
              style={[
                styles.actionIcon,
                {
                  backgroundColor: rgba(a.tone, colors.dark ? 0.24 : 0.14),
                  borderColor: colors.glassBorder,
                },
              ]}
            >
              <Ionicons name={a.icon} size={20} color={a.tone} />
            </View>
            <AppText variant="label" color="textMuted">
              {a.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {credit && credit.installments.length > 0 ? (
        <>
          <SectionTitle tone="section">Trả góp</SectionTitle>
          <InstallmentPlanList installments={credit.installments} />
        </>
      ) : null}

      {planned.length ? (
        <View style={{ gap: 12 }}>
          <SectionTitle tone="section">Khoản theo lịch (đã tính vào dư nợ)</SectionTitle>
          <Card style={{ gap: 10 }}>
            {planned.map((o) => (
              <Pressable
                key={`${o.scheduleId}-${o.dueDate}`}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/schedule/occurrence',
                    params: { scheduleId: o.scheduleId, dueDate: o.dueDate },
                  })
                }
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {o.schedule.title || 'Khoản chi theo lịch'}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {formatDate(o.date, false)}
                  </AppText>
                </View>
                <AppText
                  variant="bodyMedium"
                  color="expense"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {hideBalance ? '••••' : format.money(o.amount)}
                </AppText>
              </Pressable>
            ))}
            <AppText variant="caption" color="textMuted">
              Các khoản này đã cộng vào dư nợ. Bấm vào một khoản rồi chọn “Đã thanh toán” để trả nợ
              (tiền trừ từ ví thanh toán, dư nợ giảm).
            </AppText>
          </Card>
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <SectionTitle tone="section">Giao dịch gần đây</SectionTitle>
        <Pressable
          onPress={() => router.navigate({ pathname: '/transactions', params: { accountId: id } })}
          hitSlop={8}
        >
          <AppText variant="label" color="primary">
            Xem tất cả
          </AppText>
        </Pressable>
      </View>
      <Card style={{ gap: 0, paddingVertical: 6 }}>
        {recent.length ? (
          recent.map((item) => <TransactionRow key={item.id} item={item} />)
        ) : (
          <EmptyState icon="receipt-outline" title="Chưa có giao dịch" />
        )}
      </Card>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  action: {
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -t.spacing.xs,
  },
}));
