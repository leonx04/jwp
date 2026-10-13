// Thẻ tóm tắt Sổ nợ ở Tổng quan: tổng "tôi nợ" / "nợ tôi" + tối đa 2 khoản gấp nhất. Ẩn khi chưa có khoản nợ nào.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Card, ListRow } from '@/components/ui';
import { useMoneyFormat, useSettings } from '@/features/settings';

import { useDebts } from '../hooks';
import { statusText } from './display';

const URGENT = { overdue: 0, 'due-soon': 1, open: 2, settled: 3, closed: 4 } as const;

export function DebtsCard() {
  const format = useMoneyFormat();
  const hide = useSettings((s) => s.hideBalance);
  const { items, summary } = useDebts();
  const active = items.filter((d) => d.status !== 'closed' && d.status !== 'settled');
  if (!active.length) return null;

  const mask = (text: string) => (hide ? '••••••' : text);
  const top = [...active]
    .sort(
      (a, b) =>
        URGENT[a.status] - URGENT[b.status] ||
        (a.daysToDue ?? 9999) - (b.daysToDue ?? 9999) ||
        b.remaining - a.remaining,
    )
    .slice(0, 2);

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="heading">Sổ nợ</AppText>
        <Pressable onPress={() => router.push('/debts')} hitSlop={8} accessibilityRole="button">
          <AppText variant="label" color="primary">
            Xem tất cả
          </AppText>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color="textMuted">
            Tôi nợ
          </AppText>
          <AppText
            variant="bodyMedium"
            color="expense"
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {mask(format.money(summary.owe))}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color="textMuted">
            Nợ tôi
          </AppText>
          <AppText
            variant="bodyMedium"
            color="income"
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {mask(format.money(summary.owed))}
          </AppText>
        </View>
      </View>
      <View>
        {top.map((d) => (
          <ListRow
            key={d.debt.id}
            icon={d.direction === 'lent' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
            iconColor={d.direction === 'lent' ? '#16A34A' : '#DC2626'}
            title={d.person.name}
            subtitle={`${d.direction === 'lent' ? 'Nợ tôi' : 'Tôi nợ'} · ${statusText(d)}`}
            onPress={() => router.push({ pathname: '/debt/[id]', params: { id: d.debt.id } })}
            right={
              <AppText
                variant="bodyMedium"
                color={d.status === 'overdue' ? 'expense' : 'text'}
                style={{ fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {mask(format.money(d.remaining))}
              </AppText>
            }
          />
        ))}
      </View>
    </Card>
  );
}
