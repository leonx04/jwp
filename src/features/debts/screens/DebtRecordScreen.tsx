// Ghi một lần trả bớt / vay thêm / tính lãi cho một khoản nợ, sửa một lần đã ghi,
// hoặc trả bớt cho một người (tự chia vào các khoản của người đó).
// Ô số tiền để trống và mở bàn phím số ngay; chip gợi ý + dòng "còn nợ A → B" cập nhật khi gõ.
import { goBack } from '@/lib/goBack';
import { t } from '@/lib/i18n';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import {
  AppText,
  Button,
  Card,
  Chip,
  MoneyField,
  Screen,
  SectionTitle,
  TextField,
} from '@/components/ui';
import { pickDateTime } from '@/components/ui/pickDateTime';
import { db } from '@/db';
import {
  DEBT_DIRECTIONS,
  DEBT_RECORD_TYPES,
  type DebtDirection,
  type DebtRecordType,
} from '@/db/schema';
import { useMoneyFormat } from '@/features/settings';
import { formatDate, toVnDate } from '@/lib/date';

import { allocateRepayment, quickAmounts } from '../compute';
import { recordLabel } from '../components/display';
import { WalletChips } from '../components/WalletChips';
import { useDebt, usePersonDebts } from '../hooks';
import type { DebtItem } from '../queries';
import { addDebtRecord, deleteDebtRecord, repayMany, updateDebtRecord } from '../repository';

type Params = {
  debtId?: string;
  type?: string;
  recordId?: string;
  personId?: string;
  direction?: string;
};

const pick = <T extends string>(list: readonly T[], value: string | undefined, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

export function DebtRecordScreen() {
  const params = useLocalSearchParams<Params>();
  if (params.personId) {
    return (
      <PersonRepay
        personId={params.personId}
        direction={pick(DEBT_DIRECTIONS, params.direction, 'borrowed')}
      />
    );
  }
  return (
    <SingleRecord
      debtId={params.debtId}
      recordId={params.recordId}
      type={pick(DEBT_RECORD_TYPES, params.type, 'repay')}
    />
  );
}

// ── Một khoản ───────────────────────────────────────────────────────────────────

function SingleRecord({
  debtId,
  recordId,
  type: requested,
}: {
  debtId?: string;
  recordId?: string;
  type: DebtRecordType;
}) {
  const { data: item } = useDebt(debtId);
  const existing = recordId ? item?.records.find((r) => r.id === recordId) : undefined;

  if (!item || (recordId && !existing)) return <Screen title="Ghi nợ">{null}</Screen>;
  return (
    <RecordForm
      key={existing?.id ?? 'new'}
      item={item}
      type={existing?.type ?? requested}
      existing={existing}
    />
  );
}

function RecordForm({
  item,
  type,
  existing,
}: {
  item: DebtItem;
  type: DebtRecordType;
  existing?: DebtItem['records'][number];
}) {
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [accountId, setAccountId] = useState<string | null>(
    existing ? existing.accountId : item.debt.accountId,
  );
  const [date, setDate] = useState(() => existing?.date ?? Date.now());
  const [note, setNote] = useState(existing?.note ?? '');

  const title = recordLabel(item.direction, type);
  const usesWallet = type !== 'interest';
  // Khi sửa: số còn lại trước lần này = còn lại hiện tại bỏ đi tác động của chính nó
  const own = existing ? (existing.type === 'repay' ? -existing.amount : existing.amount) : 0;
  const before = item.total - item.repaid - own;
  const after = before + (type === 'repay' ? -amount : amount);

  const save = () => {
    try {
      const input = { amount, date, note, accountId: usesWallet ? accountId : null };
      if (existing) updateDebtRecord(db, existing.id, input);
      else addDebtRecord(db, { ...input, debtId: item.debt.id, type });
      showSnackbar({
        text: existing
          ? t('Đã sửa lần ghi')
          : t('Đã ghi: {toLowerCase}', { toLowerCase: title.toLowerCase() }),
        tone: 'success',
      });
      goBack();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('Xoá lần ghi này?'), t('Giao dịch ví đi kèm (nếu có) cũng bị xoá.'), [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => {
          deleteDebtRecord(db, existing.id);
          goBack();
        },
      },
    ]);
  };

  return (
    <FormLayout
      title={`${existing ? t('Sửa') + ' · ' : ''}${title} · ${item.person.name}`}
      type={type}
      amount={amount}
      onAmount={setAmount}
      autoOpen={!existing}
      before={before}
      after={after}
      date={date}
      onDate={setDate}
      note={note}
      onNote={setNote}
      wallet={usesWallet ? { value: accountId, onChange: setAccountId } : null}
      onSave={save}
      onDelete={existing ? remove : undefined}
    />
  );
}

// ── Trả bớt cho một người ───────────────────────────────────────────────────────

function PersonRepay({ personId, direction }: { personId: string; direction: DebtDirection }) {
  const format = useMoneyFormat();
  const { group } = usePersonDebts(personId);
  const open = useMemo(
    () =>
      (group?.items ?? []).filter(
        (d) => d.direction === direction && d.status !== 'closed' && d.remaining > 0,
      ),
    [group, direction],
  );
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<string | null | undefined>(undefined);
  const [date, setDate] = useState(() => Date.now());
  const [note, setNote] = useState('');

  if (!group) return <Screen title="Ghi nợ">{null}</Screen>;

  const before = open.reduce((s, d) => s + d.remaining, 0);
  const parts = allocateRepayment(
    open.map((d) => ({
      id: d.debt.id,
      remaining: d.remaining,
      dueDate: d.debt.dueDate,
      date: d.debt.date,
    })),
    amount,
  );
  // Ví mặc định: ví đã dùng ở khoản sẽ được trả đầu tiên
  const firstDebt = open.find((d) => d.debt.id === parts[0]?.id) ?? open[0];
  const wallet = accountId === undefined ? (firstDebt?.debt.accountId ?? null) : accountId;
  const title = recordLabel(direction, 'repay');

  const save = () => {
    try {
      repayMany(
        db,
        parts.map((p) => ({ debtId: p.id, amount: p.amount })),
        { date, note, accountId: wallet },
      );
      showSnackbar({
        text: t('Đã ghi: {toLowerCase}', { toLowerCase: title.toLowerCase() }),
        tone: 'success',
      });
      goBack();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  const split =
    parts.length > 1 ? (
      <Card style={{ gap: 6 }}>
        <AppText variant="label" color="textMuted">
          {t('Chia vào {count} khoản (hạn gần nhất trước)', { count: parts.length })}
        </AppText>
        {parts.map((p) => {
          const d = open.find((x) => x.debt.id === p.id)!;
          return (
            <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                {d.debt.title || formatDate(toVnDate(d.debt.date))}
              </AppText>
              <AppText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
                {format.money(p.amount)}
              </AppText>
            </View>
          );
        })}
      </Card>
    ) : null;

  return (
    <FormLayout
      title={`${title} · ${group.person.name}`}
      type="repay"
      amount={amount}
      onAmount={setAmount}
      autoOpen
      before={before}
      after={before - amount}
      date={date}
      onDate={setDate}
      note={note}
      onNote={setNote}
      wallet={{ value: wallet, onChange: setAccountId }}
      onSave={save}
      extra={split}
    />
  );
}

// ── Bố cục chung ────────────────────────────────────────────────────────────────

type FormLayoutProps = {
  title: string;
  type: DebtRecordType;
  amount: number;
  onAmount: (v: number) => void;
  autoOpen: boolean;
  /** Còn nợ trước / sau lần ghi này */
  before: number;
  after: number;
  date: number;
  onDate: (v: number) => void;
  note: string;
  onNote: (v: string) => void;
  wallet: { value: string | null; onChange: (id: string | null) => void } | null;
  onSave: () => void;
  onDelete?: () => void;
  extra?: ReactNode;
};

function FormLayout(p: FormLayoutProps) {
  const format = useMoneyFormat();
  const chips = quickAmounts(Math.max(0, p.before), p.type);

  const chipRow = chips.length ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {chips.map((q) => (
        <Chip
          key={`${q.kind}:${q.amount}`}
          label={
            q.kind === 'all'
              ? t('Hết {amount}', { amount: format.compact(q.amount) })
              : q.kind === 'half'
                ? t('Một nửa {amount}', { amount: format.compact(q.amount) })
                : format.compact(q.amount)
          }
          selected={p.amount === q.amount}
          onPress={() => p.onAmount(q.amount)}
        />
      ))}
    </ScrollView>
  ) : null;

  const preview = (
    <AppText variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
      {t('Còn nợ')} {format.money(Math.max(0, p.before))} →{' '}
      <AppText variant="caption" color={p.after < 0 ? 'warning' : 'text'}>
        {p.after < 0 ? t('dư {amount}', { amount: format.money(-p.after) }) : format.money(p.after)}
      </AppText>
    </AppText>
  );

  return (
    <Screen
      title={p.title}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button title="Lưu" icon="checkmark" disabled={p.amount <= 0} onPress={p.onSave} />
        </View>
      }
    >
      <MoneyField
        label="Số tiền"
        value={p.amount}
        onChange={p.onAmount}
        autoOpen={p.autoOpen}
        accessory={
          <View style={{ gap: 10 }}>
            {chipRow}
            {preview}
          </View>
        }
      />
      {chipRow}
      <Card>{preview}</Card>
      {p.extra}
      {p.type === 'interest' ? (
        <AppText variant="caption" color="textMuted">
          Tiền lãi được cộng vào số nợ, không động vào ví.
        </AppText>
      ) : p.wallet ? (
        <>
          <SectionTitle>Ví</SectionTitle>
          <WalletChips value={p.wallet.value} onChange={p.wallet.onChange} />
        </>
      ) : null}
      <SectionTitle>Ngày</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip
          icon="calendar-outline"
          label={formatDate(toVnDate(p.date))}
          onPress={async () => {
            const picked = await pickDateTime(p.date, 'date');
            if (picked) p.onDate(picked);
          }}
        />
        <Chip label="Hôm nay" onPress={() => p.onDate(Date.now())} />
      </View>
      <TextField
        icon="document-text-outline"
        placeholder="Ghi chú"
        value={p.note}
        onChangeText={p.onNote}
      />
      {p.onDelete ? (
        <Button
          title="Xoá lần ghi này"
          icon="trash-outline"
          variant="secondary"
          onPress={p.onDelete}
        />
      ) : null}
    </Screen>
  );
}
