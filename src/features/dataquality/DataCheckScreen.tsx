// Kiểm tra dữ liệu: liệt kê chỗ cần dọn (ngày sai, nghi trùng, số tiền lạ, chưa phân loại, tag thừa). Bấm vào để sửa.
import { router } from 'expo-router';
import { sql } from 'drizzle-orm';
import { useMemo } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AppText, Button, Card, EmptyState, Screen, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { useMoneyFormat } from '@/features/settings';
import { deleteTag, listTags } from '@/features/tags/repository';
import { formatDate, toVnDate } from '@/lib/date';
import { t } from '@/lib/i18n';
import { createStyles } from '@/theme';

import { findIssues, type CheckTx, type Issue, type IssueKind } from './checks';

const MAX_ROWS = 6;

const COPY: Record<IssueKind, { title: string; hint: string }> = {
  bad_date: {
    title: 'Ngày có vẻ sai',
    hint: 'Trước năm 2015 hoặc ở tương lai. Mở ra để sửa ngày.',
  },
  duplicate: {
    title: 'Nghi nhập trùng',
    hint: 'Cùng ví, số tiền và tên, cách nhau dưới 10 phút. Xoá bớt nếu đúng là trùng.',
  },
  outlier: {
    title: 'Số tiền khác thường',
    hint: 'Lệch rất nhiều so với các lần cùng tên (có thể gõ thừa số 0).',
  },
  uncategorized: {
    title: 'Chưa phân loại',
    hint: 'Gán danh mục để thống kê và ngân sách chính xác hơn.',
  },
  unused_tag: {
    title: 'Tag chưa dùng',
    hint: 'Không gắn với giao dịch nào.',
  },
};

type Row = CheckTx & { tagless?: never };

function loadTxs(): Row[] {
  return db.all<{
    id: string;
    type: CheckTx['type'];
    amount: number;
    date: number;
    title: string;
    accountId: string;
    categoryId: string | null;
  }>(sql`
    select id, type, amount, date, title, account_id as accountId, category_id as categoryId
    from transactions
    where is_adjustment = 0 and debt_id is null and parent_id is null
  `);
}

export function DataCheckScreen() {
  const styles = useStyles();
  const format = useMoneyFormat();
  const { data } = useLiveData(['transactions', 'tags', 'transaction_tags'], () => {
    const txs = loadTxs();
    const tags = listTags(db);
    return { txs, tags, issues: findIssues(txs, tags.map((g) => ({ id: g.id, usage: g.usage })), Date.now()) };
  });

  const byId = useMemo(() => new Map((data?.txs ?? []).map((x) => [x.id, x])), [data]);
  const tagById = useMemo(() => new Map((data?.tags ?? []).map((g) => [g.id, g])), [data]);

  const removeUnusedTags = (ids: string[]) =>
    Alert.alert(
      t('Xoá {n} tag chưa dùng?', { n: ids.length }),
      t('Chỉ xoá tag, không ảnh hưởng giao dịch nào.'),
      [
        { text: t('Huỷ'), style: 'cancel' },
        { text: t('Xoá'), style: 'destructive', onPress: () => ids.forEach((id) => deleteTag(db, id)) },
      ],
    );

  const renderRow = (issue: Issue, id: string) => {
    if (issue.kind === 'unused_tag') {
      return (
        <Pressable key={id} onPress={() => router.push('/tags')} style={styles.row}>
          <AppText style={{ flex: 1 }}>{`#${tagById.get(id)?.name ?? ''}`}</AppText>
        </Pressable>
      );
    }
    const tx = byId.get(id);
    if (!tx) return null;
    return (
      <Pressable key={id} onPress={() => router.push(`/transaction/${id}`)} style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppText numberOfLines={1}>{tx.title || t('(không tiêu đề)')}</AppText>
          <AppText variant="caption" color="textMuted">
            {formatDate(toVnDate(tx.date))}
          </AppText>
        </View>
        <AppText style={styles.amount}>{format.money(tx.amount)}</AppText>
      </Pressable>
    );
  };

  if (!data) return <Screen title="Kiểm tra dữ liệu" scroll>{null}</Screen>;

  return (
    <Screen title="Kiểm tra dữ liệu" scroll>
      {data.issues.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="Dữ liệu gọn gàng"
          description="Không thấy giao dịch trùng, ngày sai hay số tiền lạ."
        />
      ) : (
        <>
          <AppText color="textMuted">
            {t('Tìm thấy {n} nhóm cần xem. Bấm vào từng dòng để mở và sửa.', { n: data.issues.length })}
          </AppText>
          {data.issues.map((issue, index) => {
            const copy = COPY[issue.kind];
            const shown = issue.ids.slice(0, MAX_ROWS);
            return (
              <Card key={`${issue.kind}-${index}`}>
                <SectionTitle tone="section">{`${t(copy.title)} · ${issue.ids.length}`}</SectionTitle>
                <AppText variant="caption" color="textMuted">
                  {t(copy.hint)}
                </AppText>
                {shown.map((id) => renderRow(issue, id))}
                {issue.ids.length > shown.length ? (
                  <AppText variant="caption" color="textMuted">
                    {t('…và {n} mục nữa', { n: issue.ids.length - shown.length })}
                  </AppText>
                ) : null}
                {issue.kind === 'unused_tag' ? (
                  <Button
                    title={t('Xoá {n} tag chưa dùng', { n: issue.ids.length })}
                    variant="secondary"
                    size="sm"
                    icon="trash-outline"
                    onPress={() => removeUnusedTags(issue.ids)}
                  />
                ) : null}
                {issue.kind === 'uncategorized' ? (
                  <Button
                    title="Xem các giao dịch này"
                    variant="secondary"
                    size="sm"
                    icon="list-outline"
                    onPress={() => router.push('/transactions')}
                  />
                ) : null}
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const useStyles = createStyles((th) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md, paddingVertical: 8 },
  amount: { fontVariant: ['tabular-nums'] },
}));
