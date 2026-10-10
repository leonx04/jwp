import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, EmptyState, ListRow, Screen, TextField } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';

import { ensureTag, listTags } from '../repository';

export function TagsScreen() {
  const { data: tags = [] } = useLiveData(['tags', 'transaction_tags'], () => listTags(db));
  const [name, setName] = useState('');

  const add = () => {
    if (!name.trim()) return;
    try {
      ensureTag(db, name);
      setName('');
      showSnackbar({ text: 'Đã thêm tag', tone: 'success' });
    } catch (error) {
      Alert.alert('Chưa thêm được', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen title="Tag">
      <AppText color="textMuted">
        Tag giúp gom giao dịch theo chủ đề (vd #du-lịch-đà-lạt, #công-ty) bất kể danh mục. Gắn tag
        khi thêm giao dịch, app sẽ tự gợi ý tag hay dùng.
      </AppText>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <TextField
            icon="pricetag-outline"
            placeholder="Tên tag mới"
            value={name}
            onChangeText={setName}
            onSubmitEditing={add}
            returnKeyType="done"
          />
        </View>
        <Button title="Thêm" size="sm" disabled={!name.trim()} onPress={add} />
      </View>
      <Card style={{ gap: 0, paddingVertical: 6 }}>
        {tags.length ? (
          tags.map((t) => (
            <ListRow
              key={t.id}
              icon="pricetag-outline"
              iconColor={t.color ?? undefined}
              title={`#${t.name}`}
              subtitle={`${t.usage} giao dịch`}
              onPress={() => router.push({ pathname: '/tag/edit', params: { id: t.id } })}
            />
          ))
        ) : (
          <EmptyState icon="pricetags-outline" title="Chưa có tag nào" />
        )}
      </Card>
    </Screen>
  );
}
