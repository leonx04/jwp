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
import { useSettings } from '@/features/settings';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { useTransactions } from '@/features/transactions/hooks';
import type { IconName } from '@/lib/icons';
import { createStyles, rgba, useTheme } from '@/theme';

import { getAccountBalance, listAccounts } from '../repository';

export function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const hideBalance = useSettings((s) => s.hideBalance);
  const { data: account } = useLiveData(
    ['accounts'],
    () => listAccounts(db, { includeArchived: true }).find((a) => a.id === id) ?? null,
    [id],
  );
  const { data: balance = 0 } = useLiveData(['transactions'], () => getAccountBalance(db, id), [
    id,
  ]);
  const { data: recent = [] } = useTransactions({ accountId: id, limit: 30 });

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
      label: 'Điều chỉnh',
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
          accessibilityLabel="Sửa ví"
          onPress={() => router.push({ pathname: '/account/edit', params: { id } })}
        />
      }
    >
      <Card style={{ alignItems: 'center', gap: 6 }}>
        {account ? (
          <IconBadge
            icon={(account.icon as IconName) ?? 'wallet-outline'}
            color={account.color}
            size={52}
          />
        ) : null}
        <AppText variant="label" color="textMuted">
          SỐ DƯ
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
