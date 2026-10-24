// Quỹ Tết & thưởng: nhập thưởng dự kiến + chi phí Tết → mỗi tháng cần để dành bao nhiêu, rồi tạo luôn quỹ tiết kiệm.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, Chip, MoneyField, Screen, SectionTitle, SegmentedControl } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listGoals } from '@/features/goals/queries';
import { saveGoal } from '@/features/goals/repository';
import { getTypicalMonth } from '@/features/salary/queries';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { listTransactions } from '@/features/transactions/queries';
import { addDays, formatDate, lunarYearName, toLunar, todayVn, vnDateToMs } from '@/lib/date';
import { t } from '@/lib/i18n';
import { normalizeForSearch } from '@/lib/text';
import { createStyles, rgba, SWATCH, useTheme } from '@/theme';

import { estimateTetExtraSpend, nextTet, planTet, tetDateOfYear } from './plan';

const COUNT_BONUS = [
  { value: 'yes', label: 'Tính cả thưởng' },
  { value: 'no', label: 'Không dựa vào thưởng' },
] as const;

export function TetPlanScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const startDay = useSettings((s) => s.startDayOfMonth);
  const today = todayVn();
  const tet = useMemo(() => nextTet(today), [today]);
  const tetYear = Number(tet.slice(0, 4));
  const previousTet = tetDateOfYear(tetYear - 1);

  const typical = useMemo(() => getTypicalMonth(db, today, startDay), [today, startDay]);
  const { data: goals = [] } = useLiveData(['goals', 'accounts', 'transactions'], () => listGoals(db, today), [today]);
  const tetGoal = goals.find((g) => normalizeForSearch(g.goal.name).split(' ').includes('tet'));

  // Tết năm ngoái bạn chi thêm bao nhiêu (nếu app có đủ lịch sử)
  const lastYear = useMemo(() => {
    const items = listTransactions(db, {
      from: vnDateToMs(addDays(previousTet, -120)),
      to: vnDateToMs(addDays(previousTet, 8)),
    })
      .filter((r) => r.type === 'expense' && !r.isAdjustment && !r.debtId)
      .map((r) => ({ date: r.date, amount: r.amount }));
    return estimateTetExtraSpend(items, previousTet);
  }, [previousTet]);

  const [bonus, setBonus] = useState(0);
  const [spend, setSpend] = useState(0);
  const [countBonus, setCountBonus] = useState<(typeof COUNT_BONUS)[number]['value']>('yes');
  // Đổi số bằng chip cần dựng lại ô nhập vì ô giữ chữ riêng
  const [fieldKey, setFieldKey] = useState(0);
  const apply = (setter: (n: number) => void, value: number) => {
    setter(value);
    setFieldKey((k) => k + 1);
  };

  const plan = useMemo(
    () =>
      planTet({
        today,
        tet,
        expectedSpend: spend,
        expectedBonus: bonus,
        countBonus: countBonus === 'yes',
        saved: tetGoal?.saved ?? 0,
      }),
    [today, tet, spend, bonus, countBonus, tetGoal],
  );

  const name = t('Quỹ Tết {year}', { year: lunarYearName(toLunar(tet).year) });

  const createFund = () => {
    try {
      saveGoal(db, {
        id: tetGoal?.goal.id,
        name: tetGoal?.goal.name ?? name,
        targetAmount: plan.target,
        accountId: tetGoal?.goal.accountId ?? null,
        savedAmount: tetGoal?.goal.savedAmount ?? 0,
        deadline: plan.deadline,
        color: tetGoal?.goal.color ?? SWATCH.red,
        note: tetGoal?.goal.note ?? null,
      });
      showSnackbar({ text: tetGoal ? t('Đã cập nhật quỹ Tết.') : t('Đã tạo quỹ Tết.'), tone: 'success' });
      router.replace('/goals');
    } catch (e) {
      showSnackbar({ text: e instanceof Error ? e.message : t('Không lưu được.'), tone: 'error' });
    }
  };

  return (
    <Screen title="Quỹ Tết & thưởng" scroll>
      <View style={[styles.hero, { backgroundColor: rgba(SWATCH.red, colors.dark ? 0.22 : 0.12) }]}>
        <AppText variant="label" color="textMuted">
          {t('Tết {year}', { year: lunarYearName(toLunar(tet).year) })}
        </AppText>
        <AppText variant="heading">{formatDate(tet)}</AppText>
        <AppText color="textMuted">{t('Còn {n} ngày', { n: plan.daysToTet })}</AppText>
      </View>

      <SectionTitle>Thưởng dự kiến</SectionTitle>
      <Card>
        <MoneyField key={`b${fieldKey}`} label="Thưởng Tết / lương tháng 13" value={bonus} onChange={setBonus} />
        <View style={styles.chips}>
          <Chip label="Không có" onPress={() => apply(setBonus, 0)} />
          {typical ? (
            <>
              <Chip label="Nửa tháng lương" onPress={() => apply(setBonus, Math.round(typical.income / 2))} />
              <Chip label="1 tháng lương" onPress={() => apply(setBonus, typical.income)} />
              <Chip label="2 tháng lương" onPress={() => apply(setBonus, typical.income * 2)} />
            </>
          ) : null}
        </View>
      </Card>

      <SectionTitle>Chi phí Tết dự kiến</SectionTitle>
      <Card>
        <MoneyField key={`s${fieldKey}`} label="Quà, về quê, lì xì, mua sắm" value={spend} onChange={setSpend} />
        {lastYear && lastYear.extra > 0 ? (
          <View style={styles.chips}>
            <Chip
              label={t('Tết trước bạn chi thêm {amount}', { amount: format.compact(lastYear.extra) })}
              icon="time-outline"
              onPress={() => apply(setSpend, lastYear.extra)}
            />
          </View>
        ) : (
          <AppText variant="caption" color="textMuted">
            Chưa đủ lịch sử Tết trước để gợi ý, hãy nhập theo ước tính của bạn.
          </AppText>
        )}
      </Card>

      {spend > 0 ? (
        <>
          <SegmentedControl options={COUNT_BONUS} value={countBonus} onChange={setCountBonus} />
          <View style={[styles.hero, { backgroundColor: colors.gradient[1] }]}>
            <AppText variant="label" style={{ color: rgba(colors.onGradient, 0.75) }}>
              {plan.covered ? 'Thưởng đã đủ trang trải' : 'Cần để dành mỗi tháng'}
            </AppText>
            <AppText
              variant="display"
              style={{ color: colors.onGradient, fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {format.money(plan.perMonth)}
            </AppText>
            <AppText variant="caption" style={{ color: rgba(colors.onGradient, 0.85) }}>
              {t('trong {n} tháng tới, đủ trước {date}', { n: plan.monthsLeft, date: formatDate(plan.deadline) })}
            </AppText>
          </View>

          <Card>
            <Row label="Chi phí dự kiến" value={format.money(spend)} />
            <Row label="Thưởng dự kiến" value={`−${format.money(countBonus === 'yes' ? bonus : 0)}`} />
            {tetGoal ? <Row label="Đã có trong quỹ" value={`−${format.money(tetGoal.saved)}`} /> : null}
            <Row label="Còn phải để dành" value={format.money(plan.remaining)} strong />
            {typical && typical.income > 0 && plan.perMonth > 0 ? (
              <AppText variant="caption" color="textMuted">
                {t('Bằng khoảng {pct}% thu nhập mỗi tháng của bạn.', {
                  pct: Math.round((plan.perMonth / typical.income) * 100),
                })}
              </AppText>
            ) : null}
          </Card>

          {plan.target > 0 ? (
            <Button
              title={tetGoal ? 'Cập nhật quỹ Tết' : 'Tạo quỹ Tết'}
              icon="flag-outline"
              onPress={createFund}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <AppText color={strong ? 'text' : 'textMuted'} variant={strong ? 'heading' : 'body'}>
        {label}
      </AppText>
      <AppText variant={strong ? 'heading' : 'body'} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
    </View>
  );
}

const useStyles = createStyles((th) => ({
  hero: { borderRadius: 24, padding: th.spacing.lg, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: th.spacing.md },
}));
