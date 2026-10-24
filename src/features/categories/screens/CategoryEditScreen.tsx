import { goBack } from '@/lib/goBack';
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
import { bankFromIcon } from '@/lib/banks';
import { DEFAULT_CATEGORY_ICON, toAppIcon, type AppIcon } from '@/lib/icons';

import { deleteCategory, listCategories, saveCategory } from '../repository';
import { SWATCH } from '@/theme';

export function CategoryEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id ? listCategories(db).find((c) => c.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? SWATCH.orange);
  // Icon: tên Ionicons hoặc logo ngân hàng / ví ('bank:<CODE>'), lưu dạng chuỗi
  const [icon, setIcon] = useState<AppIcon>(toAppIcon(existing?.icon, DEFAULT_CATEGORY_ICON));

  const pickIcon = (next: AppIcon) => {
    setIcon(next);
    // Chọn logo → lấy luôn màu thương hiệu cho biểu đồ (vẫn đổi lại được)
    const bank = bankFromIcon(next);
    if (bank) setColor(bank.color);
  };

  const save = () => {
    try {
      saveCategory(db, { id, name, color, icon });
      showSnackbar({ text: id ? 'Đã lưu danh mục' : 'Đã thêm danh mục', tone: 'success' });
      goBack();
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
          goBack();
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
      {/* Xem trước trực tiếp: icon / logo + màu + tên */}
      <Card style={{ alignItems: 'center' }}>
        <IconBadge icon={icon} color={color} size={64} />
        <AppText variant="heading">{name.trim() || 'Tên danh mục'}</AppText>
      </Card>
      <TextField
        label="Tên"
        placeholder="vd: Cà phê, Xăng xe, Shopee, Biếu bố mẹ"
        value={name}
        onChangeText={setName}
        autoFocus={!id}
      />
      <IconPicker
        value={icon}
        onChange={pickIcon}
        color={color}
        hint={name}
        title="Biểu tượng hoặc logo"
      />
      <SectionTitle>Màu</SectionTitle>
      <ColorPicker value={color} onChange={setColor} />
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
