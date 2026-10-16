import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import { showSnackbar } from '@/components/feedback/snackbarStore';
import { Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { DEFAULT_CATEGORY_ICON, toAppIcon } from '@/lib/icons';

import { proposeIconChanges } from '../iconSuggest';
import { listCategories, saveCategory } from '../repository';

export function CategoriesScreen() {
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));
  const changes = proposeIconChanges(categories);
  const applyIcons = () =>
    Alert.alert(
      t('Đổi biểu tượng cho {length} danh mục?', { length: changes.length }),
      changes.map((c) => c.name).join(', '),
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Đổi',
          onPress: () => {
            for (const c of changes) {
              const cat = categories.find((x) => x.id === c.id);
              if (cat)
                saveCategory(db, { id: cat.id, name: cat.name, color: cat.color, icon: c.to });
            }
            showSnackbar({
              text: t('Đã đổi biểu tượng {length} danh mục', { length: changes.length }),
              tone: 'success',
            });
          },
        },
      ],
    );

  return (
    <Screen
      title="Danh mục"
      headerRight={
        <IconButton
          icon="add"
          accessibilityLabel={t('Thêm danh mục')}
          onPress={() => router.push('/category/edit')}
        />
      }
    >
      {changes.length ? (
        <View>
          <Button
            title={t('Gợi ý biểu tượng phù hợp ({length})', { length: changes.length })}
            icon="sparkles-outline"
            variant="secondary"
            onPress={applyIcons}
          />
        </View>
      ) : null}
      <Card style={{ gap: 0, paddingVertical: 6 }}>
        {categories.length ? (
          categories.map((c) => (
            <ListRow
              key={c.id}
              // Ionicons hoặc logo ngân hàng ('bank:<CODE>') — IconBadge tự hiển thị đúng loại
              icon={toAppIcon(c.icon, DEFAULT_CATEGORY_ICON)}
              iconColor={c.color}
              title={c.name}
              onPress={() => router.push({ pathname: '/category/edit', params: { id: c.id } })}
            />
          ))
        ) : (
          <EmptyState
            icon="pricetags-outline"
            title="Chưa có danh mục"
            description="Bấm + để thêm."
          />
        )}
      </Card>
    </Screen>
  );
}
