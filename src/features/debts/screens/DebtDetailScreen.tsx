// Chi tiết một khoản nợ: còn lại, tiến độ trả, lịch sử, thao tác (trả / vay thêm / lãi / sửa / đóng / xoá).
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, EmptyState, IconBadge, ListRow, Screen } from '@/components/ui';
import { db } from '@/db';
import { useMoneyFormat } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { formatDate, toVnDate } from '@/lib/date';
import { useTheme } from '@/theme';

import { DIRECTION_LABEL, recordLabel, repayAction, statusText } from '../components/display';
import { useDebt } from '../hooks';
import { deleteDebt, deleteDebtRecord, setDebtClosed } from '../repository';

const RECORD_ICON = {
  repay: 'checkmark-circle-outline',
  increase: 'add-circle-outline',
  interest: 'trending-up-outline',
} as const;

export function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const format = useMoneyFormat();
  const { colors } = useTheme();
  const { data: item } = useDebt(id);

  if (!item) {
    return (
      <Screen title="Khoản nợ">
        <Card>
          <EmptyState icon="alert-circle-outline" title="Không tìm thấy khoản nợ" />
        </Card>
      </Screen>
    );
  }

  const { debt, person } = item;
  const lent = item.direction === 'lent';
  const tone = lent ? colors.income : colors.expense;
  const ratio = item.total > 0 ? item.repaid / item.total : 0;
  const open = item.status !== 'closed';
  const settled = item.remaining <= 0;

  const record = (type: 'repay' | 'increase' | 'interest') =>
    router.push({ pathname: '/debt/record', params: { debtId: debt.id, type } });

  const confirmDelete = () =>
    Alert.alert(
      'Xoá khoản nợ?',
      'Xoá luôn các lần trả và các giao dịch ví đã sinh ra từ khoản này.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            deleteDebt(db, debt.id);
            showSnackbar({ text: 'Đã xoá khoản nợ', tone: 'success' });
            router.back();
          },
        },
      ],
    );

  const confirmDeleteRecord = (recordId: string) =>
    Alert.alert('Xoá lần ghi này?', 'Giao dịch ví tương ứng (nếu có) cũng bị xoá.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => deleteDebtRecord(db, recordId) },
    ]);

  return (
    <Screen title={person.name}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge
            icon={lent ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
            color={tone}
            size={44}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyMedium">{debt.title || DIRECTION_LABEL[item.direction]}</AppText>
            <AppText variant="caption" color="textMuted">
              {DIRECTION_LABEL[item.direction]} · {formatDate(toVnDate(debt.date))}
            </AppText>
          </View>
        </View>

        <View>
          <AppText variant="label" color="textMuted">
            CÒN LẠI
          </AppText>
          <AppText
            variant="hero"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontVariant: ['tabular-nums'] }}
            minimumFontScale={0.6}
          >
            {format.money(item.remaining)}
          </AppText>
        </View>

        <ProgressBar value={ratio} color={tone} height={8} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="caption" color="textMuted">
            Đã trả {format.money(item.repaid)} / {format.money(item.total)}
          </AppText>
          <AppText variant="caption" color={item.status === 'overdue' ? 'expense' : 'textMuted'}>
            {statusText(item)}
          </AppText>
        </View>
        {item.overpaid > 0 ? (
          <AppText variant="caption" color="warning">
            Đã trả dư {format.money(item.overpaid)} so với số nợ.
          </AppText>
        ) : null}
        {debt.note ? (
          <AppText variant="caption" color="textMuted">
            {debt.note}
          </AppText>
        ) : null}
      </Card>

      {/* Đã trả hết: một nút to để đóng sổ */}
      {open && settled ? (
        <Card style={{ gap: 10 }}>
          <AppText variant="bodyMedium">Khoản này đã trả hết.</AppText>
          <Button
            title="Đóng khoản nợ"
            icon="checkmark-done"
            onPress={() => setDebtClosed(db, debt.id, true)}
          />
        </Card>
      ) : null}

      {open && !settled ? (
        <View style={{ gap: 8 }}>
          <Button
            title={repayAction(item.direction)}
            icon="checkmark"
            onPress={() => record('repay')}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={recordLabel(item.direction, 'increase')}
                variant="secondary"
                size="sm"
                icon="add"
                onPress={() => record('increase')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Tính lãi"
                variant="secondary"
                size="sm"
                icon="trending-up-outline"
                onPress={() => record('interest')}
              />
            </View>
          </View>
        </View>
      ) : null}

      <Card style={{ gap: 0, paddingVertical: 6 }}>
        <AppText variant="label" color="textMuted" style={{ padding: 12 }}>
          LỊCH SỬ
        </AppText>
        {item.records.map((r) => (
          <ListRow
            key={r.id}
            icon={RECORD_ICON[r.type]}
            iconColor={r.type === 'repay' ? colors.income : colors.primary}
            title={recordLabel(item.direction, r.type)}
            subtitle={`${formatDate(toVnDate(r.date))}${r.note ? ` · ${r.note}` : ''}`}
            onPress={() => confirmDeleteRecord(r.id)}
            right={
              <AppText variant="bodyMedium" style={{ fontVariant: ['tabular-nums'] }}>
                {r.type === 'repay' ? '−' : '+'}
                {format.money(r.amount)}
              </AppText>
            }
          />
        ))}
        <ListRow
          icon="flag-outline"
          title="Khoản gốc"
          subtitle={formatDate(toVnDate(debt.date))}
          right={
            <AppText
              variant="bodyMedium"
              style={{ fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {format.money(debt.amount)}
            </AppText>
          }
        />
      </Card>

      <View style={{ gap: 8 }}>
        <Button
          title="Sửa khoản nợ"
          variant="secondary"
          icon="create-outline"
          onPress={() => router.push({ pathname: '/debt/edit', params: { id: debt.id } })}
        />
        {open && settled ? null : (
          <Button
            title={open ? 'Đóng khoản nợ (không theo dõi nữa)' : 'Mở lại khoản nợ'}
            variant="secondary"
            icon={open ? 'archive-outline' : 'refresh-outline'}
            onPress={() => setDebtClosed(db, debt.id, open)}
          />
        )}
        <Button
          title="Xoá khoản nợ"
          variant="danger"
          icon="trash-outline"
          onPress={confirmDelete}
        />
      </View>
    </Screen>
  );
}
