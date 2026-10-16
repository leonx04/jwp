// Quy tắc phân loại cho giao dịch tự đọc: "nội dung chứa … → danh mục …", có thể bật tự ghi.
import { t } from '@/lib/i18n';
import { router } from 'expo-router';

import { IconButton } from '@/components/glass/IconButton';
import { AppText, Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listCategories } from '@/features/categories/repository';
import { toAppIcon } from '@/lib/icons';

import { listRules } from '../rulesRepository';

const TYPE_LABEL = { income: 'khoản thu', expense: 'khoản chi' } as const;

export function RulesScreen() {
  const { data: rules } = useLiveData(['capture_rules'], () => listRules(db));
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));
  const add = () => router.push('/capture-rule/edit');

  return (
    <Screen
      title="Quy tắc phân loại"
      headerRight={<IconButton icon="add" accessibilityLabel={t('Thêm quy tắc')} onPress={add} />}
    >
      <AppText color="textMuted">
        Giao dịch tự đọc có nội dung chứa cụm từ của quy tắc sẽ được điền sẵn danh mục. Bật “Tự ghi”
        để ghi luôn, không cần xác nhận. Chưa có quy tắc thì app vẫn đoán theo những lần bạn đã ghi
        trước đó.
      </AppText>

      {rules && rules.length === 0 ? (
        <Card>
          <EmptyState
            icon="funnel-outline"
            title="Chưa có quy tắc nào"
            description="Ví dụ: nội dung chứa “highlands” → Cà phê. Cũng có thể tạo nhanh sau khi ghi một giao dịch từ hộp chờ."
            action={<Button title="Thêm quy tắc" icon="add" onPress={add} />}
          />
        </Card>
      ) : null}

      {rules?.length ? (
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          {rules.map((r) => {
            const category = categories.find((c) => c.id === r.categoryId);
            return (
              <ListRow
                key={r.id}
                icon={toAppIcon(category?.icon ?? null, 'pricetag-outline')}
                title={t('Chứa “{pattern}”', { pattern: r.pattern })}
                subtitle={[
                  `→ ${category?.name ?? 'Danh mục đã xoá'}`,
                  r.type ? t('chỉ {type}', { type: TYPE_LABEL[r.type] }) : null,
                  r.autoAccept ? 'tự ghi' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() =>
                  router.push({ pathname: '/capture-rule/edit', params: { id: r.id } })
                }
              />
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
