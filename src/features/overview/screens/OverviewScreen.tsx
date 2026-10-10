import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AmountText, AppText, Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { totalBalance, useAccountBalances } from '@/features/accounts';
import { createStyles, useTheme } from '@/theme';

export function OverviewScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { data: balances, error } = useAccountBalances();
  const today = format(new Date(), "EEEE, d 'tháng' M", { locale: vi });

  return (
    <Screen safeTop>
      <View>
        <AppText variant="caption" color="textMuted" style={styles.capitalize}>
          {today}
        </AppText>
        <AppText variant="title">Tổng quan</AppText>
      </View>

      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.balanceCard}
      >
        <AppText variant="label" style={{ color: colors.onGradient, opacity: 0.85 }}>
          TỔNG SỐ DƯ
        </AppText>
        <AmountText
          amount={balances ? totalBalance(balances) : 0}
          variant="display"
          color="onGradient"
        />
        <AppText variant="caption" style={{ color: colors.onGradient, opacity: 0.85 }}>
          {balances ? `${balances.length} ví` : 'Đang tải…'}
        </AppText>
      </LinearGradient>

      {error && (
        <AppText color="expense" variant="caption">
          {error.message}
        </AppText>
      )}

      {balances && balances.length > 0 ? (
        <Card>
          {balances.map((account) => (
            <ListRow
              key={account.id}
              icon="wallet-outline"
              iconColor={account.color}
              title={account.name}
              subtitle={account.includeInBalance ? undefined : 'Không tính vào tổng'}
              right={<AmountText amount={account.balance} />}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon="download-outline"
            title="Chưa có dữ liệu"
            description="Giai đoạn 1 sẽ có Import từ Ivy Wallet để đưa 7 ví và 495 giao dịch của bạn vào JWP."
            action={
              <Button
                title="Import từ Ivy Wallet"
                icon="download-outline"
                onPress={() => router.push('/import/ivy')}
              />
            }
          />
        </Card>
      )}
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  capitalize: {
    textTransform: 'capitalize',
  },
  balanceCard: {
    borderRadius: t.radius.xl,
    padding: t.spacing.xl,
    gap: t.spacing.xs,
  },
}));
