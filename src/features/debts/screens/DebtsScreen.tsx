// Sổ nợ: tổng "tôi nợ" / "nợ tôi", gom theo người, khoản đã xong cất gọn ở cuối.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ListRow,
  Screen,
  SegmentedControl,
} from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';

import { repayAction, statusText } from '../components/display';
import { useDebtProposals, useDebts } from '../hooks';
import type { DebtItem } from '../queries';

type Filter = 'all' | 'borrowed' | 'lent';

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'borrowed', label: 'Bạn đang nợ' },
  { value: 'lent', label: 'Nợ bạn' },
] as const;

const ACTIVE = (d: DebtItem) => d.status !== 'closed' && d.status !== 'settled';

export function DebtsScreen() {
  const format = useMoneyFormat();
  const { items, groups, summary, loaded } = useDebts();
  const { data: proposals } = useDebtProposals();
  const [filter, setFilter] = useState<Filter>('all');
  const [showDone, setShowDone] = useState(false);

  const visible = (d: DebtItem) => filter === 'all' || d.direction === filter;
  const activeGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((d) => ACTIVE(d) && visible(d)) }))
    .filter((g) => g.items.length > 0);
  const done = items.filter((d) => !ACTIVE(d) && visible(d));
  const add = () => router.push('/debt/edit');

  return (
    <Screen
      title="Sổ nợ"
      headerRight={<IconButton icon="add" accessibilityLabel="Thêm khoản nợ" onPress={add} />}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" color="textMuted">
            Bạn đang nợ
          </AppText>
          <AppText
            variant="heading"
            color="expense"
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {format.money(summary.owe)}
          </AppText>
        </Card>
        <Card style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" color="textMuted">
            Người khác nợ bạn
          </AppText>
          <AppText
            variant="heading"
            color="income"
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {format.money(summary.owed)}
          </AppText>
        </Card>
      </View>
      {summary.owe > 0 && summary.owed > 0 ? (
        <AppText variant="caption" color="textMuted">
          Nếu bù trừ hết: bạn {summary.net >= 0 ? 'được nhận lại ' : 'còn phải trả '}
          {format.money(Math.abs(summary.net))}
          {summary.overdue ? ` · ${summary.overdue} khoản quá hạn` : ''}
        </AppText>
      ) : summary.overdue ? (
        <AppText variant="caption" color="expense">
          {summary.overdue} khoản quá hạn
        </AppText>
      ) : null}

      {proposals?.length ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/debts/suggest')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AppText style={{ flex: 1 }} variant="bodyMedium">
              Tìm thấy {proposals.length} khoản nợ trong giao dịch cũ
            </AppText>
            <AppText variant="label" color="primary">
              Xem ›
            </AppText>
          </Card>
        </Pressable>
      ) : null}

      <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />

      {loaded && activeGroups.length === 0 && done.length === 0 ? (
        <Card>
          <EmptyState
            icon="people-outline"
            title="Chưa có khoản nợ nào"
            description="Ghi lại ai đang nợ bạn, bạn đang nợ ai. Chọn ví để app tự cập nhật số dư khi cho vay, vay và trả."
            action={<Button title="Thêm khoản nợ" icon="add" onPress={add} />}
          />
        </Card>
      ) : null}

      {activeGroups.map((group) => (
        <Card key={group.person.id} style={{ gap: 0, paddingVertical: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12 }}>
            <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
              {group.person.name}
            </AppText>
            <AppText
              variant="bodyMedium"
              color={group.net > 0 ? 'income' : group.net < 0 ? 'expense' : 'textMuted'}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {group.net > 0 ? 'Nợ bạn ' : group.net < 0 ? 'Bạn nợ ' : ''}
              {format.money(Math.abs(group.net))}
            </AppText>
          </View>
          {group.items.map((d) => (
            <DebtRow key={d.debt.id} item={d} />
          ))}
        </Card>
      ))}

      {done.length ? (
        <>
          <Pressable onPress={() => setShowDone((v) => !v)} accessibilityRole="button">
            <AppText variant="label" color="primary">
              {showDone ? 'Ẩn' : 'Hiện'} {done.length} khoản đã xong / đã đóng
            </AppText>
          </Pressable>
          {showDone ? (
            <Card style={{ gap: 0, paddingVertical: 6 }}>
              {done.map((d) => (
                <DebtRow key={d.debt.id} item={d} showPerson />
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function DebtRow({ item, showPerson = false }: { item: DebtItem; showPerson?: boolean }) {
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
        subtitle={`${lent ? 'Họ nợ bạn' : 'Bạn nợ họ'} · ${statusText(item)}`}
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
