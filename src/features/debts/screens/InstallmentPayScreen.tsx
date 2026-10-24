// Trả một kỳ của khoản nợ có lãi theo kỳ: điền sẵn gốc + lãi của kỳ kế tiếp, sửa được nếu
// số thật khác (ngân hàng làm tròn khác, trả lệch). Gốc trừ dư nợ; lãi + phí ghi thành khoản chi
// "Lãi & phí vay" (cho vay thì thành khoản thu "Lãi cho vay").
import { goBack } from '@/lib/goBack';
import { t } from '@/lib/i18n';
import { useLocalSearchParams } from 'expo-router';
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
import { useMoneyFormat } from '@/features/settings';
import { formatDate, toVnDate } from '@/lib/date';

import { WalletChips } from '../components/WalletChips';
import { useDebt } from '../hooks';
import type { DebtItem } from '../queries';
import { payInstallment } from '../repository';

export function InstallmentPayScreen() {
  const { debtId } = useLocalSearchParams<{ debtId: string }>();
  const { data: item } = useDebt(debtId);
  const next = item?.plan?.next;
  if (!item || !next) {
    return (
      <Screen title="Trả kỳ">
        {item ? (
          <Card>
            <AppText>Khoản này không còn kỳ nào phải trả.</AppText>
          </Card>
        ) : null}
      </Screen>
    );
  }
  return <PayForm key={`${item.debt.id}:${next.period}`} item={item} />;
}

function PayForm({ item }: { item: DebtItem }) {
  const format = useMoneyFormat();
  const plan = item.plan!;
  const next = plan.next!;
  const [principal, setPrincipal] = useState(next.principal);
  const [interest, setInterest] = useState(next.interest + next.fee);
  const [accountId, setAccountId] = useState<string | null>(item.debt.accountId);
  const [date, setDate] = useState(() => Date.now());
  const [note, setNote] = useState('');
  const lent = item.direction === 'lent';

  const save = () => {
    try {
      payInstallment(db, {
        debtId: item.debt.id,
        period: next.period,
        principal,
        interest,
        date,
        accountId,
        note,
      });
      showSnackbar({
        text: t('Đã ghi trả kỳ {period}', { period: next.period }),
        tone: 'success',
      });
      goBack();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen
      title={t('Kỳ {period}/{months} · {name}', {
        period: next.period,
        months: plan.months,
        name: item.debt.title || item.person.name,
      })}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button
            title={lent ? 'Đã nhận kỳ này' : 'Đã trả kỳ này'}
            icon="checkmark"
            disabled={principal + interest <= 0}
            onPress={save}
          />
        </View>
      }
    >
      <Card style={{ gap: 6 }}>
        <AppText variant="label" color="textMuted">
          {next.date ? t('HẠN {date}', { date: formatDate(next.date) }) : 'KỲ NÀY'}
        </AppText>
        <AppText variant="display" style={{ fontVariant: ['tabular-nums'] }}>
          {format.money(principal + interest)}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {t('Còn nợ sau kỳ này: {amount}', {
            amount: format.money(Math.max(0, item.remaining - principal)),
          })}
        </AppText>
      </Card>

      <MoneyField label="Tiền gốc" value={principal} onChange={setPrincipal} />
      <MoneyField label="Tiền lãi + phí" value={interest} onChange={setInterest} />
      <AppText variant="caption" color="textMuted">
        {lent
          ? 'Gốc trừ vào số họ còn nợ; lãi ghi thành khoản thu "Lãi cho vay".'
          : 'Gốc trừ vào dư nợ (không tính là chi tiêu); lãi + phí ghi thành khoản chi "Lãi & phí vay".'}
      </AppText>

      <SectionTitle>{lent ? 'Nhận vào ví' : 'Trả từ ví'}</SectionTitle>
      <WalletChips value={accountId} onChange={setAccountId} />

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
    </Screen>
  );
}
