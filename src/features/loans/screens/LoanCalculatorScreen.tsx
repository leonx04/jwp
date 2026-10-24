// Tính khoản vay: nhập số tiền, lãi suất, số kỳ, cách tính lãi → số trả mỗi tháng, tổng lãi,
// lãi thực tương đương, so sánh bốn cách tính, bảng trả từng kỳ và thử trả trước hạn.
// Chỉ tính toán, chưa lưu khoản vay vào dữ liệu.
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Card,
  Chip,
  MoneyField,
  Screen,
  SectionTitle,
  SegmentedControl,
  TextField,
} from '@/components/ui';
import {
  LOAN_METHODS,
  LoanInputError,
  simulatePrepayment,
  summarizeLoan,
  type LoanMethod,
  type LoanTerms,
} from '@/core/loans';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { getTypicalMonth } from '@/features/salary/queries';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { formatDate, todayVn } from '@/lib/date';
import { t } from '@/lib/i18n';
import { createStyles, useTheme } from '@/theme';

const TERM_CHIPS = [6, 12, 24, 36, 60] as const;

const METHOD_LABEL: Record<LoanMethod, string> = {
  annuity: 'Trả đều',
  equal_principal: 'Gốc đều',
  flat: 'Lãi phẳng',
  interest_only: 'Gốc cuối kỳ',
};

const METHOD_HINT: Record<LoanMethod, string> = {
  annuity: 'Dư nợ giảm dần, mỗi tháng trả bằng nhau. Hay gặp ở vay tiêu dùng, mua xe.',
  equal_principal:
    'Dư nợ giảm dần, gốc mỗi tháng bằng nhau nên tổng trả giảm dần. Hay gặp ở vay mua nhà.',
  flat: 'Lãi tính trên số vay ban đầu suốt kỳ hạn. Hay gặp ở công ty tài chính, trả góp cửa hàng; lãi thực cao hơn nhiều so với con số niêm yết.',
  interest_only:
    'Mỗi tháng chỉ trả lãi, kỳ cuối trả cả gốc. Hay gặp khi vay người quen, vay ngắn hạn.',
};

type RateUnit = 'year' | 'month';

/** '12,5' / '12.5' → 12.5; trống hoặc sai → NaN */
const parseRate = (text: string) => Number(text.trim().replace(',', '.'));
const fmtRate = (n: number) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Ô dữ liệu nhỏ trong thẻ tổng kết */
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      <AppText
        variant="bodyMedium"
        color={tone ?? 'text'}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
    </View>
  );
}

export function LoanCalculatorScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const startDay = useSettings((s) => s.startDayOfMonth);
  const today = todayVn();

  const [principal, setPrincipal] = useState(50_000_000);
  const [rateText, setRateText] = useState('12');
  const [unit, setUnit] = useState<RateUnit>('year');
  const [months, setMonths] = useState(12);
  const [monthsText, setMonthsText] = useState('');
  const [method, setMethod] = useState<LoanMethod>('annuity');
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [upfrontFee, setUpfrontFee] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [prepay, setPrepay] = useState(0);
  const [prepayAfter, setPrepayAfter] = useState(6);
  const [prepayMode, setPrepayMode] = useState<'shorten' | 'reduce'>('shorten');
  const [prepayFee, setPrepayFee] = useState('0');

  const { data: typical } = useLiveData(['transactions'], () =>
    getTypicalMonth(db, today, startDay),
  );

  const rateInput = parseRate(rateText);
  const annualRate = unit === 'year' ? rateInput : rateInput * 12;

  const result = useMemo(() => {
    const terms: LoanTerms = {
      principal,
      annualRate,
      months,
      method,
      monthlyFee,
      startDate: today,
    };
    try {
      const all = LOAN_METHODS.map((m) => ({
        method: m,
        summary: summarizeLoan({ ...terms, method: m }, upfrontFee),
      }));
      const current = all.find((a) => a.method === method)!.summary;
      return { terms, current, all, error: null as string | null };
    } catch (error) {
      return {
        terms,
        current: null,
        all: [],
        error: error instanceof LoanInputError ? error.message : String(error),
      };
    }
  }, [principal, annualRate, months, method, monthlyFee, upfrontFee, today]);

  const sim = useMemo(() => {
    if (!result.current || prepay <= 0) return null;
    return simulatePrepayment({
      terms: result.terms,
      afterPeriod: Math.min(prepayAfter, months - 1),
      amount: prepay,
      mode: prepayMode,
      feePercent: Math.max(0, parseRate(prepayFee) || 0),
    });
  }, [result, prepay, prepayAfter, prepayMode, prepayFee, months]);

  const s = result.current;
  const even = s ? s.firstPayment === s.maxPayment && s.rows.length > 1 : false;
  const share = s && typical && typical.income > 0 ? s.maxPayment / typical.income : null;
  const rows = s ? (showAll ? s.rows : s.rows.slice(0, 6)) : [];

  return (
    <Screen title="Tính khoản vay">
      <MoneyField label="Số tiền vay" value={principal} onChange={setPrincipal} />

      <SectionTitle>Lãi suất</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <TextField
            icon="trending-up-outline"
            placeholder="vd: 12"
            keyboardType="decimal-pad"
            value={rateText}
            onChangeText={setRateText}
          />
        </View>
        <View style={{ width: 150 }}>
          <SegmentedControl
            options={[
              { value: 'year', label: '%/năm' },
              { value: 'month', label: '%/tháng' },
            ]}
            value={unit}
            onChange={(next) => {
              // Đổi đơn vị thì quy đổi luôn con số để lãi suất không đổi
              if (Number.isFinite(rateInput) && rateText.trim()) {
                setRateText(fmtRate(next === 'year' ? rateInput * 12 : rateInput / 12));
              }
              setUnit(next);
            }}
          />
        </View>
      </View>
      {Number.isFinite(annualRate) && rateText.trim() ? (
        <AppText variant="caption" color="textMuted">
          {unit === 'year'
            ? t('= {rate}%/tháng', { rate: fmtRate(annualRate / 12) })
            : t('= {rate}%/năm', { rate: fmtRate(annualRate) })}
        </AppText>
      ) : null}

      <SectionTitle>Số kỳ (tháng)</SectionTitle>
      <View style={styles.wrap}>
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
      <View style={styles.wrap}>
        {LOAN_METHODS.map((m) => (
          <Chip
            key={m}
            label={METHOD_LABEL[m]}
            selected={method === m}
            onPress={() => setMethod(m)}
          />
        ))}
      </View>
      <AppText variant="caption" color="textMuted">
        {METHOD_HINT[method]}
      </AppText>

      <SectionTitle>Phí (không bắt buộc)</SectionTitle>
      <MoneyField
        label="Phí mỗi tháng (bảo hiểm, quản lý)"
        value={monthlyFee}
        onChange={setMonthlyFee}
      />
      <MoneyField
        label="Phí trừ khi giải ngân (hồ sơ, bảo hiểm)"
        value={upfrontFee}
        onChange={setUpfrontFee}
      />

      {result.error ? (
        <Card>
          <AppText variant="bodyMedium" color="expense">
            {t(result.error)}
          </AppText>
        </Card>
      ) : null}

      {s ? (
        <>
          <Card style={{ gap: 14 }}>
            <View>
              <AppText variant="label" color="textMuted">
                {even ? 'MỖI THÁNG TRẢ' : 'KỲ ĐẦU TRẢ'}
              </AppText>
              <AppText
                variant="hero"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {format.money(s.firstPayment)}
              </AppText>
              {!even ? (
                <AppText variant="caption" color="textMuted">
                  {t('Kỳ cuối {amount}', { amount: format.money(s.lastPayment) })}
                </AppText>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Stat label="Tổng lãi" value={format.money(s.totalInterest)} />
              <Stat label="Tổng phải trả" value={format.money(s.totalPaid)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Stat
                label="Lãi thực / năm"
                value={s.effectiveRate == null ? '—' : `${fmtRate(s.effectiveRate)}%`}
                tone={
                  s.effectiveRate != null && s.effectiveRate > annualRate + 0.5
                    ? 'warning'
                    : undefined
                }
              />
              <Stat
                label="Chiếm thu nhập"
                value={share == null ? '—' : `${Math.round(share * 100)}%`}
                tone={share != null && share > 0.4 ? 'warning' : undefined}
              />
            </View>
            {s.effectiveRate != null && s.effectiveRate > annualRate + 0.5 ? (
              <AppText variant="caption" color="warning">
                {t(
                  'Lãi thực khoảng {real}%/năm, cao hơn mức {quoted}%/năm ghi trên hợp đồng vì lãi tính trên số vay ban đầu hoặc do phí.',
                  { real: fmtRate(s.effectiveRate), quoted: fmtRate(annualRate) },
                )}
              </AppText>
            ) : null}
            {share != null && share > 0.4 ? (
              <AppText variant="caption" color="warning">
                {t('Khoản trả lớn nhất chiếm {pct}% thu nhập trung bình mỗi tháng của bạn.', {
                  pct: Math.round(share * 100),
                })}
              </AppText>
            ) : null}
          </Card>

          <SectionTitle>So sánh các cách tính</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            <View style={[styles.tr, styles.th]}>
              <AppText variant="label" color="textMuted" style={styles.c1}>
                Cách tính
              </AppText>
              <AppText variant="label" color="textMuted" style={styles.cn}>
                Kỳ đầu
              </AppText>
              <AppText variant="label" color="textMuted" style={styles.cn}>
                Tổng lãi
              </AppText>
              <AppText variant="label" color="textMuted" style={styles.cr}>
                Lãi thực
              </AppText>
            </View>
            {result.all.map(({ method: m, summary }) => (
              <View
                key={m}
                style={[styles.tr, m === method && { backgroundColor: colors.surfaceAlt }]}
              >
                <AppText
                  variant="caption"
                  style={styles.c1}
                  numberOfLines={1}
                  onPress={() => setMethod(m)}
                >
                  {METHOD_LABEL[m]}
                </AppText>
                <AppText variant="caption" style={styles.cn}>
                  {format.compact(summary.firstPayment)}
                </AppText>
                <AppText variant="caption" style={styles.cn}>
                  {format.compact(summary.totalInterest)}
                </AppText>
                <AppText variant="caption" style={styles.cr}>
                  {summary.effectiveRate == null ? '—' : `${fmtRate(summary.effectiveRate)}%`}
                </AppText>
              </View>
            ))}
          </Card>

          <SectionTitle>Lịch trả từng kỳ</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            <View style={[styles.tr, styles.th]}>
              <AppText variant="label" color="textMuted" style={styles.ck}>
                Kỳ
              </AppText>
              <AppText variant="label" color="textMuted" style={styles.cn}>
                Gốc
              </AppText>
              <AppText variant="label" color="textMuted" style={styles.cn}>
                Lãi
              </AppText>
              <AppText variant="label" color="textMuted" style={styles.cn}>
                Tổng
              </AppText>
              <AppText variant="label" color="textMuted" style={styles.cr}>
                Còn nợ
              </AppText>
            </View>
            {rows.map((r) => (
              <View key={r.period} style={styles.tr}>
                <View style={styles.ck}>
                  <AppText variant="caption">{r.period}</AppText>
                  {r.date ? (
                    <AppText variant="label" color="textMuted">
                      {formatDate(r.date, false)}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="caption" style={styles.cn}>
                  {format.compact(r.principal)}
                </AppText>
                <AppText variant="caption" style={styles.cn}>
                  {format.compact(r.interest)}
                </AppText>
                <AppText variant="caption" style={styles.cn}>
                  {format.compact(r.payment)}
                </AppText>
                <AppText variant="caption" style={styles.cr}>
                  {format.compact(r.balance)}
                </AppText>
              </View>
            ))}
            {s.rows.length > 6 ? (
              <AppText
                variant="label"
                color="primary"
                style={{ padding: 12, textAlign: 'center' }}
                onPress={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Thu gọn' : t('Xem đủ {n} kỳ', { n: s.rows.length })}
              </AppText>
            ) : null}
          </Card>

          {months > 1 ? (
            <>
              <SectionTitle>Thử trả trước hạn</SectionTitle>
              <MoneyField label="Trả thêm một lần" value={prepay} onChange={setPrepay} />
              <AppText variant="caption" color="textMuted">
                {t('Sau kỳ {k}', { k: Math.min(prepayAfter, months - 1) })}
              </AppText>
              <View style={styles.wrap}>
                {[3, 6, 12, 24]
                  .filter((k) => k < months)
                  .map((k) => (
                    <Chip
                      key={k}
                      label={t('Kỳ {k}', { k })}
                      selected={prepayAfter === k}
                      onPress={() => setPrepayAfter(k)}
                    />
                  ))}
              </View>
              <SegmentedControl
                options={[
                  { value: 'shorten', label: 'Bớt số kỳ' },
                  { value: 'reduce', label: 'Bớt tiền mỗi tháng' },
                ]}
                value={prepayMode}
                onChange={setPrepayMode}
              />
              <TextField
                icon="pricetag-outline"
                placeholder="Phí trả trước (% số trả thêm), vd 3"
                keyboardType="decimal-pad"
                value={prepayFee === '0' ? '' : prepayFee}
                onChangeText={(v) => setPrepayFee(v || '0')}
              />
              {sim ? (
                <Card style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Stat label="Lãi tiết kiệm" value={format.money(sim.interestSaved)} />
                    <Stat label="Phí trả trước" value={format.money(sim.fee)} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Stat
                      label={sim.monthsLeft ? 'Kỳ kế tiếp' : 'Tất toán'}
                      value={sim.monthsLeft ? format.money(sim.nextPayment) : '✓'}
                    />
                    <Stat label="Còn lại" value={t('{n} kỳ', { n: sim.monthsLeft })} />
                  </View>
                  <AppText variant="bodyMedium" color={sim.netSaving > 0 ? 'income' : 'warning'}>
                    {sim.netSaving > 0
                      ? t('Lợi ròng {amount}', { amount: format.money(sim.netSaving) })
                      : t('Không có lợi: phí trả trước lớn hơn lãi tiết kiệm được.')}
                  </AppText>
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const useStyles = createStyles((th) => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  th: {
    borderBottomWidth: 1,
    borderBottomColor: th.colors.border,
  },
  c1: { flex: 1.4 },
  ck: { width: 44 },
  cn: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  cr: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
}));
