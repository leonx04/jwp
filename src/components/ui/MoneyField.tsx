import { useState } from 'react';
import { View } from 'react-native';

import { useMoneyFormat } from '@/features/settings/hooks/useMoneyFormat';
import { groupThousands, parseMoney } from '@/lib/money';

import { AppText } from './AppText';
import { TextField } from './TextField';

type MoneyFieldProps = {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  /** Mặc định bàn phím số. 'default' = bàn phím chữ (để gõ tắt '1tr5', '150k') */
  keyboardType?: 'default' | 'numeric';
};

/** Ô nhập tiền: bàn phím số mặc định, hiểu "1.500.000" (vẫn đọc được "1tr5", "150k" nếu dùng bàn phím chữ) */
export function MoneyField({
  label,
  value,
  onChange,
  placeholder = 'vd: 1.500.000',
  keyboardType = 'numeric',
}: MoneyFieldProps) {
  const format = useMoneyFormat();
  const [text, setText] = useState(value ? groupThousands(value) : '');
  const parsed = text.trim() ? parseMoney(text) : 0;
  const invalid = parsed === null;

  return (
    <View style={{ gap: 4 }}>
      <TextField
        label={label}
        icon="cash-outline"
        keyboardType={keyboardType}
        placeholder={placeholder}
        value={text}
        onChangeText={(next) => {
          setText(next);
          const amount = next.trim() ? parseMoney(next) : 0;
          if (amount !== null && amount >= 0) onChange(amount);
        }}
        onBlur={() => {
          if (!invalid && parsed) setText(groupThousands(parsed));
        }}
      />
      {text.trim() ? (
        <AppText
          variant="caption"
          color={invalid ? 'expense' : 'textMuted'}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {invalid ? 'Không đọc được số tiền' : `= ${format.money(parsed ?? 0)}`}
        </AppText>
      ) : null}
    </View>
  );
}
