// Khoản nợ có lãi theo kỳ: kỳ phải trả tiếp theo (gốc / lãi / hạn) + nút trả kỳ, tiến độ,
// và bảng lịch trả từng kỳ (kỳ đã trả đánh dấu).
import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { formatDate } from '@/lib/date';
import { createStyles, useTheme } from '@/theme';

import type { DebtItem } from '../queries';

const METHOD_LABEL: Record<string, string> = {
  annuity: 'Trả đều',
  equal_principal: 'Gốc đều',
  flat: 'Lãi phẳng',
  interest_only: 'Gốc cuối kỳ',
};

export function InstallmentCard({ item }: { item: DebtItem }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();
  const [showAll, setShowAll] = useState(false);
  const plan = item.plan;
  const terms = item.terms;
  if (!plan || !terms) return null;
  const next = plan.next;
  const lent = item.direction === 'lent';
  const overdue = next?.status === 'overdue';

  // Bảng gọn: 2 kỳ đã trả gần nhất + 4 kỳ tới
  const start = Math.max(0, plan.paidCount - 2);
  const rows = showAll ? plan.rows : plan.rows.slice(start, start + 6);

  return (
    <>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <AppText variant="label" color={overdue ? 'expense' : 'textMuted'}>
            {next
              ? t('KỲ {period}/{months}', { period: next.period, months: plan.months }) +
                (next.date
                  ? ' · ' +
                    (overdue
                      ? t('QUÁ HẠN {date}', { date: formatDate(next.date, false) })
                      : t('HẠN {date}', { date: formatDate(next.date, false) }))
                  : '')
              : 'ĐÃ TRẢ HẾT CÁC KỲ'}
          </AppText>
          <AppText variant="label" color="textMuted">
            {t('{rate}%/năm · {method}', {
              rate: terms.annualRate.toLocaleString('vi-VN', { maximumFractionDigits: 2 }),
              method: t(METHOD_LABEL[terms.method] ?? terms.method),
            })}
          </AppText>
        </View>
        {next ? (
          <>
            <AppText
              variant="display"
              color={overdue ? 'expense' : 'text'}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {format.money(next.payment)}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {t('Gốc {principal} · lãi {interest}', {
                principal: format.money(next.principal),
                interest: format.money(next.interest + next.fee),
              })}
            </AppText>
            <Button
              title={lent ? 'Đã nhận kỳ này' : 'Trả kỳ này'}
              icon="checkmark"
              variant={next.status === 'upcoming' ? 'secondary' : 'primary'}
              onPress={() =>
                router.push({ pathname: '/debt/installment', params: { debtId: item.debt.id } })
              }
            />
          </>
        ) : null}
        <ProgressBar
          value={plan.months ? plan.paidCount / plan.months : 0}
          color={colors.income}
          height={6}
        />
        <AppText variant="caption" color="textMuted">
          {t('Đã trả {paid}/{months} kỳ · lãi còn phải trả {interest}', {
            paid: plan.paidCount,
            months: plan.months,
            interest: format.money(plan.interestLeft),
          })}
        </AppText>
      </Card>

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
          <AppText variant="label" color="textMuted" style={styles.cn}>
            Còn nợ
          </AppText>
        </View>
        {rows.map((r) => {
          const paid = r.status === 'paid';
          const color = paid ? 'textMuted' : r.status === 'overdue' ? 'expense' : 'text';
          return (
            <View
              key={r.period}
              style={[
                styles.tr,
                r.period === next?.period && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <View style={styles.ck}>
                <AppText variant="caption" color={color}>
                  {paid ? `✓ ${r.period}` : r.period}
                </AppText>
                {r.date ? (
                  <AppText variant="label" color="textMuted">
                    {formatDate(r.date, false)}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="caption" color={color} style={styles.cn}>
                {format.compact(r.principal)}
              </AppText>
              <AppText variant="caption" color={color} style={styles.cn}>
                {format.compact(r.interest + r.fee)}
              </AppText>
              <AppText variant="caption" color={color} style={styles.cn}>
                {format.compact(r.payment)}
              </AppText>
              <AppText variant="caption" color={color} style={styles.cn}>
                {format.compact(r.balance)}
              </AppText>
            </View>
          );
        })}
        {plan.rows.length > 6 ? (
          <AppText
            variant="label"
            color="primary"
            style={{ padding: 12, textAlign: 'center' }}
            onPress={() => setShowAll((v) => !v)}
          >
            {showAll ? 'Thu gọn' : t('Xem đủ {n} kỳ', { n: plan.rows.length })}
          </AppText>
        ) : null}
      </Card>
    </>
  );
}

const useStyles = createStyles((th) => ({
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  th: { borderBottomWidth: 1, borderBottomColor: th.colors.border },
  ck: { width: 52 },
  cn: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
}));
