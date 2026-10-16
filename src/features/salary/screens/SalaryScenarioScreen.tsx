// Mô phỏng tăng lương: nhập lương mới + tháng có hiệu lực → xem 12 tháng tới thu / chi / tiền dư thay đổi ra sao,
// tỷ lệ tiết kiệm và các quỹ đạt mục tiêu sớm hơn bao lâu. Chỉ tính toán, không đổi dữ liệu thật.
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
  SelectField,
} from '@/components/ui';
import { db } from '@/db';
import { useAccountBalances } from '@/features/accounts/hooks/useAccountBalances';
import { totalBalance } from '@/features/accounts/queries';
import { useGoals } from '@/features/goals/hooks';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { addMonths, makeDate, parseDate, todayVn } from '@/lib/date';
import { t } from '@/lib/i18n';
import { createStyles, rgba, useTheme } from '@/theme';

import { projectSalary } from '../projection';
import { runwayMonths } from '../runway';
import { getTypicalMonth } from '../queries';

const RAISE_STEPS = [5, 10, 20, 30] as const;

const SPEND_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '25', label: '25%' },
  { value: '50', label: '50%' },
  { value: '75', label: '75%' },
] as const;

const YEARLY_OPTIONS = [
  { value: '0', label: 'Không' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
] as const;

/** 12 tháng tới làm lựa chọn "có hiệu lực từ" */
function monthOptions(today: string) {
  const { year, month } = parseDate(today);
  const first = makeDate(year, month, 1);
  return Array.from({ length: 12 }, (_, i) => {
    const date = addMonths(first, i);
    const p = parseDate(date);
    return { id: date, label: t('Tháng {month}/{year}', { month: p.month, year: p.year }) };
  });
}

const shortMonth = (key: string) => `${key.slice(5)}/${key.slice(2, 4)}`;

export function SalaryScenarioScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const startDay = useSettings((s) => s.startDayOfMonth);
  const today = todayVn();
  const typical = useMemo(() => getTypicalMonth(db, today, startDay), [today, startDay]);
  const { data: goals = [] } = useGoals();
  const { data: balances = [] } = useAccountBalances();

  const [income, setIncome] = useState(typical?.income ?? 0);
  const [expense, setExpense] = useState(typical?.expense ?? 0);
  const [newIncome, setNewIncome] = useState(Math.round((typical?.income ?? 0) * 1.1));
  // Đổi số bằng nút gợi ý (+10%…) cần dựng lại ô nhập vì ô giữ chữ riêng
  const [fieldKey, setFieldKey] = useState(0);
  const options = useMemo(() => monthOptions(today), [today]);
  const [from, setFrom] = useState(options[1]?.id ?? options[0].id);
  const [spend, setSpend] = useState<(typeof SPEND_OPTIONS)[number]['value']>('25');
  const [yearly, setYearly] = useState<(typeof YEARLY_OPTIONS)[number]['value']>('0');

  const projection = useMemo(
    () =>
      projectSalary({
        today,
        currentIncome: income,
        newIncome,
        effectiveFrom: from,
        currentExpense: expense,
        extraSpendRatio: Number(spend) / 100,
        yearlyRaisePct: Number(yearly),
        goals: goals
          .filter((g) => !g.done)
          .map((g) => ({ id: g.goal.id, name: g.goal.name, remaining: g.remaining })),
      }),
    [today, income, newIncome, from, expense, spend, yearly, goals],
  );

  const runway = runwayMonths(totalBalance(balances), expense);
  const extra = projection.extraSurplusPerMonth;
  const valid = income > 0 && newIncome > 0;

  return (
    <Screen title="Mô phỏng tăng lương">
      <AppText variant="caption" color="textMuted">
        {typical
          ? t(
              'Số liệu lấy từ trung bình {n} tháng gần nhất của bạn. Bạn có thể sửa để thử các kịch bản.',
              {
                n: typical.months,
              },
            )
          : 'Chưa đủ dữ liệu thu chi, hãy nhập tay thu nhập và chi tiêu hằng tháng.'}
      </AppText>

      <SectionTitle>Hiện tại</SectionTitle>
      <Card>
        <MoneyField
          key={`i${fieldKey}`}
          label="Thu nhập mỗi tháng"
          value={income}
          onChange={setIncome}
        />
        <MoneyField
          key={`e${fieldKey}`}
          label="Chi tiêu mỗi tháng"
          value={expense}
          onChange={setExpense}
        />
      </Card>

      <SectionTitle>Sau khi tăng lương</SectionTitle>
      <Card>
        <MoneyField
          key={`n${fieldKey}`}
          label="Thu nhập mới mỗi tháng"
          value={newIncome}
          onChange={setNewIncome}
        />
        <View style={styles.chips}>
          {RAISE_STEPS.map((pct) => (
            <Chip
              key={pct}
              label={`+${pct}%`}
              onPress={() => {
                setNewIncome(Math.round(income * (1 + pct / 100)));
                setFieldKey((k) => k + 1);
              }}
            />
          ))}
        </View>
        <SelectField
          label="Có hiệu lực từ"
          title="Có hiệu lực từ tháng"
          placeholder="Chọn tháng"
          icon="calendar-outline"
          options={options}
          value={from}
          onChange={(value) => setFrom(value ?? options[0].id)}
          clearable={false}
        />
        <AppText variant="label" color="textMuted">
          Phần tăng thêm bạn sẽ tiêu thêm
        </AppText>
        <SegmentedControl options={SPEND_OPTIONS} value={spend} onChange={setSpend} />
        <AppText variant="label" color="textMuted">
          Tăng thêm mỗi năm sau đó
        </AppText>
        <SegmentedControl options={YEARLY_OPTIONS} value={yearly} onChange={setYearly} />
      </Card>

      {valid ? (
        <>
          <SectionTitle>Kết quả 12 tháng tới</SectionTitle>
          <View style={[styles.hero, { backgroundColor: colors.gradient[1] }]}>
            <AppText variant="label" style={{ color: rgba(colors.onGradient, 0.75) }}>
              Mỗi tháng dư thêm
            </AppText>
            <AppText
              variant="display"
              style={{ color: colors.onGradient, fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {`${extra >= 0 ? '+' : '−'}${format.money(Math.abs(extra))}`}
            </AppText>
            <AppText variant="caption" style={{ color: rgba(colors.onGradient, 0.85) }}>
              {t('Cả giai đoạn để dành thêm {amount}', {
                amount: format.money(projection.totalExtraSaved),
              })}
            </AppText>
          </View>

          <View style={styles.tiles}>
            <Tile
              label="Tỷ lệ tiết kiệm trước"
              value={`${Math.round(projection.baseSavingRate * 100)}%`}
              tone={colors.textMuted}
            />
            <Tile
              label="Tỷ lệ tiết kiệm sau"
              value={`${Math.round(projection.savingRate * 100)}%`}
              tone={colors.income}
            />
          </View>

          {runway ? (
            <Tile
              label="Quỹ dự phòng: số dư hiện có đủ sống"
              value={t('{months} tháng', { months: runway.months })}
              tone={
                runway.level === 'low'
                  ? colors.expense
                  : runway.level === 'ok'
                    ? colors.warning
                    : colors.income
              }
            />
          ) : null}

          {projection.goals.length ? (
            <>
              <SectionTitle>Quỹ tiết kiệm đạt mục tiêu</SectionTitle>
              <Card>
                {projection.goals.map((g) => (
                  <View key={g.id} style={{ gap: 2 }}>
                    <AppText variant="bodyMedium">{g.name}</AppText>
                    <AppText variant="caption" color="textMuted">
                      {goalLine(g.baseMonths, g.months, g.monthsEarlier)}
                    </AppText>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionTitle>Từng tháng</SectionTitle>
          <Card padded={false}>
            {projection.months.map((m) => (
              <View key={m.month} style={styles.row}>
                <AppText variant="bodyMedium" style={{ width: 56 }}>
                  {shortMonth(m.month)}
                </AppText>
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" color="textMuted" numberOfLines={1}>
                    {t('Thu {income} · Chi {expense}', {
                      income: format.compact(m.income),
                      expense: format.compact(m.expense),
                    })}
                  </AppText>
                </View>
                <AppText
                  variant="bodyMedium"
                  style={{
                    color: m.surplus >= m.baseSurplus ? colors.income : colors.expense,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {format.compact(m.surplus)}
                </AppText>
              </View>
            ))}
          </Card>
          <AppText variant="caption" color="textMuted">
            Đây là ước tính: chi tiêu giữ ở mức trung bình hiện tại và chỉ tăng theo phần bạn chọn
            tiêu thêm. Các khoản hoá đơn lớn bất thường chưa được tính.
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}

function goalLine(base: number | null, scenario: number | null, earlier: number | null): string {
  if (scenario == null) return t('Chưa đạt được trong 10 năm với mức dư hiện tại');
  if (base == null)
    return t('Đạt sau {months} tháng (hiện tại không đạt được)', { months: scenario });
  if (earlier && earlier > 0) {
    return t('{base} tháng → {months} tháng (sớm hơn {earlier} tháng)', {
      base,
      months: scenario,
      earlier,
    });
  }
  return t('Đạt sau {months} tháng', { months: scenario });
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: rgba(tone, colors.dark ? 0.16 : 0.1) }]}>
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      <AppText variant="title" style={{ color: tone, fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  hero: {
    padding: t.spacing.xl,
    borderRadius: t.radius.xl,
    gap: t.spacing.xs,
  },
  tiles: { flexDirection: 'row', gap: t.spacing.md },
  tile: {
    flex: 1,
    padding: t.spacing.lg,
    borderRadius: t.radius.xl,
    gap: t.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm + 2,
  },
}));
