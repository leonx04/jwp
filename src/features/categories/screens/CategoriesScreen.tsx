import { router } from 'expo-router';

import { IconButton } from '@/components/glass/IconButton';
import { Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { toAppIcon } from '@/lib/icons';

import { listCategories } from '../repository';

export function CategoriesScreen() {
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));
  return (
    <Screen
      title="Danh mục"
      headerRight={
        <IconButton
          icon="add"
          accessibilityLabel="Thêm danh mục"
          onPress={() => router.push('/category/edit')}
        />
      }
    >
      <Card style={{ gap: 0, paddingVertical: 6 }}>
        {categories.length ? (
          categories.map((c) => (
            <ListRow
              key={c.id}
              icon={toAppIcon(c.icon, 'pricetag-outline')}
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
