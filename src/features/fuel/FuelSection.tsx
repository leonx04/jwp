// Mục "Đổ xăng" trong màn thêm / sửa giao dịch: nhập giá xăng hôm nay → số lít + so với lần trước.
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Card, Chip, MoneyField } from '@/components/ui';
import { useMoneyFormat } from '@/features/settings';
import { diffDays, toVnDate, todayVn } from '@/lib/date';

import { litersFor, priceChangeText, type LastFuel } from './fuel';

type FuelSectionProps = {
  /** Số tiền đổ xăng */
  amount: number;
  /** Giá xăng hôm nay (đ/lít), 0 = chưa nhập */
  price: number;
  onChange: (price: number) => void;
  last: LastFuel | null;
};

export function FuelSection({ amount, price, onChange, last }: FuelSectionProps) {
  const format = useMoneyFormat();
  // MoneyField giữ chữ riêng → đổi key để hiện lại giá khi bấm "Dùng giá lần trước"
  const [version, setVersion] = useState(0);
  const liters = litersFor(amount, price);
  const daysAgo = last ? diffDays(toVnDate(last.date), todayVn()) : 0;

  return (
    <Card style={{ gap: 10 }}>
      <AppText variant="bodyMedium">⛽ Giá xăng hôm nay</AppText>
      <MoneyField
        key={version}
        label="Đồng / lít"
        value={price}
        onChange={onChange}
        placeholder="vd: 21.350"
      />
      {last && price !== last.price ? (
        <View style={{ flexDirection: 'row' }}>
          <Chip
            label={`Dùng giá lần trước ${format.money(last.price)}`}
            onPress={() => {
              onChange(last.price);
              setVersion((v) => v + 1);
            }}
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
      ) : (
        <AppText variant="caption" color="textMuted">
          Nhập giá để ghi vào ghi chú và tính số lít.
        </AppText>
      )}
    </Card>
  );
}
