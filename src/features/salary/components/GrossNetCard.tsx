// Đổi lương gộp ⇄ thực nhận (bảo hiểm + thuế TNCN) để điền "Thu nhập mới" đúng số tiền về tay. Chỉ ước tính.
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, MoneyField, SegmentedControl } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { createStyles } from '@/theme';

import { grossToNet, netToGross } from '../tax';

const MODES = [
  { value: 'gross', label: 'Gộp → thực nhận' },
  { value: 'net', label: 'Thực nhận → gộp' },
] as const;

const DEPENDENTS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3+' },
] as const;

type Props = {
  /** Điền số thực nhận vào ô thu nhập (hiện tại / mới) */
  onUseNet: (net: number, target: 'current' | 'new') => void;
};

export function GrossNetCard({ onUseNet }: Props) {
  const styles = useStyles();
  const format = useMoneyFormat();
  const [mode, setMode] = useState<(typeof MODES)[number]['value']>('gross');
  const [amount, setAmount] = useState(0);
  const [dependents, setDependents] = useState<(typeof DEPENDENTS)[number]['value']>('0');

  const result = useMemo(() => {
    if (amount <= 0) return null;
    const deps = Number(dependents);
    return mode === 'gross' ? grossToNet(amount, deps) : netToGross(amount, deps);
  }, [amount, mode, dependents]);

  const rows: [string, string][] = result
    ? [
        ['Lương gộp', format.money(result.gross)],
        ['BHXH 8%', `−${format.money(result.bhxh)}`],
        ['BHYT 1,5%', `−${format.money(result.bhyt)}`],
        ['BHTN 1%', `−${format.money(result.bhtn)}`],
        ['Thuế TNCN', `−${format.money(result.pit)}`],
      ]
    : [];

  return (
    <Card>
      <SegmentedControl options={MODES} value={mode} onChange={setMode} />
      <MoneyField
        key={mode}
        label={mode === 'gross' ? 'Lương gộp (trước thuế, bảo hiểm)' : 'Lương thực nhận mong muốn'}
        value={amount}
        onChange={setAmount}
      />
      <AppText variant="label" color="textMuted">
        Số người phụ thuộc
      </AppText>
      <SegmentedControl options={DEPENDENTS} value={dependents} onChange={setDependents} />

      {result ? (
        <>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <AppText color="textMuted">{label}</AppText>
              <AppText style={styles.value}>{value}</AppText>
            </View>
          ))}
          <View style={styles.row}>
            <AppText variant="heading">Thực nhận</AppText>
            <AppText variant="heading" color="income" style={styles.value}>
              {format.money(result.net)}
            </AppText>
          </View>
          <View style={styles.buttons}>
            <Button
              title="Dùng làm thu nhập mới"
              size="sm"
              variant="secondary"
              onPress={() => onUseNet(result.net, 'new')}
            />
            <Button
              title="Dùng làm thu nhập hiện tại"
              size="sm"
              variant="secondary"
              onPress={() => onUseNet(result.net, 'current')}
            />
          </View>
          <AppText variant="caption" color="textMuted">
            Ước tính theo giảm trừ 15,5 triệu (bản thân) và 6,2 triệu (mỗi người phụ thuộc), biểu thuế 5 bậc,
            bảo hiểm người lao động 10,5% có trần. Chưa tính phụ cấp miễn thuế, thưởng, làm thêm giờ — hãy đối
            chiếu với phiếu lương của bạn.
          </AppText>
        </>
      ) : null}
    </Card>
  );
}

const useStyles = createStyles((th) => ({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: th.spacing.md },
  value: { fontVariant: ['tabular-nums'] },
  buttons: { gap: th.spacing.sm },
}));
