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
  StatGrid,
} from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';

import { statusText } from '../components/display';
import { useDebts } from '../hooks';
import type { DebtItem } from '../queries';

type Filter = 'all' | 'borrowed' | 'lent';

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'borrowed', label: 'Tôi nợ' },
  { value: 'lent', label: 'Nợ tôi' },
] as const;

const ACTIVE = (d: DebtItem) => d.status !== 'closed' && d.status !== 'settled';

export function DebtsScreen() {
  const format = useMoneyFormat();
  const { items, groups, summary, loaded } = useDebts();
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
      <Card>
        <StatGrid
          columns={3}
          items={[
            { label: 'Tôi nợ', value: format.compact(summary.owe) },
            { label: 'Nợ tôi', value: format.compact(summary.owed) },
            {
              label: summary.net >= 0 ? 'Được hoàn' : 'Phải trả',
              value: format.compact(Math.abs(summary.net)),
              hint: summary.overdue ? `${summary.overdue} quá hạn` : undefined,
            },
          ]}
        />
      </Card>

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
              {group.net > 0 ? 'Nợ tôi ' : group.net < 0 ? 'Tôi nợ ' : ''}
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
  return (
    <ListRow
      icon={lent ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
      iconColor={lent ? '#16A34A' : '#DC2626'}
      title={showPerson ? `${item.person.name} · ${label}` : label}
      subtitle={`${lent ? 'Nợ tôi' : 'Tôi nợ'} · ${statusText(item)}`}
      onPress={() => router.push({ pathname: '/debt/[id]', params: { id: item.debt.id } })}
      right={
        <AppText
          variant="bodyMedium"
          color={item.status === 'overdue' ? 'expense' : 'text'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {format.money(item.remaining)}
        </AppText>
      }
    />
  );
}
