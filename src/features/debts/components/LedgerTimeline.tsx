// Lịch sử một khoản nợ dạng dòng thời gian: mới nhất ở trên, gom theo tháng,
// mỗi dòng có số tiền có dấu, dư nợ sau lần đó và nhãn trả sớm / trễ so với hạn.
import { t } from '@/lib/i18n';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { DebtDirection } from '@/db/schema';
import { useMoneyFormat } from '@/features/settings';
import { formatDate, formatMonth, toVnDate, type DateString } from '@/lib/date';
import { createStyles, useTheme } from '@/theme';

import { groupByMonth, repayTiming, type LedgerEntry, type LedgerRecord } from '../compute';
import { DIRECTION_LABEL, recordLabel } from './display';

type Props<R extends LedgerRecord> = {
  entries: readonly LedgerEntry<R>[];
  direction: DebtDirection;
  dueDate: DateString | null;
  /** Chạm một lần ghi (không áp dụng cho dòng khoản gốc) */
  onPressRecord?: (record: R) => void;
};

export function LedgerTimeline<R extends LedgerRecord>({
  entries,
  direction,
  dueDate,
  onPressRecord,
}: Props<R>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const format = useMoneyFormat();

  const tone = (kind: LedgerEntry['kind']) =>
    kind === 'repay' ? colors.income : kind === 'interest' ? colors.warning : colors.primary;

  return (
    <View style={{ gap: 14 }}>
      {groupByMonth(entries).map((group) => {
        let paid = 0;
        let added = 0;
        for (const e of group.items) {
          if (e.kind === 'repay') paid += e.amount;
          else if (e.kind !== 'open') added += e.amount;
        }
        const summary = [
          paid ? `${t('trả')} ${format.money(paid)}` : '',
          added ? `${t('thêm')} ${format.money(added)}` : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <View key={group.month}>
            <View style={styles.monthRow}>
              <AppText variant="label" color="textMuted">
                {formatMonth(`${group.month}-01`).toUpperCase()}
              </AppText>
              {summary ? (
                <AppText variant="label" color="textMuted">
                  {summary}
                </AppText>
              ) : null}
            </View>
            {group.items.map((e, i) => {
              const color = tone(e.kind);
              const isLast = i === group.items.length - 1;
              const timing = e.kind === 'repay' ? repayTiming(e.date, dueDate) : null;
              const record = e.record;
              const base =
                e.kind === 'open' ? DIRECTION_LABEL[direction] : recordLabel(direction, e.kind);
              const title = record?.period
                ? `${base} · ${t('kỳ {period}', { period: record.period })}`
                : base;
              return (
                <Pressable
                  key={e.key}
                  disabled={!record || !onPressRecord}
                  onPress={() => record && onPressRecord?.(record)}
                  accessibilityRole={record && onPressRecord ? 'button' : undefined}
                  accessibilityHint={record && onPressRecord ? t('Sửa lần ghi này') : undefined}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.rail}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    {!isLast ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.body}>
                    <View style={styles.line1}>
                      <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                        {title}
                      </AppText>
                      <AppText
                        variant="bodyMedium"
                        style={{ color, fontVariant: ['tabular-nums'] }}
                        numberOfLines={1}
                      >
                        {e.kind === 'repay' ? '−' : '+'}
                        {format.money(e.amount)}
                      </AppText>
                    </View>
                    <View style={styles.line1}>
                      <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
                        {formatDate(toVnDate(e.date))}
                        {timing ? ` · ${timingText(timing)}` : ''}
                      </AppText>
                      <AppText
                        variant="caption"
                        color="textMuted"
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {e.balanceAfter < 0
                          ? t('dư {amount}', { amount: format.money(-e.balanceAfter) })
                          : t('còn {amount}', { amount: format.money(e.balanceAfter) })}
                      </AppText>
                    </View>
                    {e.note ? (
                      <AppText variant="caption" color="textMuted" numberOfLines={2}>
                        {e.note}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function timingText({ kind, days }: NonNullable<ReturnType<typeof repayTiming>>): string {
  if (kind === 'on-time') return t('đúng hạn');
  return kind === 'early' ? t('trả sớm {days} ngày', { days }) : t('trễ {days} ngày', { days });
}

const useStyles = createStyles((th) => ({
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: th.spacing.sm,
    marginBottom: th.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: th.spacing.md,
  },
  rail: {
    width: 12,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: 4,
    borderRadius: 1,
    backgroundColor: th.colors.border,
  },
  body: {
    flex: 1,
    gap: 2,
    paddingBottom: th.spacing.md,
  },
  line1: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: th.spacing.sm,
  },
}));
