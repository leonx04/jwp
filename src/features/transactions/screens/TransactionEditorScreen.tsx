// Thêm / sửa giao dịch: chi, thu, chuyển tiền giữa ví (có phí), tag, gợi ý theo lịch sử & số tiền.
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { budgetAlert, budgetSnapshot } from '@/features/budgets/alerts';
import { acceptCaptures } from '@/features/capture/transfers';
import { matchRule, MIN_PATTERN_LENGTH, patternKey } from '@/features/capture/rules';
import { listRules } from '@/features/capture/rulesRepository';
import { FuelSection } from '@/features/fuel/FuelSection';
import {
  isFuelText,
  lastFuel,
  litersFor,
  mergeFuelNote,
  parseFuelNote,
  stripFuelNote,
} from '@/features/fuel/fuel';
import {
  InstallmentSection,
  applyInstallment,
  installmentToSave,
  loadInstallmentDraft,
  type InstallmentValue,
} from '@/features/credit/components';
import { Alert, Keyboard, Pressable, ScrollView, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { IconButton } from '@/components/glass/IconButton';
import {
  AmountKeypad,
  KeypadField,
  AppText,
  Button,
  Chip,
  Screen,
  SectionTitle,
  SegmentedControl,
  TextField,
} from '@/components/ui';
import { pickDateTime } from '@/components/ui/pickDateTime';
import { db } from '@/db';
import type { TransactionType } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import { useMoneyFormat, useSettings } from '@/features/settings';
import {
  frequentTransferPairs,
  priceHistory,
  suggestTags,
  suggestTitles,
  type TitleSuggestion,
} from '@/features/suggestions/engine';
import { ensureTag, listTags } from '@/features/tags/repository';
import { addDays, formatAgo, formatDate, toVnDate, toVnTime, todayVn } from '@/lib/date';
import { toAppIcon } from '@/lib/icons';
import { groupThousands, parseMoney } from '@/lib/money';
import { createStyles, useTheme } from '@/theme';

import {
  deleteTransaction,
  getTransaction,
  restoreSnapshot,
  saveTransaction,
  TransactionValidationError,
} from '../repository';

type Draft = {
  type: TransactionType;
  amount: number;
  accountId: string | null;
  toAccountId: string | null;
  /** Số ví nhận khi khác số chuyển (giữ nguyên nếu không đổi số tiền) */
  toAmount: number | null;
  categoryId: string | null;
  title: string;
  note: string;
  date: number;
  tagIds: string[];
  feeText: string;
  scheduleId: string | null;
  scheduleDueDate: string | null;
  debtId: string | null;
  isAdjustment: boolean;
};

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Chi', color: 'expense' },
  { value: 'income', label: 'Thu', color: 'income' },
  { value: 'transfer', label: 'Chuyển tiền', color: 'primary' },
] as const;

type Params = {
  id?: string;
  type?: TransactionType;
  accountId?: string;
  toAccountId?: string;
  amount?: string;
  title?: string;
  categoryId?: string;
  scheduleId?: string;
  scheduleDueDate?: string;
  date?: string;
  /** Giao dịch tự đọc từ thông báo: lưu xong thì đánh dấu đã ghi */
  captureId?: string;
};

export function TransactionEditorScreen() {
  const params = useLocalSearchParams<Params>();
  const editingId = params.id && params.id !== 'new' ? params.id : undefined;
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const suggestionsEnabled = useSettings((s) => s.suggestionsEnabled);

  const { data: accounts = [] } = useLiveData(['accounts'], () => listAccounts(db));
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));
  const { data: allTags = [] } = useLiveData(['tags', 'transaction_tags'], () => listTags(db));

  const [draft, setDraft] = useState<Draft>(() => {
    const existing = editingId ? getTransaction(db, editingId) : null;
    if (existing) {
      return {
        type: existing.type,
        amount: existing.amount,
        accountId: existing.accountId,
        toAccountId: existing.toAccountId,
        toAmount: existing.toAmount,
        categoryId: existing.categoryId,
        title: existing.title,
        note: stripFuelNote(existing.note),
        date: existing.date,
        tagIds: existing.tagIds,
        feeText: existing.fee ? String(existing.fee) : '',
        scheduleId: existing.scheduleId,
        scheduleDueDate: existing.scheduleDueDate,
        debtId: existing.debtId,
        isAdjustment: existing.isAdjustment,
      };
    }
    return {
      type: params.type ?? 'expense',
      amount: params.amount ? Number(params.amount) || 0 : 0,
      accountId: params.accountId ?? null,
      toAccountId: params.toAccountId ?? null,
      toAmount: null,
      categoryId: params.categoryId ?? null,
      title: params.title ?? '',
      note: '',
      date: params.date ? Number(params.date) : Date.now(),
      tagIds: [],
      feeText: '',
      scheduleId: params.scheduleId ?? null,
      scheduleDueDate: params.scheduleDueDate ?? null,
      debtId: null,
      isAdjustment: false,
    };
  });
  const [newTag, setNewTag] = useState('');
  // Đổ xăng: giá xăng hôm đó (đ/lít), ghi vào ghi chú khi lưu
  const [fuelPrice, setFuelPrice] = useState(() =>
    editingId ? (parseFuelNote(getTransaction(db, editingId)?.note)?.price ?? 0) : 0,
  );
  // Trả góp (chỉ áp dụng khoản chi từ ví trả sau)
  const [installment, setInstallment] = useState<InstallmentValue | null>(() =>
    editingId ? loadInstallmentDraft(db, editingId) : null,
  );
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Bàn phím số có sẵn đang nhập ô nào: số tiền / giá xăng / phí chuyển khoản
  const [target, setTarget] = useState<'amount' | 'fuel' | 'fee'>('amount');

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const showFuel =
    draft.type === 'expense' &&
    (isFuelText(draft.title) ||
      isFuelText(categories.find((c) => c.id === draft.categoryId)?.name));
  // Ô đang chọn chỉ có hiệu lực khi ô đó còn hiện
  const activeTarget =
    target === 'fuel' && !showFuel
      ? 'amount'
      : target === 'fee' && draft.type !== 'transfer'
        ? 'amount'
        : target;
  const feeNumber = parseMoney(draft.feeText) || 0;
  const keypadValue =
    activeTarget === 'fuel' ? fuelPrice : activeTarget === 'fee' ? feeNumber : draft.amount;
  const onKeypad = (value: number) => {
    if (activeTarget === 'fuel') setFuelPrice(value);
    else if (activeTarget === 'fee') set({ feeText: value ? String(value) : '' });
    else set({ amount: value, toAmount: null });
  };
  const previousFuel = useMemo(
    () => (showFuel ? lastFuel(db, editingId) : null),
    [showFuel, editingId],
  );

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const isTransfer = draft.type === 'transfer';
  // Chưa chọn ví → mặc định ví đầu tiên
  const accountId = draft.accountId ?? accounts[0]?.id ?? null;

  // Truy vấn gợi ý tính trên giá trị "trễ" → bàn phím số phản hồi ngay, gợi ý cập nhật sau
  const deferredAmount = useDeferredValue(draft.amount);
  const deferredTitle = useDeferredValue(draft.title);

  const suggestions: TitleSuggestion[] = useMemo(() => {
    if (!suggestionsEnabled || isTransfer) return [];
    if (!deferredTitle && !deferredAmount) {
      return suggestTitles(db, { type: draft.type as 'expense' | 'income', limit: 6 });
    }
    return suggestTitles(db, {
      type: draft.type as 'expense' | 'income',
      query: deferredTitle,
      amount: deferredAmount,
      limit: 6,
    }).filter((s) => s.title !== deferredTitle.trim());
  }, [suggestionsEnabled, isTransfer, draft.type, deferredTitle, deferredAmount]);

  const history = useMemo(
    () =>
      deferredTitle.trim() && !isTransfer ? priceHistory(db, deferredTitle, draft.type) : null,
    [deferredTitle, draft.type, isTransfer],
  );
  const tagSuggestions = useMemo(
    () =>
      suggestTags(
        db,
        { categoryId: draft.categoryId, title: deferredTitle, exclude: draft.tagIds },
        6,
      ),
    [draft.categoryId, deferredTitle, draft.tagIds],
  );
  const pairs = useMemo(() => (isTransfer ? frequentTransferPairs(db) : []), [isTransfer]);

  const applySuggestion = (s: TitleSuggestion) => {
    Haptics.selectionAsync().catch(() => {});
    set({
      title: s.title,
      categoryId: s.categoryId,
      accountId: s.accountId,
      tagIds: [...new Set([...draft.tagIds, ...s.tagIds])],
      amount: draft.amount || s.lastAmount,
    });
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    const id = ensureTag(db, newTag);
    set({ tagIds: [...new Set([...draft.tagIds, id])] });
    setNewTag('');
  };

  const save = () => {
    const fee = draft.feeText ? (parseMoney(draft.feeText) ?? NaN) : 0;
    if (Number.isNaN(fee)) {
      Alert.alert('Phí không hợp lệ', 'Nhập số tiền phí, vd 3.300 hoặc 3,3k.');
      return;
    }
    try {
      const budgetsBefore = draft.type === 'expense' ? budgetSnapshot(db) : null;
      const plan = draft.type === 'expense' ? installment : null;
      const savedId = saveTransaction(db, {
        id: editingId,
        type: draft.type,
        amount: installmentToSave(plan, draft.amount).amount,
        accountId: accountId ?? '',
        toAccountId: draft.toAccountId,
        toAmount: draft.toAmount,
        categoryId: draft.categoryId,
        title: draft.title,
        note: mergeFuelNote(
          draft.note,
          showFuel && fuelPrice > 0
            ? { price: fuelPrice, liters: litersFor(draft.amount, fuelPrice) }
            : null,
        ),
        date: draft.date,
        tagIds: draft.tagIds,
        fee: isTransfer ? Math.abs(fee) : 0,
        scheduleId: draft.scheduleId,
        scheduleDueDate: draft.scheduleDueDate,
        debtId: draft.debtId,
        isAdjustment: draft.isAdjustment,
      });
      // captureId có thể là nhiều id cách nhau bởi dấu phẩy (hai thông báo → một chuyển khoản)
      if (params.captureId) acceptCaptures(db, params.captureId.split(','), savedId);
      if (accountId) {
        applyInstallment(db, {
          transactionId: savedId,
          accountId,
          title: draft.title,
          date: draft.date,
          price: draft.amount,
          value: plan,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const saved = editingId ? 'Đã lưu thay đổi' : 'Đã thêm giao dịch';
      const alert = budgetsBefore ? budgetAlert(budgetsBefore, budgetSnapshot(db)) : null;
      // Ghi từ hộp chờ có danh mục mà chưa có quy tắc nào khớp → mời tạo quy tắc cho lần sau
      const ruleType = draft.type === 'income' || draft.type === 'expense' ? draft.type : null;
      const rulePattern = draft.title.trim();
      const offerRule =
        !!params.captureId &&
        !!ruleType &&
        !!draft.categoryId &&
        patternKey(rulePattern).length >= MIN_PATTERN_LENGTH &&
        !matchRule(listRules(db), { type: ruleType, content: rulePattern, counterparty: null });
      const categoryForRule = draft.categoryId;
      showSnackbar({
        ...(alert
          ? { text: `${saved} · ${alert.text}`, tone: alert.over ? 'error' : 'default' }
          : { text: saved, tone: 'success' }),
        ...(offerRule
          ? {
              actionLabel: 'Tạo quy tắc',
              onAction: () =>
                router.push({
                  pathname: '/capture-rule/edit',
                  params: { pattern: rulePattern, categoryId: categoryForRule!, type: ruleType! },
                }),
            }
          : {}),
      });
      router.back();
    } catch (error) {
      const message =
        error instanceof TransactionValidationError
          ? error.message
          : `Không lưu được: ${error instanceof Error ? error.message : String(error)}`;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Chưa lưu được', message);
    }
  };

  const remove = () => {
    if (!editingId) return;
    Alert.alert('Xoá giao dịch?', 'Có thể hoàn tác ngay sau khi xoá.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => {
          const snapshot = deleteTransaction(db, editingId);
          showSnackbar({
            text: 'Đã xoá giao dịch',
            actionLabel: 'Hoàn tác',
            onAction: () => restoreSnapshot(db, snapshot),
          });
          router.back();
        },
      },
    ]);
  };

  const pickDate = async (mode: 'date' | 'time') => {
    const value = await pickDateTime(draft.date, mode);
    if (value) set({ date: value });
  };

  const amountColor = isTransfer ? 'text' : draft.type === 'income' ? 'income' : 'expense';
  const day = toVnDate(draft.date);
  const today = todayVn();
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <Screen
      title={editingId ? 'Sửa giao dịch' : 'Thêm giao dịch'}
      leading="close"
      headerRight={
        editingId ? (
          <IconButton
            icon="trash-outline"
            accessibilityLabel="Xoá"
            color={colors.expense}
            onPress={remove}
          />
        ) : (
          <IconButton
            icon="image-outline"
            accessibilityLabel="Nhập từ ảnh biên lai"
            onPress={() => router.push('/receipt-scan')}
          />
        )
      }
      footer={
        <View style={styles.footer}>
          <Pressable style={styles.amountBox} onPress={() => setTarget('amount')}>
            <AppText
              variant="hero"
              color={draft.amount ? amountColor : 'textMuted'}
              style={styles.amount}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {format.money(draft.amount)}
            </AppText>
            {history ? (
              <AppText variant="caption" color="textMuted" style={styles.center}>
                Lần trước {format.money(history.lastAmount)} · {formatAgo(history.lastDate)}
                {history.count > 1 ? ` · TB ${format.compact(history.avgAmount)}` : ''}
                {history.count > 2 && history.minAmount !== history.maxAmount
                  ? ` · ${format.compact(history.minAmount)}–${format.compact(history.maxAmount)}`
                  : ''}
              </AppText>
            ) : null}
          </Pressable>

          {keyboardOpen ? null : (
            <>
              <AmountKeypad value={keypadValue} onChange={onKeypad} />
              <Button
                title={editingId ? 'Lưu thay đổi' : 'Lưu'}
                icon="checkmark"
                disabled={!draft.amount}
                onPress={save}
              />
            </>
          )}
        </View>
      }
    >
      {draft.debtId ? (
        <AppText variant="caption" color="warning">
          Giao dịch này thuộc Sổ nợ — nên sửa trong màn Sổ nợ để số nợ còn lại luôn đúng.
        </AppText>
      ) : null}

      <SegmentedControl
        options={TYPE_OPTIONS}
        value={draft.type}
        onChange={(type) =>
          set({ type, categoryId: type === 'transfer' ? null : draft.categoryId })
        }
      />

      {/* Gợi ý từ lịch sử */}
      {suggestions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.chipsRow}
        >
          {suggestions.map((s) => (
            <Chip
              key={s.titleKey}
              icon="sparkles-outline"
              label={`${s.title} · ${format.compact(s.lastAmount)}`}
              onPress={() => applySuggestion(s)}
            />
          ))}
        </ScrollView>
      ) : null}

      {!isTransfer ? (
        <TextField
          icon="create-outline"
          placeholder="Tiêu đề (vd: Cà phê sáng)"
          value={draft.title}
          onChangeText={(title) => set({ title })}
          returnKeyType="done"
        />
      ) : null}

      {showFuel ? (
        <FuelSection
          amount={draft.amount}
          price={fuelPrice}
          onChange={setFuelPrice}
          last={previousFuel}
          active={activeTarget === 'fuel'}
          onActivate={() => setTarget('fuel')}
        />
      ) : null}

      {/* Ví */}
      {isTransfer ? (
        <>
          <SectionTitle>Từ ví</SectionTitle>
          <AccountChips
            accounts={accounts}
            value={accountId}
            onChange={(id) => set({ accountId: id })}
          />
          <View style={styles.swapRow}>
            <IconButton
              icon="swap-vertical"
              accessibilityLabel="Đảo chiều"
              onPress={() => set({ accountId: draft.toAccountId, toAccountId: accountId })}
            />
            <AppText variant="caption" color="textMuted">
              Đảo chiều
            </AppText>
          </View>
          <SectionTitle>Đến ví</SectionTitle>
          <AccountChips
            accounts={accounts.filter((a) => a.id !== accountId)}
            value={draft.toAccountId}
            onChange={(toAccountId) => set({ toAccountId })}
          />
          {pairs.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.chipsRow}
            >
              {pairs.map((p) => (
                <Chip
                  key={`${p.accountId}-${p.toAccountId}`}
                  icon="repeat-outline"
                  label={`${accountById.get(p.accountId)?.name ?? '?'} → ${accountById.get(p.toAccountId)?.name ?? '?'}`}
                  onPress={() => set({ accountId: p.accountId, toAccountId: p.toAccountId })}
                />
              ))}
            </ScrollView>
          ) : null}
          <KeypadField
            icon="receipt-outline"
            label="Phí chuyển khoản (nếu có)"
            text={feeNumber ? groupThousands(feeNumber) : ''}
            placeholder="Chạm để nhập, vd 3.300"
            active={activeTarget === 'fee'}
            onPress={() => setTarget('fee')}
          />
        </>
      ) : (
        <>
          <SectionTitle>{draft.type === 'income' ? 'Nhận vào ví' : 'Chi từ ví'}</SectionTitle>
          <AccountChips
            accounts={accounts}
            value={accountId}
            onChange={(accountId) => set({ accountId })}
          />
          {draft.type === 'expense' ? (
            <InstallmentSection
              accountId={accountId}
              amount={draft.amount}
              value={installment}
              onChange={setInstallment}
              date={draft.date}
            />
          ) : null}
          <SectionTitle>Danh mục</SectionTitle>
          <View style={styles.wrap}>
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                icon={c.icon ? toAppIcon(c.icon, 'pricetag-outline') : undefined}
                color={c.color}
                selected={draft.categoryId === c.id}
                onPress={() => set({ categoryId: draft.categoryId === c.id ? null : c.id })}
              />
            ))}
            <Chip
              label="Sửa danh mục"
              icon="settings-outline"
              onPress={() => router.push('/categories')}
            />
          </View>
        </>
      )}

      {/* Thời gian */}
      <SectionTitle>Thời gian</SectionTitle>
      <View style={styles.wrap}>
        <Chip
          label="Hôm nay"
          selected={day === today}
          onPress={() => set({ date: draft.date + (Date.parse(today) - Date.parse(day)) })}
        />
        <Chip
          label="Hôm qua"
          selected={day === addDays(today, -1)}
          onPress={() =>
            set({ date: draft.date + (Date.parse(addDays(today, -1)) - Date.parse(day)) })
          }
        />
        <Chip icon="calendar-outline" label={formatDate(day)} onPress={() => pickDate('date')} />
        <Chip icon="time-outline" label={toVnTime(draft.date)} onPress={() => pickDate('time')} />
      </View>

      {/* Tag + ghi chú: gập lại cho gọn, tự mở khi đã có nội dung */}
      {moreOpen || draft.tagIds.length > 0 || !!draft.note ? (
        <>
          <SectionTitle>Tag</SectionTitle>
          <View style={styles.wrap}>
            {draft.tagIds.map((id) => {
              const tag = allTags.find((t) => t.id === id);
              return tag ? (
                <Chip
                  key={id}
                  label={`#${tag.name}`}
                  color={tag.color}
                  selected
                  removable
                  onPress={() => set({ tagIds: draft.tagIds.filter((t) => t !== id) })}
                />
              ) : null;
            })}
            {tagSuggestions.map((t) => (
              <Chip
                key={t.id}
                label={`#${t.name}`}
                color={t.color}
                onPress={() => set({ tagIds: [...draft.tagIds, t.id] })}
              />
            ))}
          </View>
          <TextField
            icon="pricetag-outline"
            placeholder="Thêm tag mới rồi bấm Enter"
            value={newTag}
            onChangeText={setNewTag}
            onSubmitEditing={addTag}
            returnKeyType="done"
            submitBehavior="submit"
          />

          <TextField
            icon="document-text-outline"
            placeholder="Ghi chú"
            value={draft.note}
            onChangeText={(note) => set({ note })}
            multiline
          />
        </>
      ) : (
        <View style={styles.wrap}>
          <Chip icon="add" label="Thêm tag / ghi chú" onPress={() => setMoreOpen(true)} />
        </View>
      )}
    </Screen>
  );
}

function AccountChips({
  accounts,
  value,
  onChange,
}: {
  accounts: { id: string; name: string; color: string; icon: string | null }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.chipsRow}
    >
      {accounts.map((a) => (
        <Chip
          key={a.id}
          label={a.name}
          icon={toAppIcon(a.icon, 'wallet-outline')}
          color={a.color}
          selected={value === a.id}
          onPress={() => onChange(a.id)}
        />
      ))}
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  footer: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.sm,
    gap: t.spacing.sm,
  },
  amountBox: {
    alignItems: 'center',
    paddingVertical: t.spacing.sm,
    gap: 4,
  },
  amount: {
    fontSize: 36,
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
  bleed: {
    marginHorizontal: -t.spacing.lg,
    flexGrow: 0,
  },
  chipsRow: {
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginVertical: -t.spacing.sm,
  },
}));
