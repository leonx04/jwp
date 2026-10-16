// Thêm / sửa ngân sách: tên, hạn mức tháng, danh mục và ví áp dụng (trống = tất cả).
import { t } from '@/lib/i18n';
import { goBack } from '@/lib/goBack';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Chip, MoneyField, Screen, SelectField, TextField } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import { toAppIcon } from '@/lib/icons';
import type { WeekendRule } from '@/lib/recurrence';

import { parseIdList } from '../compute';
import { deleteBudget, listBudgetRows, saveBudget } from '../repository';

const DEFAULT_CYCLE = 'default';

const WEEKEND_OPTIONS: { value: WeekendRule; label: string }[] = [
  { value: 'none', label: 'Giữ nguyên' },
  { value: 'before', label: 'Lùi về thứ Sáu' },
  { value: 'after', label: 'Dời sang thứ Hai' },
];

/** Dựng trong lúc vẽ (không để ở mức module) để chữ đổi theo ngôn ngữ */
const cycleOptions = () => [
  { id: DEFAULT_CYCLE, label: t('Theo cài đặt chung') },
  ...Array.from({ length: 31 }, (_, i) => ({
    id: String(i + 1),
    label: i === 30 ? t('Ngày 31 (cuối tháng)') : t('Ngày {day} hằng tháng', { day: i + 1 }),
  })),
];

export function BudgetEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id ? listBudgetRows(db).find((b) => b.id === id) : undefined;
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));
  const { data: accounts = [] } = useLiveData(['accounts'], () => listAccounts(db));

  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [categoryIds, setCategoryIds] = useState<string[]>(parseIdList(existing?.categoryIds));
  const [accountIds, setAccountIds] = useState<string[]>(parseIdList(existing?.accountIds));
  const [weekendRule, setWeekendRule] = useState<WeekendRule>(existing?.weekendRule ?? 'none');
  const [startDay, setStartDay] = useState<string>(String(existing?.startDay ?? DEFAULT_CYCLE));

  const save = () => {
    try {
      saveBudget(db, {
        id,
        name,
        amount,
        categoryIds,
        accountIds,
        startDay: startDay === DEFAULT_CYCLE ? null : Number(startDay),
        weekendRule,
      });
      showSnackbar({ text: 'Đã lưu ngân sách', tone: 'success' });
      goBack();
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
          goBack();
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

      <SelectField
        multiple
        label="Danh mục áp dụng"
        title="Chọn danh mục"
        placeholder="Mọi khoản chi"
        icon="pricetag-outline"
        options={categories.map((c) => ({
          id: c.id,
          label: c.name,
          icon: c.icon ? toAppIcon(c.icon, 'pricetag-outline') : null,
          color: c.color,
        }))}
        value={categoryIds}
        onChange={setCategoryIds}
      />
      <AppText variant="caption" color="textMuted">
        Không chọn = tính mọi khoản chi.
      </AppText>

      <SelectField
        multiple
        label="Ví áp dụng"
        title="Chọn ví"
        placeholder="Mọi ví"
        icon="wallet-outline"
        options={accounts.map((a) => ({
          id: a.id,
          label: a.name,
          icon: toAppIcon(a.icon, 'wallet-outline'),
          color: a.color,
        }))}
        value={accountIds}
        onChange={setAccountIds}
      />
      <AppText variant="caption" color="textMuted">
        Không chọn = tính mọi ví.
      </AppText>

      <SelectField
        label="Chu kỳ bắt đầu"
        title="Chu kỳ bắt đầu ngày"
        placeholder="Theo cài đặt chung"
        icon="calendar-outline"
        options={cycleOptions()}
        value={startDay}
        onChange={(value) => setStartDay(value ?? DEFAULT_CYCLE)}
        clearable={false}
      />
      <AppText variant="caption" color="textMuted">
        Chỉ áp dụng cho ngân sách này, ví dụ lương về ngày 5 thì chọn ngày 5 để kỳ chạy từ 5 đến 4
        tháng sau. Ngày 31 = cuối tháng.
      </AppText>
      {startDay !== DEFAULT_CYCLE ? (
        <>
          <AppText variant="label" color="textMuted">
            Nếu rơi vào cuối tuần
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WEEKEND_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={weekendRule === option.value}
                onPress={() => setWeekendRule(option.value)}
              />
            ))}
          </View>
        </>
      ) : null}

      {existing ? (
        <Button title="Xoá ngân sách" variant="danger" icon="trash-outline" onPress={remove} />
      ) : null}
    </Screen>
  );
}
