// Một dòng khoản nợ trong Sổ nợ và màn chi tiết người: tiêu đề, trạng thái, số còn lại, nút "đã trả".
import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, ListRow } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';

import type { DebtItem } from '../queries';
import { repayAction, statusText } from './display';

export function DebtRow({ item, showPerson = false }: { item: DebtItem; showPerson?: boolean }) {
  const format = useMoneyFormat();
  const lent = item.direction === 'lent';
  const label = item.debt.title || (lent ? 'Cho vay' : 'Đi vay');
  const active = item.status !== 'closed' && item.status !== 'settled';
  return (
    <View>
      <ListRow
        icon={lent ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
        iconColor={lent ? '#16A34A' : '#DC2626'}
        title={showPerson ? `${item.person.name} · ${label}` : label}
        subtitle={`${t(lent ? 'Họ nợ bạn' : 'Bạn nợ họ')} · ${statusText(item)}`}
        onPress={() => router.push({ pathname: '/debt/[id]', params: { id: item.debt.id } })}
        right={
          <AppText
            variant="bodyMedium"
            color={item.status === 'overdue' ? 'expense' : 'text'}
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {format.money(item.remaining)}
          </AppText>
        }
      />
      {active ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 }}>
          <Button
            title={repayAction(item.direction)}
            size="sm"
            variant="secondary"
            icon="checkmark"
            onPress={() =>
              router.push({
                pathname: '/debt/record',
                params: { debtId: item.debt.id, type: 'repay' },
              })
            }
          />
        </View>
      ) : null}
    </View>
  );
}
