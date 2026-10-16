// Thêm / sửa mục tiêu tiết kiệm.
import { goBack } from '@/lib/goBack';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import {
  AppText,
  Button,
  Chip,
  ColorPicker,
  MoneyField,
  Screen,
  SectionTitle,
  TextField,
} from '@/components/ui';
import { pickDateTime } from '@/components/ui/pickDateTime';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { addDays, formatDate, toVnDate, todayVn, vnDateToMs, type DateString } from '@/lib/date';
import { toAppIcon } from '@/lib/icons';

import { deleteGoal, listGoalRows, saveGoal } from '../repository';

export function GoalEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id ? listGoalRows(db).find((g) => g.id === id) : undefined;
  const { data: accounts = [] } = useLiveData(['accounts'], () => listAccounts(db));

  const [name, setName] = useState(existing?.name ?? '');
  const [target, setTarget] = useState(existing?.targetAmount ?? 0);
  const [accountId, setAccountId] = useState<string | null>(existing?.accountId ?? null);
  const [saved, setSaved] = useState(existing?.savedAmount ?? 0);
  const [deadline, setDeadline] = useState<DateString | null>(existing?.deadline ?? null);
  const [color, setColor] = useState(existing?.color ?? '#7C3AED');
  const [note, setNote] = useState(existing?.note ?? '');

  const save = () => {
    try {
      saveGoal(db, {
        id,
        name,
        targetAmount: target,
        accountId,
        savedAmount: saved,
        deadline,
        color,
        note,
      });
      showSnackbar({ text: 'Đã lưu mục tiêu', tone: 'success' });
      goBack();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  const remove = () =>
    Alert.alert('Xoá mục tiêu?', 'Ví và giao dịch không bị ảnh hưởng.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => {
          if (id) deleteGoal(db, id);
          goBack();
        },
      },
    ]);

  return (
    <Screen
      title={existing ? 'Sửa mục tiêu' : 'Thêm mục tiêu'}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button
            title="Lưu"
            icon="checkmark"
            disabled={!name.trim() || target <= 0}
            onPress={save}
          />
        </View>
      }
    >
      <TextField
        label="Tên mục tiêu"
        icon="flag-outline"
        value={name}
        onChangeText={setName}
        placeholder="vd: Du lịch Đà Lạt"
      />
      <MoneyField label="Số tiền cần đạt" value={target} onChange={setTarget} />

      <SectionTitle>Ví làm quỹ</SectionTitle>
      <AppText variant="caption" color="textMuted">
        Gắn ví: tiến độ = số dư ví. Không gắn: bạn tự nhập số đã góp.
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip
          label="Không gắn ví"
          selected={accountId === null}
          onPress={() => setAccountId(null)}
        />
        {accounts
          .filter((a) => !a.isCredit)
          .map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              icon={toAppIcon(a.icon, 'wallet-outline')}
              color={a.color}
              selected={accountId === a.id}
              onPress={() => setAccountId(a.id)}
            />
          ))}
      </View>
      {accountId === null ? (
        <MoneyField label="Đã góp được" value={saved} onChange={setSaved} />
      ) : null}

      <SectionTitle>Hạn đạt mục tiêu</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="Không hạn" selected={deadline === null} onPress={() => setDeadline(null)} />
        <Chip label="+3 tháng" onPress={() => setDeadline(addDays(todayVn(), 90))} />
        <Chip label="+6 tháng" onPress={() => setDeadline(addDays(todayVn(), 180))} />
        <Chip
          icon="calendar-outline"
          label={deadline ? formatDate(deadline) : 'Chọn ngày'}
          selected={deadline !== null}
          onPress={async () => {
            const picked = await pickDateTime(
              deadline ? vnDateToMs(deadline) : Date.now() + 90 * 86_400_000,
              'date',
            );
            if (picked) setDeadline(toVnDate(picked));
          }}
        />
      </View>

      <SectionTitle>Màu</SectionTitle>
      <ColorPicker value={color} onChange={setColor} />
      <TextField
        icon="document-text-outline"
        value={note}
        onChangeText={setNote}
        placeholder="Ghi chú"
        multiline
      />

      {existing ? (
        <Button title="Xoá mục tiêu" variant="danger" icon="trash-outline" onPress={remove} />
      ) : null}
    </Screen>
  );
}
