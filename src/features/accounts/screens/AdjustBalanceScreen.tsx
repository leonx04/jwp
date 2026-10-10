import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AmountKeypad, AppText, Button, Card, Chip, Screen } from '@/components/ui';
import { db } from '@/db';
import { useMoneyFormat } from '@/features/settings';

import { adjustBalance, getAccountBalance, listAccounts } from '../repository';

/** Nhập số dư thực tế → app tạo giao dịch "Điều chỉnh số dư" (không tính vào thống kê) */
export function AdjustBalanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const format = useMoneyFormat();
  const account = listAccounts(db, { includeArchived: true }).find((a) => a.id === id);
  const current = getAccountBalance(db, id);
  const [amount, setAmount] = useState(Math.abs(current));
  const [negative, setNegative] = useState(current < 0);
  const target = negative ? -amount : amount;
  const diff = target - current;

  const save = () => {
    adjustBalance(db, id, target);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showSnackbar({ text: diff === 0 ? 'Số dư đã đúng' : 'Đã điều chỉnh số dư', tone: 'success' });
    router.back();
  };

  return (
    <Screen
      title={`Điều chỉnh · ${account?.name ?? ''}`}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
          <AmountKeypad value={amount} onChange={setAmount} />
          <Button title="Cập nhật số dư" icon="checkmark" onPress={save} />
        </View>
      }
    >
      <Card style={{ alignItems: 'center', gap: 4 }}>
        <AppText variant="label" color="textMuted">
          SỐ DƯ THỰC TẾ
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
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Số dương" selected={!negative} onPress={() => setNegative(false)} />
        <Chip label="Số âm (đang nợ thẻ)" selected={negative} onPress={() => setNegative(true)} />
      </View>
      <AppText variant="caption" color="textMuted">
        App sẽ tạo một giao dịch &quot;Điều chỉnh số dư&quot; bằng phần chênh lệch. Giao dịch này
        tính vào số dư nhưng không tính vào thống kê thu chi.
      </AppText>
    </Screen>
  );
}
