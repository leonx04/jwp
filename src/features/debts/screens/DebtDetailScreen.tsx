// Chi tiết một khoản nợ: còn lại, tiến độ trả, lịch sử, thao tác (trả / vay thêm / lãi / sửa / đóng / xoá).
import { goBack } from '@/lib/goBack';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, EmptyState, IconBadge, Screen } from '@/components/ui';
import { db } from '@/db';
import { useMoneyFormat } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { formatDate, toVnDate } from '@/lib/date';
import { useTheme } from '@/theme';

import { buildLedger } from '../compute';
import { DIRECTION_LABEL, recordLabel, repayAction, statusText } from '../components/display';
import { LedgerTimeline } from '../components/LedgerTimeline';
import { useDebt } from '../hooks';
import { deleteDebt, setDebtClosed } from '../repository';

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
            goBack();
          },
        },
      ],
    );

  const editRecord = (recordId: string) =>
    router.push({ pathname: '/debt/record', params: { debtId: debt.id, recordId } });

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

      {/* Trả bớt / vay thêm luôn ở tay khi khoản còn mở; vay thêm vẫn bấm được khi đã trả hết */}
      {open ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!settled ? (
              <View style={{ flex: 1 }}>
                <Button
                  title={repayAction(item.direction)}
                  icon="checkmark"
                  onPress={() => record('repay')}
                />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Button
                title={recordLabel(item.direction, 'increase')}
                variant={settled ? 'primary' : 'secondary'}
                icon="add"
                onPress={() => record('increase')}
              />
            </View>
          </View>
          {!settled ? (
            <Button
              title="Tính lãi"
              variant="secondary"
              size="sm"
              icon="trending-up-outline"
              onPress={() => record('interest')}
            />
          ) : null}
        </View>
      ) : null}

      <Card style={{ gap: 12 }}>
        <AppText variant="label" color="textMuted">
          LỊCH SỬ · MỚI NHẤT TRƯỚC
        </AppText>
        <LedgerTimeline
          entries={buildLedger(debt, item.records)}
          direction={item.direction}
          dueDate={debt.dueDate}
          onPressRecord={(r) => editRecord(r.id)}
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
