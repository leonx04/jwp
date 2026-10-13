// Thêm / sửa một quy tắc phân loại. Có thể mở sẵn từ giao dịch vừa ghi (params pattern, categoryId, type).
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import {
  AppText,
  Button,
  Card,
  Chip,
  Screen,
  SectionTitle,
  SwitchRow,
  TextField,
} from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listCategories } from '@/features/categories/repository';
import { toAppIcon } from '@/lib/icons';

import { MIN_PATTERN_LENGTH, patternKey } from '../rules';
import { deleteRule, listRules, saveRule } from '../rulesRepository';

type Params = { id?: string; pattern?: string; categoryId?: string; type?: string };
type RuleType = 'income' | 'expense' | null;

const asType = (value: string | undefined): RuleType =>
  value === 'income' || value === 'expense' ? value : null;

export function RuleEditScreen() {
  const params = useLocalSearchParams<Params>();
  const id = params.id;
  const existing = id ? listRules(db).find((r) => r.id === id) : undefined;
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));

  const [pattern, setPattern] = useState(existing?.pattern ?? params.pattern ?? '');
  const [type, setType] = useState<RuleType>(existing ? existing.type : asType(params.type));
  const [categoryId, setCategoryId] = useState<string | null>(
    existing?.categoryId ?? params.categoryId ?? null,
  );
  const [autoAccept, setAutoAccept] = useState(existing?.autoAccept ?? false);

  const valid = patternKey(pattern).length >= MIN_PATTERN_LENGTH && categoryId !== null;

  const save = () => {
    try {
      saveRule(db, { id, pattern, type, categoryId: categoryId ?? '', autoAccept });
      showSnackbar({ text: 'Đã lưu quy tắc', tone: 'success' });
      router.back();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  const remove = () =>
    Alert.alert('Xoá quy tắc?', 'Giao dịch đã ghi không bị ảnh hưởng.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => {
          if (id) deleteRule(db, id);
          router.back();
        },
      },
    ]);

  return (
    <Screen
      title={existing ? 'Sửa quy tắc' : 'Thêm quy tắc'}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button title="Lưu" icon="checkmark" disabled={!valid} onPress={save} />
        </View>
      }
    >
      <TextField
        label="Nội dung chứa"
        icon="search-outline"
        value={pattern}
        onChangeText={setPattern}
        placeholder="vd: highlands, grab, tên người chuyển"
        autoCapitalize="none"
      />
      <AppText variant="caption" color="textMuted">
        Không phân biệt hoa thường và dấu. Ít nhất {MIN_PATTERN_LENGTH} ký tự; cụm càng cụ thể càng
        chính xác (cụm dài hơn được ưu tiên).
      </AppText>

      <SectionTitle>Áp dụng cho</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="Thu và chi" selected={type === null} onPress={() => setType(null)} />
        <Chip
          label="Chỉ khoản chi"
          selected={type === 'expense'}
          onPress={() => setType('expense')}
        />
        <Chip
          label="Chỉ khoản thu"
          selected={type === 'income'}
          onPress={() => setType('income')}
        />
      </View>

      <SectionTitle>Danh mục</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            icon={c.icon ? toAppIcon(c.icon, 'pricetag-outline') : undefined}
            color={c.color}
            selected={categoryId === c.id}
            onPress={() => setCategoryId(c.id)}
          />
        ))}
      </View>

      <Card style={{ gap: 0, paddingVertical: 6 }}>
        <SwitchRow
          icon="flash-outline"
          title="Tự ghi, không cần xác nhận"
          subtitle="Khớp là ghi luôn vào đúng ví của ngân hàng. Chỉ bật cho khoản bạn chắc chắn."
          value={autoAccept}
          onValueChange={setAutoAccept}
        />
      </Card>

      {existing ? (
        <Button title="Xoá quy tắc" variant="danger" icon="trash-outline" onPress={remove} />
      ) : null}
    </Screen>
  );
}
