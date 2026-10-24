// Chi tiết một người trong Sổ nợ: tổng nợ hai chiều, nút trả bớt / vay thêm cho cả người,
// các khoản đang mở, lịch sử gộp theo tháng (mới nhất trước), khoản đã xong.
import { t } from '@/lib/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { formatDate, formatMonth, toVnDate } from '@/lib/date';
import { useTheme } from '@/theme';

import type { DebtDirection } from '@/db/schema';

import { groupByMonth } from '../compute';
import { DebtRow } from '../components/DebtRow';
import { recordLabel, repayAction } from '../components/display';
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

  // Trả bớt: chia vào các khoản còn nợ của chiều đó. Vay thêm: cộng vào khoản gần nhất chưa đóng
  // (kể cả khoản đã trả hết), chưa có thì mở khoản mới cho người này.
  const repay = (direction: DebtDirection) =>
    router.push({ pathname: '/debt/record', params: { personId: person.id, direction } });
  const more = (direction: DebtDirection) => {
    const target = items
      .filter((d) => d.direction === direction && d.status !== 'closed')
      .sort((a, b) => b.debt.date - a.debt.date)[0];
    if (target) {
      router.push({
        pathname: '/debt/record',
        params: { debtId: target.debt.id, type: 'increase' },
      });
    } else {
      router.push({ pathname: '/debt/edit', params: { personName: person.name, direction } });
    }
  };
  const owing: DebtDirection | null = net < 0 ? 'borrowed' : net > 0 ? 'lent' : null;

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

      {owing ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title={repayAction(owing)} icon="checkmark" onPress={() => repay(owing)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={recordLabel(owing, 'increase')}
              icon="add"
              variant="secondary"
              onPress={() => more(owing)}
            />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              title={recordLabel('borrowed', 'increase')}
              icon="add"
              variant="secondary"
              onPress={() => more('borrowed')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={recordLabel('lent', 'increase')}
              icon="add"
              variant="secondary"
              onPress={() => more('lent')}
            />
          </View>
        </View>
      )}
      <Button title="Thêm khoản nợ" icon="add" variant="ghost" size="sm" onPress={addDebt} />

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
            LỊCH SỬ · MỚI NHẤT TRƯỚC
          </AppText>
          {groupByMonth(history.map((h) => ({ ...h, date: h.record.date }))).map((g) => (
            <View key={g.month}>
              <AppText
                variant="label"
                color="textMuted"
                style={{ paddingHorizontal: 12, paddingTop: 8 }}
              >
                {formatMonth(`${g.month}-01`).toUpperCase()}
              </AppText>
              {g.items.map(({ record, item }) => (
                <ListRow
                  key={record.id}
                  icon={record.type === 'repay' ? 'checkmark-circle-outline' : 'add-circle-outline'}
                  iconColor={record.type === 'repay' ? colors.income : colors.primary}
                  title={recordLabel(item.direction, record.type)}
                  subtitle={[formatDate(toVnDate(record.date)), item.debt.title, record.note]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() =>
                    router.push({
                      pathname: '/debt/record',
                      params: { debtId: item.debt.id, recordId: record.id },
                    })
                  }
                  right={
                    <AppText
                      variant="bodyMedium"
                      style={{
                        fontVariant: ['tabular-nums'],
                        color: record.type === 'repay' ? colors.income : colors.text,
                      }}
                    >
                      {record.type === 'repay' ? '−' : '+'}
                      {format.money(record.amount)}
                    </AppText>
                  }
                />
              ))}
            </View>
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
