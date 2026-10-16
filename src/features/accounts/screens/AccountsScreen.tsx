import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import {
  AmountText,
  AppText,
  BankMark,
  Button,
  Card,
  EmptyState,
  ListRow,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { showSnackbar } from '@/components/feedback/snackbarStore';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { useSettings } from '@/features/settings';
import { toAppIcon } from '@/lib/icons';
import { moveItem } from '@/lib/list/move';

import { totalBalance, useAccountBalances } from '../index';
import { applyBankLogos, bankLogoCandidates, listAccounts, reorderAccounts } from '../repository';

export function AccountsScreen() {
  const { data: balances = [] } = useAccountBalances();
  const { data: archived = [] } = useLiveData(['accounts'], () =>
    listAccounts(db, { includeArchived: true }).filter((a) => a.archived),
  );
  const hideBalance = useSettings((s) => s.hideBalance);
  const logoCandidates = bankLogoCandidates(balances);
  const [sorting, setSorting] = useState(false);

  const move = (index: number, direction: -1 | 1) =>
    reorderAccounts(
      db,
      moveItem(
        balances.map((b) => b.id),
        index,
        direction,
      ),
    );

  const applyLogos = () => {
    const changed = applyBankLogos(
      db,
      logoCandidates.map((c) => c.account.id),
    );
    showSnackbar({ text: t('Đã gắn logo cho {changed} ví', { changed }), tone: 'success' });
  };

  return (
    <Screen
      title="Ví"
      headerRight={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {balances.length > 1 ? (
            <IconButton
              icon={sorting ? 'checkmark' : 'swap-vertical'}
              accessibilityLabel={sorting ? 'Xong sắp xếp' : 'Sắp xếp thứ tự ví'}
              onPress={() => setSorting((v) => !v)}
            />
          ) : null}
          <IconButton
            icon="add"
            accessibilityLabel="Thêm ví"
            onPress={() => router.push('/account/edit')}
          />
        </View>
      }
    >
      <Card style={{ alignItems: 'center', gap: 2 }}>
        <AppText variant="label" color="textMuted">
          TỔNG SỐ DƯ
        </AppText>
        {hideBalance ? (
          <AppText variant="display">••••••</AppText>
        ) : (
          <AmountText amount={totalBalance(balances)} variant="display" />
        )}
        <AppText variant="caption" color="textMuted">
          {balances.length} ví đang dùng
        </AppText>
      </Card>

      {logoCandidates.length ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flexDirection: 'row' }}>
            {logoCandidates.slice(0, 3).map(({ bank }, index) => (
              <View key={bank.code} style={{ marginLeft: index ? -12 : 0 }}>
                <BankMark bank={bank} size={34} />
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyMedium">Gắn logo ngân hàng</AppText>
            <AppText variant="caption" color="textMuted" numberOfLines={2}>
              {logoCandidates.map((c) => c.account.name).join(', ')}
            </AppText>
          </View>
          <Button title="Áp dụng" size="sm" onPress={applyLogos} />
        </Card>
      ) : null}

      {balances.length ? (
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          {sorting ? (
            <AppText variant="caption" color="textMuted" style={{ padding: 12 }}>
              Bấm mũi tên để đưa ví lên / xuống. Thứ tự này dùng ở mọi màn chọn ví.
            </AppText>
          ) : null}
          {balances.map((a, index) => (
            <ListRow
              key={a.id}
              icon={toAppIcon(a.icon, 'wallet-outline')}
              iconColor={a.color}
              title={a.name}
              subtitle={a.includeInBalance ? undefined : 'Không tính vào tổng'}
              right={
                sorting ? (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <IconButton
                      icon="chevron-up"
                      size={34}
                      accessibilityLabel={t('Đưa {name} lên', { name: a.name })}
                      disabled={index === 0}
                      onPress={() => move(index, -1)}
                    />
                    <IconButton
                      icon="chevron-down"
                      size={34}
                      accessibilityLabel={t('Đưa {name} xuống', { name: a.name })}
                      disabled={index === balances.length - 1}
                      onPress={() => move(index, 1)}
                    />
                  </View>
                ) : hideBalance ? (
                  <AppText color="textMuted">••••</AppText>
                ) : (
                  <AmountText amount={a.balance} />
                )
              }
              onPress={sorting ? undefined : () => router.push(`/account/${a.id}`)}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon="wallet-outline"
            title="Chưa có ví nào"
            description="Bấm + để thêm ví đầu tiên."
          />
        </Card>
      )}

      {archived.length ? (
        <View style={{ gap: 12 }}>
          <SectionTitle tone="section">Đã lưu trữ</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: 6 }}>
            {archived.map((a) => (
              <ListRow
                key={a.id}
                icon={toAppIcon(a.icon, 'wallet-outline')}
                iconColor={a.color}
                title={a.name}
                subtitle="Ẩn khỏi danh sách và tổng số dư"
                onPress={() => router.push({ pathname: '/account/edit', params: { id: a.id } })}
              />
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
