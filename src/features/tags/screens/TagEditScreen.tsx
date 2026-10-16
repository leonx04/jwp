import { goBack } from '@/lib/goBack';
import { t } from '@/lib/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { Button, Screen, SectionTitle, TextField, ColorPicker } from '@/components/ui';
import { db } from '@/db';

import { deleteTag, listTags, saveTag } from '../repository';

export function TagEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = listTags(db).find((t) => t.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? '#5B5BD6');

  const save = () => {
    try {
      saveTag(db, { id, name, color });
      showSnackbar({ text: 'Đã lưu tag', tone: 'success' });
      goBack();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen
      title="Sửa tag"
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button title="Lưu" icon="checkmark" disabled={!name.trim()} onPress={save} />
        </View>
      }
    >
      <TextField label="Tên tag" value={name} onChangeText={setName} />
      <SectionTitle>Màu</SectionTitle>
      <ColorPicker value={color} onChange={setColor} />
      <Button
        title={t('Xem {usage} giao dịch', { usage: existing?.usage ?? 0 })}
        variant="secondary"
        icon="receipt-outline"
        onPress={() => router.navigate({ pathname: '/transactions', params: { tagId: id } })}
      />
      <Button
        title="Xoá tag"
        variant="danger"
        icon="trash-outline"
        onPress={() =>
          Alert.alert('Xoá tag?', 'Giao dịch vẫn giữ nguyên, chỉ bỏ tag này.', [
            { text: 'Huỷ', style: 'cancel' },
            {
              text: 'Xoá',
              style: 'destructive',
              onPress: () => {
                deleteTag(db, id);
                goBack();
              },
            },
          ])
        }
      />
    </Screen>
  );
}
