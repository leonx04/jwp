// Gõ một câu ("cafe 35k hôm qua momo") → xem trước giao dịch → lưu. Dùng bàn phím giọng nói của máy để nói.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import { useMoneyFormat } from '@/features/settings';
import { ensureTag } from '@/features/tags/repository';
import { listTags } from '@/features/tags/repository';
import { listTransactions } from '@/features/transactions/queries';
import { saveTransaction, TransactionValidationError } from '@/features/transactions/repository';
import { toVnDate } from '@/lib/date';
import { goBack } from '@/lib/goBack';
import * as Haptics from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { createStyles } from '@/theme';

import { parseQuickEntry } from '../parse';

const EXAMPLES = ['cafe 35k hôm qua momo', 'nhận lương 15tr', 'chuyển 500k vcb sang momo'];

export function QuickAddScreen() {
  const styles = useStyles();
  const format = useMoneyFormat();
  const [text, setText] = useState('');

  const { data: accounts = [] } = useLiveData(['accounts'], () => listAccounts(db));
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));
  const { data: tags = [] } = useLiveData(['tags'], () => listTags(db));
  const { data: recent = [] } = useLiveData(['transactions'], () =>
    listTransactions(db, { limit: 300 }),
  );

  const entry = useMemo(() => {
    if (!text.trim()) return null;
    return parseQuickEntry(text, {
      now: Date.now(),
      accounts,
      categories,
      tags,
      history: recent
        .filter((r) => r.type !== 'transfer')
        .map((r) => ({ title: r.title, categoryId: r.categoryId })),
      defaultAccountId: recent[0]?.accountId ?? accounts[0]?.id ?? null,
    });
  }, [text, accounts, categories, tags, recent]);

  const nameOf = <T extends { id: string; name: string }>(list: T[], id: string | null) =>
    list.find((x) => x.id === id)?.name ?? null;

  const canSave = !!entry && !!entry.amount && !!entry.accountId && (entry.type !== 'transfer' || !!entry.toAccountId);

  const save = () => {
    if (!entry || !canSave) return;
    try {
      const tagIds = [...entry.tagIds, ...entry.newTagNames.map((name) => ensureTag(db, name))];
      saveTransaction(db, {
        type: entry.type,
        amount: entry.amount!,
        accountId: entry.accountId!,
        toAccountId: entry.toAccountId,
        categoryId: entry.categoryId,
        title: entry.title,
        date: entry.date,
        tagIds,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSnackbar({ text: t('Đã lưu {amount}', { amount: format.money(entry.amount!) }), tone: 'success' });
      goBack();
    } catch (e) {
      showSnackbar({
        text: e instanceof TransactionValidationError ? e.message : t('Không lưu được.'),
        tone: 'error',
      });
    }
  };

  const editDetails = () => {
    if (!entry) return;
    router.replace({
      pathname: '/transaction/new',
      params: {
        type: entry.type,
        amount: String(entry.amount ?? 0),
        title: entry.title,
        ...(entry.accountId ? { accountId: entry.accountId } : {}),
        ...(entry.toAccountId ? { toAccountId: entry.toAccountId } : {}),
        ...(entry.categoryId ? { categoryId: entry.categoryId } : {}),
        date: String(entry.date),
      },
    });
  };

  const typeLabel = entry?.type === 'income' ? 'Thu' : entry?.type === 'transfer' ? 'Chuyển tiền' : 'Chi';

  const rows: [string, string | null][] = entry
    ? [
        ['Ví', nameOf(accounts, entry.accountId)],
        ...(entry.type === 'transfer'
          ? ([['Ví nhận', nameOf(accounts, entry.toAccountId)]] as [string, string | null][])
          : ([['Danh mục', nameOf(categories, entry.categoryId)]] as [string, string | null][])),
        ['Ngày', toVnDate(entry.date).split('-').reverse().join('/')],
        [
          'Tag',
          [
            ...entry.tagIds.map((id) => nameOf(tags, id)),
            ...entry.newTagNames.map((n) => `${n} (${t('mới')})`),
          ]
            .filter(Boolean)
            .join(', ') || null,
        ],
      ]
    : [];

  return (
    <Screen title="Gõ nhanh" scroll>
      <TextField
        icon="create-outline"
        placeholder="vd: cafe 35k hôm qua momo"
        value={text}
        onChangeText={setText}
        autoFocus
        multiline
        returnKeyType="done"
      />
      {!entry ? (
        <Card>
          <AppText variant="label" color="textMuted">
            Thử gõ hoặc nói:
          </AppText>
          {EXAMPLES.map((ex) => (
            <AppText key={ex} onPress={() => setText(ex)} color="primary">
              {ex}
            </AppText>
          ))}
          <AppText variant="caption" color="textMuted">
            Số tiền: 35k, 1tr2, 15tr. Ngày: hôm qua, thứ 6, ngày 5, 03/10. Thêm #tag nếu muốn.
          </AppText>
        </Card>
      ) : (
        <Card>
          <View style={styles.head}>
            <AppText variant="label" color="textMuted">
              {typeLabel}
            </AppText>
            <AppText variant="title" color={entry.type === 'income' ? 'income' : entry.type === 'expense' ? 'expense' : 'text'}>
              {entry.amount ? format.money(entry.amount) : t('Chưa thấy số tiền')}
            </AppText>
            {entry.assumedThousand ? (
              <AppText variant="caption" color="textMuted">
                Số không có đơn vị được hiểu là nghìn đồng
              </AppText>
            ) : null}
          </View>
          <AppText variant="body">{entry.title || t('(không tiêu đề)')}</AppText>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <AppText variant="caption" color="textMuted">
                {label}
              </AppText>
              <AppText variant="body" color={value ? 'text' : 'textMuted'}>
                {value ?? '—'}
              </AppText>
            </View>
          ))}
        </Card>
      )}
      {entry ? (
        <View style={styles.actions}>
          <Button title="Lưu" icon="checkmark" onPress={save} disabled={!canSave} />
          <Button title="Sửa chi tiết" variant="secondary" icon="options-outline" onPress={editDetails} />
        </View>
      ) : null}
    </Screen>
  );
}

const useStyles = createStyles((th) => ({
  head: { gap: 2, marginBottom: th.spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: th.spacing.md },
  actions: { gap: th.spacing.sm },
}));
