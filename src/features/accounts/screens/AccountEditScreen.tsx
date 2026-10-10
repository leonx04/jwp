import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import {
  AppText,
  Button,
  Card,
  ColorPicker,
  IconBadge,
  IconPicker,
  Screen,
  SectionTitle,
  SwitchRow,
  TextField,
} from '@/components/ui';
import { db } from '@/db';
import { DEFAULT_ACCOUNT_ICON, type IconName } from '@/lib/icons';

import {
  accountTransactionCount,
  deleteAccount,
  listAccounts,
  saveAccount,
  setAccountArchived,
} from '../repository';

export function AccountEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id
    ? listAccounts(db, { includeArchived: true }).find((a) => a.id === id)
    : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? '#5B5BD6');
  const [icon, setIcon] = useState<IconName>((existing?.icon as IconName) ?? DEFAULT_ACCOUNT_ICON);
  const [includeInBalance, setIncludeInBalance] = useState(existing?.includeInBalance ?? true);
  const [archived, setArchived] = useState(existing?.archived ?? false);

  const save = () => {
    try {
      const savedId = saveAccount(db, { id, name, color, icon, includeInBalance });
      if (id && archived !== existing?.archived) setAccountArchived(db, savedId, archived);
      showSnackbar({ text: id ? 'Đã lưu ví' : 'Đã thêm ví', tone: 'success' });
      router.back();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  const remove = () => {
    if (!id) return;
    const count = accountTransactionCount(db, id);
    if (count === 0) {
      Alert.alert('Xoá ví?', `Xoá "${existing?.name}".`, [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            deleteAccount(db, id);
            router.dismissTo('/accounts');
          },
        },
      ]);
      return;
    }
    Alert.alert(
      'Ví còn giao dịch',
      `Ví có ${count} giao dịch. Nên lưu trữ để giữ lịch sử, hoặc xoá cả ví và giao dịch (kể cả chuyển khoản liên quan, không hoàn tác được).`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Lưu trữ',
          onPress: () => {
            setAccountArchived(db, id, true);
            router.dismissTo('/accounts');
          },
        },
        {
          text: `Xoá cả ${count} giao dịch`,
          style: 'destructive',
          onPress: () => {
            deleteAccount(db, id, true);
            router.dismissTo('/accounts');
          },
        },
      ],
    );
  };

  return (
    <Screen
      title={id ? 'Sửa ví' : 'Thêm ví'}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button title="Lưu" icon="checkmark" disabled={!name.trim()} onPress={save} />
        </View>
      }
    >
      <Card style={{ alignItems: 'center' }}>
        <IconBadge icon={icon} color={color} size={64} />
        <AppText variant="heading">{name.trim() || 'Tên ví'}</AppText>
      </Card>
      <TextField
        label="Tên ví"
        placeholder="vd: MB bank, Momo, Tiền mặt"
        value={name}
        onChangeText={setName}
        autoFocus={!id}
      />
      <SectionTitle>Màu</SectionTitle>
      <ColorPicker value={color} onChange={setColor} />
      <SectionTitle>Biểu tượng</SectionTitle>
      <IconPicker value={icon} color={color} onChange={setIcon} />
      <Card style={{ gap: 0 }}>
        <SwitchRow
          icon="calculator-outline"
          title="Tính vào tổng số dư"
          subtitle="Tắt cho quỹ tiết kiệm / tiền giữ hộ"
          value={includeInBalance}
          onValueChange={setIncludeInBalance}
        />
        {id ? (
          <SwitchRow
            icon="archive-outline"
            title="Lưu trữ"
            subtitle="Ẩn ví khỏi danh sách, vẫn giữ lịch sử giao dịch"
            value={archived}
            onValueChange={setArchived}
          />
        ) : null}
      </Card>
      {id ? <Button title="Xoá ví" variant="danger" icon="trash-outline" onPress={remove} /> : null}
    </Screen>
  );
}
