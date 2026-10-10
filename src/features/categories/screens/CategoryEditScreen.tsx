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
  TextField,
} from '@/components/ui';
import { db } from '@/db';
import { DEFAULT_CATEGORY_ICON, type IconName } from '@/lib/icons';

import { deleteCategory, listCategories, saveCategory } from '../repository';

export function CategoryEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id ? listCategories(db).find((c) => c.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? '#F97316');
  const [icon, setIcon] = useState<IconName>((existing?.icon as IconName) ?? DEFAULT_CATEGORY_ICON);

  const save = () => {
    try {
      saveCategory(db, { id, name, color, icon });
      showSnackbar({ text: id ? 'Đã lưu danh mục' : 'Đã thêm danh mục', tone: 'success' });
      router.back();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  const remove = () => {
    if (!id) return;
    Alert.alert('Xoá danh mục?', 'Các giao dịch thuộc danh mục này sẽ thành "Chưa phân loại".', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => {
          deleteCategory(db, id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen
      title={id ? 'Sửa danh mục' : 'Thêm danh mục'}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button title="Lưu" icon="checkmark" disabled={!name.trim()} onPress={save} />
        </View>
      }
    >
      <Card style={{ alignItems: 'center' }}>
        <IconBadge icon={icon} color={color} size={64} />
        <AppText variant="heading">{name.trim() || 'Tên danh mục'}</AppText>
      </Card>
      <TextField
        label="Tên"
        placeholder="vd: Cà phê, Xăng xe"
        value={name}
        onChangeText={setName}
        autoFocus={!id}
      />
      <SectionTitle>Màu</SectionTitle>
      <ColorPicker value={color} onChange={setColor} />
      <SectionTitle>Biểu tượng</SectionTitle>
      <IconPicker value={icon} color={color} onChange={setIcon} />
      {id ? (
        <>
          <Button
            title="Xem giao dịch của danh mục"
            variant="secondary"
            icon="receipt-outline"
            onPress={() =>
              router.navigate({ pathname: '/transactions', params: { categoryId: id } })
            }
          />
          <Button title="Xoá danh mục" variant="danger" icon="trash-outline" onPress={remove} />
        </>
      ) : null}
    </Screen>
  );
}
