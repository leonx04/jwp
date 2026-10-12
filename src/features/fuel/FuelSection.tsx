// Mục "Đổ xăng" trong màn thêm / sửa giao dịch: nhập giá xăng hôm nay bằng bàn phím số của màn hình
// → số lít + so với lần trước.
import { View } from 'react-native';

import { AppText, Card, Chip, IconBadge, KeypadField } from '@/components/ui';
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
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBadge icon="mci:gas-station" color="#DC2626" size={32} />
        <AppText variant="bodyMedium">Giá xăng hôm nay</AppText>
      </View>
      <KeypadField
        icon="mci:gas-station"
        label="Đồng / lít (nhập bằng bàn phím số bên dưới)"
        text={price ? groupThousands(price) : ''}
        placeholder="Chạm để nhập, vd 21.350"
        active={active}
        onPress={onActivate}
      />
      {last && price !== last.price ? (
        <View style={{ flexDirection: 'row' }}>
          <Chip
            label={`Dùng giá lần trước ${format.money(last.price)}`}
            onPress={() => onChange(last.price)}
          />
        </View>
      ) : null}
      {price > 0 && amount > 0 ? (
        <AppText color="textMuted">
          ≈ {liters.toString().replace('.', ',')} lít
          {last
            ? ` · ${priceChangeText(price, last.price)} (${daysAgo <= 0 ? 'hôm nay' : `${daysAgo} ngày trước`})`
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
