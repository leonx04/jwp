// Chọn logo ngân hàng / ví điện tử cho ví: hàng phổ biến + mở rộng để tìm trong toàn bộ danh sách.
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, BankMark, TextField } from '@/components/ui';
import { BANKS, bankFromIcon, bankIcon, detectBank, type Bank } from '@/lib/banks';
import { normalizeForSearch } from '@/lib/text';
import { useTheme } from '@/theme';

/** Hay dùng nhất ở VN (ưu tiên ví trả sau / ví điện tử người dùng app này hay xài) */
const POPULAR = ['MB', 'TCB', 'VCB', 'TPB', 'BIDV', 'ICB', 'ACB', 'VPB', 'MOMO', 'SHOPEEPAY', 'ZALOPAY', 'CAKE', 'TIMO', 'VBA', 'STB'];

const POPULAR_BANKS = POPULAR.map((code) => BANKS.find((b) => b.code === code)).filter(
  (b): b is Bank => !!b,
);

type BankPickerProps = {
  /** Icon hiện tại của ví */
  value: string;
  onChange: (bank: Bank | null) => void;
};

export function BankPicker({ value, onChange }: BankPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const selected = bankFromIcon(value);

  const list = useMemo(() => {
    if (!expanded) {
      // Ví đang dùng logo không nằm trong nhóm phổ biến → vẫn hiện ở đầu
      return selected && !POPULAR.includes(selected.code) ? [selected, ...POPULAR_BANKS] : POPULAR_BANKS;
    }
    const q = normalizeForSearch(query).trim();
    if (!q) return BANKS;
    return BANKS.filter(
      (b) => normalizeForSearch(b.name).includes(q) || b.keywords.some((k) => k.includes(q)) || b.code.toLowerCase().includes(q),
    );
  }, [expanded, query, selected]);

  return (
    <View style={{ gap: 12 }}>
      {expanded ? (
        <TextField
          icon="search"
          placeholder="Tìm ngân hàng, ví điện tử…"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
        {list.map((bank) => (
          <BankOption
            key={bank.code}
            bank={bank}
            selected={selected?.code === bank.code}
            onPress={() => onChange(selected?.code === bank.code ? null : bank)}
          />
        ))}
        {list.length === 0 ? (
          <AppText variant="caption" color="textMuted">
            Không tìm thấy “{query}”
          </AppText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setExpanded((v) => !v);
          setQuery('');
        }}
        hitSlop={8}
        style={{ alignSelf: 'flex-start' }}
      >
        <AppText variant="bodyMedium" color="primary">
          {expanded ? 'Thu gọn' : `Xem tất cả ${BANKS.length} ngân hàng & ví`}
        </AppText>
      </Pressable>
    </View>
  );
}

function BankOption({ bank, selected, onPress }: { bank: Bank; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={bank.name}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({ width: '20%', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}
    >
      <View
        style={{
          padding: 3,
          borderRadius: 20,
          borderWidth: 2,
          borderColor: selected ? colors.primary : 'transparent',
        }}
      >
        <BankMark bank={bank} size={44} />
      </View>
      <AppText
        variant="label"
        color={selected ? 'text' : 'textMuted'}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ fontSize: 11, maxWidth: '100%', paddingHorizontal: 2 }}
      >
        {bank.name}
      </AppText>
    </Pressable>
  );
}

/** Gợi ý logo theo tên ví — chỉ khi ví chưa dùng đúng logo đó */
export function suggestedBank(name: string, icon: string): Bank | null {
  const bank = detectBank(name);
  return bank && icon !== bankIcon(bank.code) ? bank : null;
}
