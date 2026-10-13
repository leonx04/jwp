// Ghi một lần trả nợ / vay thêm / tính lãi cho khoản nợ.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import {
  AppText,
  Button,
  Card,
  Chip,
  MoneyField,
  Screen,
  SectionTitle,
  TextField,
} from '@/components/ui';
import { pickDateTime } from '@/components/ui/pickDateTime';
import { db } from '@/db';
import type { DebtRecordType } from '@/db/schema';
import { formatDate, toVnDate } from '@/lib/date';

import { recordLabel } from '../components/display';
import { WalletChips } from '../components/WalletChips';
import { useDebt } from '../hooks';
import { addDebtRecord } from '../repository';

export function DebtRecordScreen() {
  const { debtId, type: rawType } = useLocalSearchParams<{ debtId: string; type: string }>();
  const type = (
    ['repay', 'increase', 'interest'].includes(rawType) ? rawType : 'repay'
  ) as DebtRecordType;
  const { data: item } = useDebt(debtId);

  const [amount, setAmount] = useState(0);
  const [touched, setTouched] = useState(false);
  const [accountId, setAccountId] = useState<string | null | undefined>(undefined);
  const [date, setDate] = useState(() => Date.now());
  const [note, setNote] = useState('');

  if (!item) return <Screen title="Ghi nợ">{null}</Screen>;

  // Gợi ý: trả nợ thì điền sẵn số còn lại; ví mặc định là ví đã dùng lúc ghi khoản gốc
  const shownAmount = touched ? amount : type === 'repay' ? item.remaining : 0;
  const wallet = accountId === undefined ? item.debt.accountId : accountId;
  const title = recordLabel(item.direction, type);
  const usesWallet = type !== 'interest';

  const save = () => {
    try {
      addDebtRecord(db, {
        debtId: item.debt.id,
        type,
        amount: shownAmount,
        date,
        note,
        accountId: usesWallet ? wallet : null,
      });
      showSnackbar({ text: `Đã ghi: ${title.toLowerCase()}`, tone: 'success' });
      router.back();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen
      title={`${title} · ${item.person.name}`}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button title="Lưu" icon="checkmark" disabled={shownAmount <= 0} onPress={save} />
        </View>
      }
    >
      <MoneyField
        label="Số tiền"
        value={shownAmount}
        onChange={(v) => {
          setTouched(true);
          setAmount(v);
        }}
      />
      {type === 'interest' ? (
        <AppText variant="caption" color="textMuted">
          Tiền lãi được cộng vào số nợ, không động vào ví.
        </AppText>
      ) : (
        <>
          <SectionTitle>Ví</SectionTitle>
          <WalletChips value={wallet ?? null} onChange={setAccountId} />
        </>
      )}
      <SectionTitle>Ngày</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip
          icon="calendar-outline"
          label={formatDate(toVnDate(date))}
          onPress={async () => {
            const picked = await pickDateTime(date, 'date');
            if (picked) setDate(picked);
          }}
        />
        <Chip label="Hôm nay" onPress={() => setDate(Date.now())} />
      </View>
      <TextField
        icon="document-text-outline"
        placeholder="Ghi chú"
        value={note}
        onChangeText={setNote}
      />
      <Card>
        <AppText variant="caption" color="textMuted">
          Còn lại hiện tại: {item.remaining.toLocaleString('vi-VN')} đ
        </AppText>
      </Card>
    </Screen>
  );
}
