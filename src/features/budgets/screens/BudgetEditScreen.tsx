// Thêm / sửa ngân sách: tên, hạn mức tháng, danh mục và ví áp dụng (trống = tất cả).
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import {
  AppText,
  Button,
  Chip,
  MoneyField,
  Screen,
  SectionTitle,
  TextField,
} from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import { toAppIcon } from '@/lib/icons';

import { parseIdList } from '../compute';
import { deleteBudget, listBudgetRows, saveBudget } from '../repository';

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export function BudgetEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id ? listBudgetRows(db).find((b) => b.id === id) : undefined;
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));
  const { data: accounts = [] } = useLiveData(['accounts'], () => listAccounts(db));

  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [categoryIds, setCategoryIds] = useState<string[]>(parseIdList(existing?.categoryIds));
  const [accountIds, setAccountIds] = useState<string[]>(parseIdList(existing?.accountIds));

  const save = () => {
    try {
      saveBudget(db, { id, name, amount, categoryIds, accountIds });
      showSnackbar({ text: 'Đã lưu ngân sách', tone: 'success' });
      router.back();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  const remove = () =>
    Alert.alert('Xoá ngân sách?', 'Giao dịch không bị ảnh hưởng.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => {
          if (id) deleteBudget(db, id);
          router.back();
        },
      },
    ]);

  return (
    <Screen
      title={existing ? 'Sửa ngân sách' : 'Thêm ngân sách'}
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
      <TextField
        label="Tên"
        icon="create-outline"
        value={name}
        onChangeText={setName}
        placeholder="vd: Ăn uống tháng"
      />
      <MoneyField label="Hạn mức mỗi tháng" value={amount} onChange={setAmount} />

      <SectionTitle>Danh mục áp dụng</SectionTitle>
      <AppText variant="caption" color="textMuted">
        Không chọn = tính mọi khoản chi.
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            icon={c.icon ? toAppIcon(c.icon, 'pricetag-outline') : undefined}
            color={c.color}
            selected={categoryIds.includes(c.id)}
            onPress={() => setCategoryIds((l) => toggle(l, c.id))}
          />
        ))}
      </View>

      <SectionTitle>Ví áp dụng</SectionTitle>
      <AppText variant="caption" color="textMuted">
        Không chọn = tính mọi ví.
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            icon={toAppIcon(a.icon, 'wallet-outline')}
            color={a.color}
            selected={accountIds.includes(a.id)}
            onPress={() => setAccountIds((l) => toggle(l, a.id))}
          />
        ))}
      </View>

      {existing ? (
        <Button title="Xoá ngân sách" variant="danger" icon="trash-outline" onPress={remove} />
      ) : null}
    </Screen>
  );
}
