// Chi tiết một người trong Sổ nợ: tổng nợ hai chiều, các khoản đang mở, lịch sử trả gộp, khoản đã xong.
import { t } from '@/lib/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { formatDate, toVnDate } from '@/lib/date';
import { useTheme } from '@/theme';

import { DebtRow } from '../components/DebtRow';
import { recordLabel } from '../components/display';
import { usePersonDebts } from '../hooks';
import { personRecords, type DebtItem } from '../queries';

const ACTIVE = (d: DebtItem) => d.status !== 'closed' && d.status !== 'settled';

export function DebtPersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const format = useMoneyFormat();
  const { colors } = useTheme();
  const { loaded, group } = usePersonDebts(id);
  const [showDone, setShowDone] = useState(false);

  if (!group) {
    return (
      <Screen title="Sổ nợ">
        {loaded ? (
          <Card>
            <EmptyState icon="alert-circle-outline" title="Không tìm thấy người này" />
          </Card>
        ) : null}
      </Screen>
    );
  }

  const { person, items, owe, owed, net } = group;
  const active = items.filter(ACTIVE);
  const done = items.filter((d) => !ACTIVE(d));
  const history = personRecords(items);
  const netColor = net > 0 ? 'income' : net < 0 ? 'expense' : 'textMuted';
  const addDebt = () =>
    router.push({ pathname: '/debt/edit', params: { personName: person.name } });

  return (
    <Screen title={person.name}>
      <Card style={{ gap: 12 }}>
        <View>
          <AppText variant="label" color="textMuted">
            {net > 0 ? 'HỌ NỢ BẠN' : net < 0 ? 'BẠN NỢ HỌ' : 'ĐÃ CÂN BẰNG'}
          </AppText>
          <AppText
            variant="hero"
            color={netColor}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {format.money(Math.abs(net))}
          </AppText>
        </View>
        {owe > 0 && owed > 0 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="caption" color="textMuted">
              {t('Bạn nợ họ')} {format.money(owe)}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {t('Họ nợ bạn')} {format.money(owed)}
            </AppText>
          </View>
        ) : null}
      </Card>

      <Button title="Thêm khoản nợ" icon="add" variant="secondary" onPress={addDebt} />

      {active.length ? (
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          <AppText variant="label" color="textMuted" style={{ padding: 12 }}>
            ĐANG MỞ
          </AppText>
          {active.map((d) => (
            <DebtRow key={d.debt.id} item={d} />
          ))}
        </Card>
      ) : null}

      {history.length ? (
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          <AppText variant="label" color="textMuted" style={{ padding: 12 }}>
            LỊCH SỬ
          </AppText>
          {history.map(({ record, item }) => (
            <ListRow
              key={record.id}
              icon={record.type === 'repay' ? 'checkmark-circle-outline' : 'add-circle-outline'}
              iconColor={record.type === 'repay' ? colors.income : colors.primary}
              title={recordLabel(item.direction, record.type)}
              subtitle={`${formatDate(toVnDate(record.date))}${record.note ? ` · ${record.note}` : ''}`}
              onPress={() => router.push({ pathname: '/debt/[id]', params: { id: item.debt.id } })}
              right={
                <AppText variant="bodyMedium" style={{ fontVariant: ['tabular-nums'] }}>
                  {record.type === 'repay' ? '−' : '+'}
                  {format.money(record.amount)}
                </AppText>
              }
            />
          ))}
        </Card>
      ) : null}

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
                <DebtRow key={d.debt.id} item={d} />
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
