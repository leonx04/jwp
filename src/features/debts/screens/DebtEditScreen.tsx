// Thêm / sửa khoản nợ. Có thể điền sẵn qua tham số: personName, amount, direction, title.
// Bật "Có lãi, trả theo kỳ" để nhập lãi suất, số kỳ, cách tính lãi: app tự lập lịch trả từng tháng.
import { goBack } from '@/lib/goBack';
import { useLocalSearchParams } from 'expo-router';
import { asc } from 'drizzle-orm';
import { useState } from 'react';
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
  SegmentedControl,
  SwitchRow,
  TextField,
} from '@/components/ui';
import { pickDateTime } from '@/components/ui/pickDateTime';
import { LOAN_METHODS, LoanInputError, summarizeLoan, type LoanMethod } from '@/core/loans';
import { db } from '@/db';
import { people, type DebtDirection } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { useMoneyFormat } from '@/features/settings';
import { addDays, formatDate, toVnDate, todayVn, vnDateToMs, type DateString } from '@/lib/date';
import { t } from '@/lib/i18n';

import { WalletChips } from '../components/WalletChips';
import { useDebt } from '../hooks';
import { saveDebt } from '../repository';

const TERM_CHIPS = [3, 6, 12, 24, 36] as const;

const METHOD_LABEL: Record<LoanMethod, string> = {
  annuity: 'Trả đều',
  equal_principal: 'Gốc đều',
  flat: 'Lãi phẳng',
  interest_only: 'Gốc cuối kỳ',
};

const parseRate = (text: string) => Number(text.trim().replace(',', '.'));

const DIRECTIONS = [
  { value: 'lent', label: 'Tôi cho vay' },
  { value: 'borrowed', label: 'Tôi đi vay' },
] as const;

type Params = {
  id?: string;
  personName?: string;
  amount?: string;
  direction?: string;
  title?: string;
};

export function DebtEditScreen() {
  const params = useLocalSearchParams<Params>();
  const { data: existing } = useDebt(params.id);
  // Chờ dữ liệu của khoản đang sửa rồi mới dựng form (form giữ state riêng)
  if (params.id && !existing) return <Screen title="Sửa khoản nợ">{null}</Screen>;
  return <Form key={existing?.debt.id ?? 'new'} params={params} existing={existing ?? null} />;
}

function Form({
  params,
  existing,
}: {
  params: Params;
  existing: NonNullable<ReturnType<typeof useDebt>['data']> | null;
}) {
  const { data: knownPeople = [] } = useLiveData(['people'], () =>
    db.select().from(people).orderBy(asc(people.name)).all(),
  );
  const [direction, setDirection] = useState<DebtDirection>(
    existing?.direction ?? (params.direction === 'borrowed' ? 'borrowed' : 'lent'),
  );
  const [name, setName] = useState(existing?.person.name ?? params.personName ?? '');
  const [amount, setAmount] = useState(existing?.debt.amount ?? (Number(params.amount) || 0));
  const [title, setTitle] = useState(existing?.debt.title ?? params.title ?? '');
  const [accountId, setAccountId] = useState<string | null>(existing?.debt.accountId ?? null);
  const [date, setDate] = useState(() => existing?.debt.date ?? Date.now());
  const [dueDate, setDueDate] = useState<DateString | null>(existing?.debt.dueDate ?? null);
  const [note, setNote] = useState(existing?.debt.note ?? '');
  const format = useMoneyFormat();
  const terms = existing?.terms ?? null;
  const [hasTerms, setHasTerms] = useState(terms !== null);
  const [rateText, setRateText] = useState(terms ? String(terms.annualRate).replace('.', ',') : '');
  const [months, setMonths] = useState(terms?.months ?? 12);
  const [monthsText, setMonthsText] = useState(
    terms && !(TERM_CHIPS as readonly number[]).includes(terms.months) ? String(terms.months) : '',
  );
  const [method, setMethod] = useState<LoanMethod>((terms?.method as LoanMethod) ?? 'annuity');
  const [monthlyFee, setMonthlyFee] = useState(terms?.monthlyFee ?? 0);
  const annualRate = parseRate(rateText);
  const startDate = toVnDate(date);

  // Xem trước số trả mỗi kỳ ngay khi gõ
  let preview: ReturnType<typeof summarizeLoan> | null = null;
  let previewError: string | null = null;
  if (hasTerms && amount > 0 && rateText.trim()) {
    try {
      preview = summarizeLoan({
        principal: amount,
        annualRate,
        months,
        method,
        monthlyFee,
        startDate,
      });
    } catch (error) {
      previewError = error instanceof LoanInputError ? error.message : String(error);
    }
  }

  const suggestions = name.trim()
    ? knownPeople.filter(
        (p) => p.name.toLowerCase().includes(name.trim().toLowerCase()) && p.name !== name,
      )
    : knownPeople.slice(0, 8);

  const save = () => {
    try {
      saveDebt(db, {
        id: existing?.debt.id,
        personName: name,
        direction,
        amount,
        title,
        date,
        // Khoản có kỳ: hạn cuối là ngày đến hạn của kỳ cuối
        dueDate: hasTerms && preview ? (preview.rows.at(-1)?.date ?? dueDate) : dueDate,
        note,
        accountId,
        terms: hasTerms
          ? { annualRate, months, method, startDate, monthlyFee }
          : existing?.terms
            ? null
            : undefined,
      });
      showSnackbar({ text: 'Đã lưu khoản nợ', tone: 'success' });
      goBack();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen
      title={existing ? 'Sửa khoản nợ' : 'Thêm khoản nợ'}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button
            title="Lưu"
            icon="checkmark"
            disabled={!name.trim() || amount <= 0 || (hasTerms && !preview)}
            onPress={save}
          />
        </View>
      }
    >
      <SegmentedControl options={DIRECTIONS} value={direction} onChange={setDirection} />
      <TextField
        label={direction === 'lent' ? 'Cho ai vay' : 'Vay của ai'}
        icon="person-outline"
        value={name}
        onChangeText={setName}
        placeholder="Tên người"
      />
      {suggestions.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.map((p) => (
            <Chip key={p.id} label={p.name} icon="person-outline" onPress={() => setName(p.name)} />
          ))}
        </ScrollView>
      ) : null}
      <MoneyField label="Số tiền gốc" value={amount} onChange={setAmount} />
      <TextField
        icon="create-outline"
        value={title}
        onChangeText={setTitle}
        placeholder="Nội dung (vd: Mượn đi sửa xe)"
      />

      <SectionTitle>{direction === 'lent' ? 'Tiền đi ra từ ví' : 'Tiền vay về ví'}</SectionTitle>
      <WalletChips value={accountId} onChange={setAccountId} />

      <SectionTitle>Ngày vay</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip
          icon="calendar-outline"
          label={formatDate(toVnDate(date))}
          onPress={async () => {
            const picked = await pickDateTime(date, 'date');
            if (picked) setDate(picked);
          }}
        />
      </View>

      <SwitchRow
        icon="calculator-outline"
        title="Có lãi, trả theo kỳ"
        subtitle="Vay ngân hàng, công ty tài chính, trả góp: nhập lãi suất và số kỳ"
        value={hasTerms}
        onValueChange={setHasTerms}
      />
      {hasTerms ? (
        <>
          <TextField
            label="Lãi suất (%/năm)"
            icon="trending-up-outline"
            placeholder="vd: 12"
            keyboardType="decimal-pad"
            value={rateText}
            onChangeText={setRateText}
          />
          {Number.isFinite(annualRate) && rateText.trim() ? (
            <AppText variant="caption" color="textMuted">
              {t('= {rate}%/tháng', {
                rate: (annualRate / 12).toLocaleString('vi-VN', { maximumFractionDigits: 3 }),
              })}
            </AppText>
          ) : null}
          <SectionTitle>Số kỳ (tháng)</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {TERM_CHIPS.map((n) => (
              <Chip
                key={n}
                label={t('{n} tháng', { n })}
                selected={months === n && !monthsText}
                onPress={() => {
                  setMonths(n);
                  setMonthsText('');
                }}
              />
            ))}
            <View style={{ width: 110 }}>
              <TextField
                placeholder="Khác"
                keyboardType="number-pad"
                value={monthsText}
                onChangeText={(text) => {
                  setMonthsText(text);
                  const n = Number(text);
                  if (Number.isInteger(n) && n > 0) setMonths(n);
                }}
              />
            </View>
          </View>
          <SectionTitle>Cách tính lãi</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {LOAN_METHODS.map((m) => (
              <Chip
                key={m}
                label={METHOD_LABEL[m]}
                selected={method === m}
                onPress={() => setMethod(m)}
              />
            ))}
          </View>
          <MoneyField
            label="Phí mỗi kỳ (bảo hiểm, quản lý)"
            value={monthlyFee}
            onChange={setMonthlyFee}
          />
          {preview ? (
            <Card style={{ gap: 4 }}>
              <AppText variant="bodyMedium">
                {preview.firstPayment === preview.maxPayment
                  ? t('Mỗi tháng {amount}', { amount: format.money(preview.firstPayment) })
                  : t('Kỳ đầu {first} → kỳ cuối {last}', {
                      first: format.money(preview.firstPayment),
                      last: format.money(preview.lastPayment),
                    })}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {t('Tổng lãi {interest} · kỳ đầu {date} · kỳ cuối {end}', {
                  interest: format.money(preview.totalInterest + preview.totalFee),
                  date: formatDate(preview.rows[0].date!),
                  end: formatDate(preview.rows.at(-1)!.date!),
                })}
              </AppText>
              {preview.effectiveRate != null && preview.effectiveRate > annualRate + 0.5 ? (
                <AppText variant="caption" color="warning">
                  {t('Lãi thực khoảng {real}%/năm', {
                    real: preview.effectiveRate.toLocaleString('vi-VN', {
                      maximumFractionDigits: 1,
                    }),
                  })}
                </AppText>
              ) : null}
            </Card>
          ) : previewError ? (
            <AppText variant="caption" color="expense">
              {t(previewError)}
            </AppText>
          ) : null}
        </>
      ) : null}

      {!hasTerms ? <SectionTitle>Hạn trả</SectionTitle> : null}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          display: hasTerms ? 'none' : 'flex',
        }}
      >
        <Chip label="Không hạn" selected={dueDate === null} onPress={() => setDueDate(null)} />
        <Chip label="+1 tháng" onPress={() => setDueDate(addDays(todayVn(), 30))} />
        <Chip
          icon="calendar-outline"
          label={dueDate ? formatDate(dueDate) : 'Chọn ngày'}
          selected={dueDate !== null}
          onPress={async () => {
            const picked = await pickDateTime(
              dueDate ? vnDateToMs(dueDate) : Date.now() + 7 * 86_400_000,
              'date',
            );
            if (picked) setDueDate(toVnDate(picked));
          }}
        />
      </View>

      <TextField
        icon="document-text-outline"
        value={note}
        onChangeText={setNote}
        placeholder="Ghi chú"
        multiline
      />
    </Screen>
  );
}
