// Thêm / sửa khoản nợ. Có thể điền sẵn qua tham số: personName, amount, direction, title.
import { goBack } from '@/lib/goBack';
import { useLocalSearchParams } from 'expo-router';
import { asc } from 'drizzle-orm';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import {
  Button,
  Chip,
  MoneyField,
  Screen,
  SectionTitle,
  SegmentedControl,
  TextField,
} from '@/components/ui';
import { pickDateTime } from '@/components/ui/pickDateTime';
import { db } from '@/db';
import { people, type DebtDirection } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { addDays, formatDate, toVnDate, todayVn, vnDateToMs, type DateString } from '@/lib/date';

import { WalletChips } from '../components/WalletChips';
import { useDebt } from '../hooks';
import { saveDebt } from '../repository';

const DIRECTIONS = [
  { value: 'lent', label: 'Tôi cho vay' },
  { value: 'borrowed', label: 'Tôi đi vay' },
] as const;

type Params = {
  id?: string;
  personName?: string;
  amount?: string;
  direction?: string;
  title?: string;
};

export function DebtEditScreen() {
  const params = useLocalSearchParams<Params>();
  const { data: existing } = useDebt(params.id);
  // Chờ dữ liệu của khoản đang sửa rồi mới dựng form (form giữ state riêng)
  if (params.id && !existing) return <Screen title="Sửa khoản nợ">{null}</Screen>;
  return <Form key={existing?.debt.id ?? 'new'} params={params} existing={existing ?? null} />;
}

function Form({
  params,
  existing,
}: {
  params: Params;
  existing: NonNullable<ReturnType<typeof useDebt>['data']> | null;
}) {
  const { data: knownPeople = [] } = useLiveData(['people'], () =>
    db.select().from(people).orderBy(asc(people.name)).all(),
  );
  const [direction, setDirection] = useState<DebtDirection>(
    existing?.direction ?? (params.direction === 'borrowed' ? 'borrowed' : 'lent'),
  );
  const [name, setName] = useState(existing?.person.name ?? params.personName ?? '');
  const [amount, setAmount] = useState(existing?.debt.amount ?? (Number(params.amount) || 0));
  const [title, setTitle] = useState(existing?.debt.title ?? params.title ?? '');
  const [accountId, setAccountId] = useState<string | null>(existing?.debt.accountId ?? null);
  const [date, setDate] = useState(() => existing?.debt.date ?? Date.now());
  const [dueDate, setDueDate] = useState<DateString | null>(existing?.debt.dueDate ?? null);
  const [note, setNote] = useState(existing?.debt.note ?? '');

  const suggestions = name.trim()
    ? knownPeople.filter(
        (p) => p.name.toLowerCase().includes(name.trim().toLowerCase()) && p.name !== name,
      )
    : knownPeople.slice(0, 8);

  const save = () => {
    try {
      saveDebt(db, {
        id: existing?.debt.id,
        personName: name,
        direction,
        amount,
        title,
        date,
        dueDate,
        note,
        accountId,
      });
      showSnackbar({ text: 'Đã lưu khoản nợ', tone: 'success' });
      goBack();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen
      title={existing ? 'Sửa khoản nợ' : 'Thêm khoản nợ'}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button
            title="Lưu"
            icon="checkmark"
            disabled={!name.trim() || amount <= 0}
            onPress={save}
          />
        </View>
      }
    >
      <SegmentedControl options={DIRECTIONS} value={direction} onChange={setDirection} />
      <TextField
        label={direction === 'lent' ? 'Cho ai vay' : 'Vay của ai'}
        icon="person-outline"
        value={name}
        onChangeText={setName}
        placeholder="Tên người"
      />
      {suggestions.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.map((p) => (
            <Chip key={p.id} label={p.name} icon="person-outline" onPress={() => setName(p.name)} />
          ))}
        </ScrollView>
      ) : null}
      <MoneyField label="Số tiền gốc" value={amount} onChange={setAmount} />
      <TextField
        icon="create-outline"
        value={title}
        onChangeText={setTitle}
        placeholder="Nội dung (vd: Mượn đi sửa xe)"
      />

      <SectionTitle>{direction === 'lent' ? 'Tiền đi ra từ ví' : 'Tiền vay về ví'}</SectionTitle>
      <WalletChips value={accountId} onChange={setAccountId} />

      <SectionTitle>Ngày vay</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip
          icon="calendar-outline"
          label={formatDate(toVnDate(date))}
          onPress={async () => {
            const picked = await pickDateTime(date, 'date');
            if (picked) setDate(picked);
          }}
        />
      </View>

      <SectionTitle>Hạn trả</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="Không hạn" selected={dueDate === null} onPress={() => setDueDate(null)} />
        <Chip label="+1 tháng" onPress={() => setDueDate(addDays(todayVn(), 30))} />
        <Chip
          icon="calendar-outline"
          label={dueDate ? formatDate(dueDate) : 'Chọn ngày'}
          selected={dueDate !== null}
          onPress={async () => {
            const picked = await pickDateTime(
              dueDate ? vnDateToMs(dueDate) : Date.now() + 7 * 86_400_000,
              'date',
            );
            if (picked) setDueDate(toVnDate(picked));
          }}
        />
      </View>

      <TextField
        icon="document-text-outline"
        value={note}
        onChangeText={setNote}
        placeholder="Ghi chú"
        multiline
      />
    </Screen>
  );
}
