// Danh sách giao dịch: tìm kiếm không dấu, lọc theo kỳ / loại / ví / danh mục / tag,
// nhóm theo ngày kiểu "inset grouped", vuốt trái để xoá (có hoàn tác).
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { IconButton } from '@/components/glass/IconButton';
import {
  AmountText,
  AppText,
  Card,
  Chip,
  EmptyState,
  LargeTitle,
  Screen,
  SegmentedControl,
  TextField,
  useScreenLayout,
} from '@/components/ui';
import { db } from '@/db';
import type { TransactionType } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { listTags } from '@/features/tags/repository';
import {
  addDays,
  formatDayHeader,
  formatMonth,
  periodContaining,
  shiftPeriod,
  todayVn,
  vnDateToMs,
} from '@/lib/date';
import { toAppIcon } from '@/lib/icons';
import { createStyles, rgba, useTheme } from '@/theme';

import { TransactionRow } from '../components/TransactionRow';
import { groupByDay, summarize, type GroupedRow, type TransactionEntry } from '../grouping';
import { useTransactions } from '../hooks';
import { deleteTransaction, restoreSnapshot } from '../repository';

type TypeFilter = 'all' | TransactionType;

const TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'expense', label: 'Chi', color: 'expense' },
  { value: 'income', label: 'Thu', color: 'income' },
  { value: 'transfer', label: 'Chuyển', color: 'primary' },
] as const;

export function TransactionsScreen() {
  const params = useLocalSearchParams<{
    accountId?: string;
    categoryId?: string;
    tagId?: string;
  }>();
  return (
    <Screen scroll={false} tabBar largeTitle title="Giao dịch">
      {/* Đổi bộ lọc từ màn khác (vd "Xem giao dịch của danh mục") → dựng lại danh sách với bộ lọc mới */}
      <TransactionsList key={`${params.accountId}|${params.categoryId}|${params.tagId}`} />
    </Screen>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function TransactionsList() {
  const params = useLocalSearchParams<{
    accountId?: string;
    categoryId?: string;
    tagId?: string;
  }>();
  const { top, bottom, onScrollJS } = useScreenLayout();
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const startDay = useSettings((s) => s.startDayOfMonth);
  const transfersAsIncomeExpense = useSettings((s) => s.transfersAsIncomeExpense);

  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), 250);
  const [offset, setOffset] = useState(0);
  const [allTime, setAllTime] = useState(false);
  const [type, setType] = useState<TypeFilter>('all');
  const [accountId, setAccountId] = useState<string | undefined>(params.accountId);
  const [categoryId, setCategoryId] = useState<string | undefined>(params.categoryId);
  const [tagId, setTagId] = useState<string | undefined>(params.tagId);

  const period = useMemo(
    () => shiftPeriod(periodContaining(todayVn(), startDay), offset, startDay),
    [offset, startDay],
  );
  // Đang tìm kiếm → tìm trong toàn bộ lịch sử
  const wholeHistory = allTime || !!query;

  const { data: items = [] } = useTransactions({
    from: wholeHistory ? undefined : vnDateToMs(period.start),
    to: wholeHistory ? undefined : vnDateToMs(addDays(period.end, 1)),
    search: query || undefined,
    types: type === 'all' ? undefined : [type],
    accountId,
    categoryId,
    tagId,
  });
  const { data: accounts = [] } = useLiveData(['accounts'], () => listAccounts(db));
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));
  const { data: tags = [] } = useLiveData(['tags'], () => listTags(db));

  const rows = useMemo(() => groupByDay(items), [items]);
  const totals = useMemo(
    () => summarize(items, { transfersAsIncomeExpense, accountId }),
    [items, transfersAsIncomeExpense, accountId],
  );

  const remove = (entry: TransactionEntry) => {
    if (entry.item.debtId) {
      showSnackbar({ text: 'Giao dịch của Sổ nợ — hãy xoá trong Sổ nợ.', tone: 'error' });
      return;
    }
    const snapshot = deleteTransaction(db, entry.item.id);
    showSnackbar({
      text: 'Đã xoá giao dịch',
      actionLabel: 'Hoàn tác',
      onAction: () => restoreSnapshot(db, snapshot),
    });
  };

  const category = categoryId ? categories.find((c) => c.id === categoryId) : null;
  const tag = tagId ? tags.find((t) => t.id === tagId) : null;

  const header = (
    <View style={styles.headerBlock}>
      <LargeTitle title="Giao dịch" />
      <TextField
        icon="search"
        placeholder="Tìm (không cần dấu): ca phe, luong…"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
      />

      {!query ? (
        <View style={styles.periodRow}>
          <IconButton
            icon="chevron-back"
            accessibilityLabel="Kỳ trước"
            onPress={() => {
              setAllTime(false);
              setOffset(offset - 1);
            }}
          />
          <Pressable style={styles.periodLabel} onPress={() => setAllTime(!allTime)}>
            <AppText variant="heading">
              {allTime ? 'Toàn bộ thời gian' : `T${formatMonth(period.start).slice(1)}`}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {allTime
                ? 'Chạm để xem theo tháng'
                : `${period.start.slice(8)}/${period.start.slice(5, 7)} – ${period.end.slice(8)}/${period.end.slice(5, 7)}`}
            </AppText>
          </Pressable>
          <IconButton
            icon="chevron-forward"
            accessibilityLabel="Kỳ sau"
            onPress={() => {
              setAllTime(false);
              setOffset(offset + 1);
            }}
          />
        </View>
      ) : null}

      <View style={styles.summary}>
        <SummaryCell label="Thu" value={format.compact(totals.income)} color={colors.income} />
        <SummaryCell label="Chi" value={format.compact(totals.expense)} color={colors.expense} />
        <SummaryCell
          label="Chênh lệch"
          value={`${totals.net > 0 ? '+' : ''}${format.compact(totals.net)}`}
          color={totals.net < 0 ? colors.expense : colors.primary}
        />
      </View>

      <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label="Mọi ví"
          icon="wallet-outline"
          selected={!accountId}
          onPress={() => setAccountId(undefined)}
        />
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            color={a.color}
            selected={accountId === a.id}
            onPress={() => setAccountId(accountId === a.id ? undefined : a.id)}
          />
        ))}
      </ScrollView>

      {category || tag || categoryId === 'none' ? (
        <View style={styles.wrap}>
          {categoryId ? (
            <Chip
              label={category?.name ?? 'Chưa phân loại'}
              icon={toAppIcon(category?.icon, 'help-circle-outline')}
              color={category?.color}
              selected
              removable
              onPress={() => setCategoryId(undefined)}
            />
          ) : null}
          {tag ? (
            <Chip label={`#${tag.name}`} selected removable onPress={() => setTagId(undefined)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <FlashList
      data={rows}
      keyExtractor={(row: GroupedRow) => row.key}
      getItemType={(row: GroupedRow) => row.kind}
      onScroll={onScrollJS}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottom, paddingHorizontal: 16 }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Card>
          <EmptyState
            icon="receipt-outline"
            title={query ? 'Không tìm thấy' : 'Chưa có giao dịch'}
            description={
              query
                ? `Không có giao dịch nào khớp "${query}".`
                : 'Bấm nút ＋ để thêm giao dịch đầu tiên của kỳ này.'
            }
          />
        </Card>
      }
      renderItem={({ item: row }: { item: GroupedRow }) =>
        row.kind === 'header' ? (
          <View style={styles.dayHeader}>
            <AppText variant="label" color="textMuted">
              {formatDayHeader(row.date).toUpperCase()}
            </AppText>
            {row.income || row.expense ? (
              <AmountText
                amount={row.income - row.expense}
                variant="label"
                color={row.income - row.expense < 0 ? 'textMuted' : 'income'}
              />
            ) : null}
          </View>
        ) : (
          <SwipeRow entry={row} onDelete={() => remove(row)} />
        )
      }
    />
  );
}

function SummaryCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View
      style={{ flex: 1, gap: 2, padding: 12, borderRadius: 20, backgroundColor: rgba(color, 0.1) }}
    >
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      <AppText
        variant="heading"
        style={{ color, fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </AppText>
    </View>
  );
}

const RADIUS = 22;

/** Nút xoá phía sau hàng: mờ dần theo mức vuốt (để không lộ qua nền kính trong suốt) */
function DeleteAction({
  progress,
  onPress,
}: {
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fade = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.value * 1.4) }));
  return (
    <Animated.View style={[styles.deleteAction, { backgroundColor: colors.expense }, fade]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xoá"
        onPress={onPress}
        style={styles.deletePress}
      >
        <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
        <AppText variant="label" style={{ color: '#FFFFFF' }}>
          Xoá
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

function SwipeRow({ entry, onDelete }: { entry: TransactionEntry; onDelete: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const top = entry.position === 'first' || entry.position === 'single';
  const bottomEdge = entry.position === 'last' || entry.position === 'single';
  const shape = {
    borderTopLeftRadius: top ? RADIUS : 0,
    borderTopRightRadius: top ? RADIUS : 0,
    borderBottomLeftRadius: bottomEdge ? RADIUS : 0,
    borderBottomRightRadius: bottomEdge ? RADIUS : 0,
  };
  return (
    <View style={[styles.rowShell, shape, { marginBottom: bottomEdge ? 4 : 0 }]}>
      <ReanimatedSwipeable
        friction={1.6}
        rightThreshold={60}
        overshootRight={false}
        renderRightActions={(progress) => <DeleteAction progress={progress} onPress={onDelete} />}
      >
        <View style={[styles.rowInner, { backgroundColor: colors.surface }]}>
          <TransactionRow item={entry.item} />
        </View>
      </ReanimatedSwipeable>
      {!bottomEdge ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  headerBlock: {
    gap: t.spacing.md,
    paddingBottom: t.spacing.md,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  periodLabel: {
    flex: 1,
    alignItems: 'center',
  },
  summary: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  bleed: {
    marginHorizontal: -t.spacing.lg,
    flexGrow: 0,
  },
  chips: {
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.sm,
  },
  rowShell: {
    overflow: 'hidden',
    borderWidth: 0,
  },
  rowInner: {
    paddingHorizontal: t.spacing.lg,
  },
  separator: {
    position: 'absolute',
    left: 70,
    right: 0,
    bottom: 0,
    height: 1,
    opacity: 0.6,
  },
  deleteAction: {
    width: 88,
  },
  deletePress: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
}));
