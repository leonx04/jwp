// Một dòng khoản nợ trong Sổ nợ và màn chi tiết người: tiêu đề, trạng thái, số còn lại,
// nút trả bớt và vay thêm ngay trên dòng.
import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, ListRow } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { useTheme } from '@/theme';

import type { DebtItem } from '../queries';
import { recordLabel, repayAction, statusText } from './display';

export function DebtRow({ item, showPerson = false }: { item: DebtItem; showPerson?: boolean }) {
  const format = useMoneyFormat();
  const { colors } = useTheme();
  const lent = item.direction === 'lent';
  const label = item.debt.title || (lent ? 'Cho vay' : 'Đi vay');
  const open = item.status !== 'closed';
  const owing = open && item.status !== 'settled';
  const record = (type: 'repay' | 'increase') =>
    router.push({ pathname: '/debt/record', params: { debtId: item.debt.id, type } });
  return (
    <View>
      <ListRow
        icon={lent ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
        iconColor={lent ? colors.income : colors.expense}
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
      {open ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 }}>
          {owing && item.plan?.next ? (
            <Button
              title={t('Trả kỳ {period}', { period: item.plan.next.period })}
              size="sm"
              variant={item.plan.next.status === 'upcoming' ? 'secondary' : 'primary'}
              icon="checkmark"
              onPress={() =>
                router.push({ pathname: '/debt/installment', params: { debtId: item.debt.id } })
              }
            />
          ) : owing ? (
            <Button
              title={repayAction(item.direction)}
              size="sm"
              variant="secondary"
              icon="checkmark"
              onPress={() => record('repay')}
            />
          ) : null}
          <Button
            title={recordLabel(item.direction, 'increase')}
            size="sm"
            variant="secondary"
            icon="add"
            onPress={() => record('increase')}
          />
        </View>
      ) : null}
    </View>
  );
}
