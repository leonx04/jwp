// Mục "Đổ xăng" trong màn thêm / sửa giao dịch: nhập giá xăng hôm nay bằng bàn phím số của màn hình
// → số lít + so với lần trước.
import { t } from '@/lib/i18n';
import { View } from 'react-native';

import { AppText, Card, Chip, KeypadField } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { diffDays, toVnDate, todayVn } from '@/lib/date';
import { groupThousands } from '@/lib/money';

import { litersFor, priceChangeText, type LastFuel } from './fuel';

type FuelSectionProps = {
  /** Số tiền đổ xăng */
  amount: number;
  /** Giá xăng hôm nay (đ/lít), 0 = chưa nhập */
  price: number;
  onChange: (price: number) => void;
  last: LastFuel | null;
  /** Bàn phím số đang nhập giá xăng */
  active: boolean;
  onActivate: () => void;
};

export function FuelSection({
  amount,
  price,
  onChange,
  last,
  active,
  onActivate,
}: FuelSectionProps) {
  const format = useMoneyFormat();
  const liters = litersFor(amount, price);
  const daysAgo = last ? diffDays(toVnDate(last.date), todayVn()) : 0;

  return (
    <Card style={{ gap: 8, padding: 10 }}>
      <KeypadField
        icon="mci:gas-station"
        label="Giá xăng hôm nay (đồng / lít)"
        text={price ? groupThousands(price) : ''}
        placeholder="Chạm để nhập, vd 21.350"
        active={active}
        onPress={onActivate}
      />
      {last && price !== last.price ? (
        <View style={{ flexDirection: 'row' }}>
          <Chip
            label={t('Dùng giá lần trước {price}', { price: format.money(last.price) })}
            onPress={() => onChange(last.price)}
          />
        </View>
      ) : null}
      {price > 0 && amount > 0 ? (
        <AppText color="textMuted">
          ≈ {liters.toString().replace('.', ',')} lít
          {last
            ? ` · ${priceChangeText(price, last.price)} (${daysAgo <= 0 ? 'hôm nay' : t('{daysAgo} ngày trước', { daysAgo })})`
            : ''}
        </AppText>
      ) : last ? (
        <AppText variant="caption" color="textMuted">
          Lần đổ trước: {format.money(last.price)}/lít
        </AppText>
      ) : null}
    </Card>
  );
}
