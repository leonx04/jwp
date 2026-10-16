// Mục "Trả góp" trong màn thêm giao dịch (chỉ hiện với khoản CHI từ ví trả sau).
// Màn editor giữ `value` trong draft; khi lưu: ghi CHI tổng tiền (giá + phí) rồi saveInstallmentPlan
// (xem installmentDraft.ts → installmentToSave).
import { t } from '@/lib/i18n';
import { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, Card, Chip, MoneyField, SwitchRow } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { useMoneyFormat } from '@/features/settings';
import { formatDate, toVnDate } from '@/lib/date';
import { createStyles } from '@/theme';

import { firstInstallmentDue, installmentAmounts } from '../statement';
import { DEFAULT_INSTALLMENT, INSTALLMENT_MONTHS, type InstallmentValue } from './installmentDraft';

type InstallmentSectionProps = {
  /** Ví đang chọn — mục chỉ hiện khi đây là ví trả sau */
  accountId: string | null;
  /** Giá mua (chưa gồm phí) — số tiền đang nhập trong editor */
  amount: number;
  /** null = không trả góp */
  value: InstallmentValue | null;
  onChange: (value: InstallmentValue | null) => void;
  /** Thời điểm mua (ms) để tính kỳ góp đầu tiên. Mặc định: bây giờ */
  date?: number;
};

export function InstallmentSection({
  accountId,
  amount,
  value,
  onChange,
  date,
}: InstallmentSectionProps) {
  const styles = useStyles();
  const format = useMoneyFormat();
  const { data: account } = useLiveData(
    ['accounts'],
    () => (accountId ? (listAccounts(db).find((a) => a.id === accountId) ?? null) : null),
    [accountId],
  );
  const isCredit = !!account?.isCredit;

  // Đổi sang ví thường → bỏ trả góp để editor không lưu nhầm kế hoạch
  useEffect(() => {
    if (account !== undefined && !isCredit && value) onChange(null);
  }, [account, isCredit, value, onChange]);

  const months = useMemo(() => {
    const list: number[] = [...INSTALLMENT_MONTHS];
    if (value && !list.includes(value.months)) list.push(value.months);
    return list.sort((a, b) => a - b);
  }, [value]);

  if (!isCredit || !account) return null;

  const plan =
    value && amount > 0 ? installmentAmounts(amount, value.months, value.monthlyFee) : null;
  const firstDue = firstInstallmentDue(
    toVnDate(date ?? Date.now()),
    account.statementDay,
    account.dueDay,
  );

  return (
    <Card style={styles.card}>
      <SwitchRow
        icon="layers-outline"
        title="Trả góp"
        subtitle={
          value
            ? t('Chia thành {months} kỳ trong bill {name}', {
                months: value.months,
                name: account.name,
              })
            : 'Chia khoản mua thành nhiều kỳ'
        }
        value={!!value}
        onValueChange={(on) => onChange(on ? (value ?? DEFAULT_INSTALLMENT) : null)}
      />
      {value ? (
        <View style={styles.body}>
          <AppText variant="label" color="textMuted">
            Số kỳ
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled"
          >
            {months.map((m) => (
              <Chip
                key={m}
                label={t('{m} tháng', { m })}
                selected={value.months === m}
                onPress={() => onChange({ ...value, months: m })}
              />
            ))}
          </ScrollView>

          <MoneyField
            label="Phí mỗi tháng"
            value={value.monthlyFee}
            onChange={(monthlyFee) => onChange({ ...value, monthlyFee })}
            placeholder="0 nếu trả góp 0%"
          />

          {plan ? (
            <View style={styles.summary}>
              <Row
                label="Mỗi kỳ"
                value={`${format.money(plan.perMonth)} × ${value.months}`}
                strong
              />
              <Row
                label="Tổng phải trả"
                value={
                  plan.fee > 0
                    ? t('{total} (phí {fee})', {
                        total: format.money(plan.total),
                        fee: format.compact(plan.fee),
                      })
                    : format.money(plan.total)
                }
              />
              <Row
                label="Kỳ đầu tiên"
                value={t('hạn {firstDue}', { firstDue: formatDate(firstDue) })}
              />
              <AppText variant="caption" color="textMuted">
                Khoản chi ghi tổng tiền (giá + phí). Bill mỗi kỳ chỉ tính phần góp tới hạn.
              </AppText>
            </View>
          ) : (
            <AppText variant="caption" color="textMuted">
              Nhập giá mua để xem số tiền mỗi kỳ.
            </AppText>
          )}
        </View>
      ) : null}
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant={strong ? 'bodyMedium' : 'caption'} style={styles.value} numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  card: {
    gap: 0,
    paddingVertical: t.spacing.xs,
  },
  body: {
    gap: t.spacing.sm,
    paddingBottom: t.spacing.md,
  },
  chips: {
    gap: t.spacing.sm,
  },
  summary: {
    gap: 6,
    marginTop: t.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
}));
