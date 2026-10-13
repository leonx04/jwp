import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AmountKeypad, AppText, Button, Card, Chip, ListRow, Screen } from '@/components/ui';
import { db } from '@/db';
import {
  getLastReconciled,
  listRecentForReconcile,
  markReconciled,
  reconcileHints,
} from '@/features/reconcile';
import { useMoneyFormat } from '@/features/settings';
import { formatDate, toVnDate } from '@/lib/date';

import { adjustBalance, getAccountBalance, listAccounts } from '../repository';

const HINT_ICON = {
  duplicate: 'copy-outline',
  'wrong-type': 'swap-vertical-outline',
  'wrong-wallet': 'wallet-outline',
  fee: 'receipt-outline',
  missing: 'help-circle-outline',
} as const;

/**
 * Đối chiếu số dư: nhập số dư thật trên app ngân hàng → app chỉ ra chênh lệch, đoán nguyên nhân
 * (ghi trùng, nhầm ví, nhầm thu/chi, phí) rồi cho sửa hoặc tạo "Điều chỉnh số dư" (không tính vào thống kê).
 */
export function AdjustBalanceScreen() {
  const { id, actual } = useLocalSearchParams<{ id: string; actual?: string }>();
  const format = useMoneyFormat();
  const accounts = listAccounts(db, { includeArchived: true });
  const account = accounts.find((a) => a.id === id);
  const current = getAccountBalance(db, id);
  // Có thể mở sẵn với số dư theo ngân hàng (vd lấy từ thông báo biến động số dư)
  const preset = actual != null && Number.isFinite(Number(actual)) ? Number(actual) : null;
  const [amount, setAmount] = useState(Math.abs(preset ?? current));
  const [negative, setNegative] = useState((preset ?? current) < 0);
  const target = negative ? -amount : amount;
  const diff = target - current;
  const last = getLastReconciled(id);

  const hints = useMemo(
    () =>
      reconcileHints({
        diff,
        accountId: id,
        txs: listRecentForReconcile(db),
        accountNames: new Map(accounts.map((a) => [a.id, a.name])),
        money: (n) => format.money(n),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diff, id],
  );

  const save = () => {
    adjustBalance(db, id, target);
    markReconciled(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showSnackbar({ text: diff === 0 ? 'Số dư đã đúng' : 'Đã điều chỉnh số dư', tone: 'success' });
    router.back();
  };

  const addMissing = () =>
    router.push({
      pathname: '/transaction/new',
      params: {
        type: diff > 0 ? 'income' : 'expense',
        amount: String(Math.abs(diff)),
        accountId: id,
        title: 'Chưa ghi (đối chiếu)',
      },
    });

  return (
    <Screen
      title={`Đối chiếu · ${account?.name ?? ''}`}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
          <AmountKeypad value={amount} onChange={setAmount} />
          <Button
            title={diff === 0 ? 'Đã khớp' : 'Điều chỉnh số dư'}
            icon="checkmark"
            onPress={save}
          />
        </View>
      }
    >
      <Card style={{ alignItems: 'center', gap: 4 }}>
        <AppText variant="label" color="textMuted">
          SỐ DƯ THỰC TẾ (THEO NGÂN HÀNG)
        </AppText>
        <AppText
          variant="hero"
          color={negative ? 'expense' : 'text'}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {format.money(target)}
        </AppText>
        <AppText variant="caption" color="textMuted">
          Trong app: {format.money(current)}
          {diff !== 0 ? ` · chênh ${diff > 0 ? '+' : ''}${format.money(diff)}` : ' · đang khớp'}
        </AppText>
        {last ? (
          <AppText variant="caption" color="textMuted">
            Đối chiếu lần cuối: {formatDate(toVnDate(last))}
          </AppText>
        ) : null}
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Số dương" selected={!negative} onPress={() => setNegative(false)} />
        <Chip label="Số âm (đang nợ thẻ)" selected={negative} onPress={() => setNegative(true)} />
      </View>

      {diff !== 0 ? (
        <>
          <Card style={{ gap: 0, paddingVertical: 6 }}>
            <AppText variant="label" color="textMuted" style={{ padding: 12 }}>
              NGUYÊN NHÂN CÓ THỂ
            </AppText>
            {hints.map((h) => (
              <ListRow
                key={`${h.kind}-${h.txId ?? h.text}`}
                icon={HINT_ICON[h.kind]}
                title={h.text}
                onPress={
                  h.txId
                    ? () => router.push({ pathname: '/transaction/[id]', params: { id: h.txId! } })
                    : undefined
                }
              />
            ))}
          </Card>
          <Button
            title={diff > 0 ? 'Ghi khoản thu còn thiếu' : 'Ghi khoản chi còn thiếu'}
            variant="secondary"
            icon="add-circle-outline"
            onPress={addMissing}
          />
        </>
      ) : null}
      <AppText variant="caption" color="textMuted">
        “Điều chỉnh số dư” tạo một giao dịch bằng phần chênh lệch, có tính vào số dư nhưng không
        tính vào thống kê thu chi. Nên tìm ra khoản thiếu thật trước khi điều chỉnh.
      </AppText>
    </Screen>
  );
}
