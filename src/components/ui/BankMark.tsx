// Logo ngân hàng / ví điện tử trong ô bo góc. Nền trắng để logo giữ đúng màu thương hiệu
// (như icon ứng dụng); ví điện tử chưa có logo thì dùng chữ viết tắt trên màu thương hiệu.
import { Image, StyleSheet, Text, View } from 'react-native';

import { bankLogo, type Bank } from '@/lib/banks';
import { fonts, useTheme } from '@/theme';

export function BankMark({ bank, size }: { bank: Bank; size: number }) {
  const { colors, dark } = useTheme();
  const logo = bankLogo(bank);
  const box = {
    width: size,
    height: size,
    borderRadius: size / 2.6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as const;

  if (logo) {
    return (
      <View
        style={[
          box,
          {
            backgroundColor: '#FFFFFF',
            // Nền sáng: viền mảnh để ô trắng không chìm vào thẻ trắng
            borderWidth: dark ? 0 : StyleSheet.hairlineWidth * 2,
            borderColor: colors.border,
          },
        ]}
        accessibilityLabel={bank.name}
      >
        <Image
          source={logo}
          style={{ width: size * 0.82, height: size * 0.82 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  const text = bank.monogram ?? bank.code.slice(0, 3);
  const scale = text.length <= 1 ? 0.52 : text.length <= 2 ? 0.4 : text.length <= 4 ? 0.29 : 0.24;
  return (
    <View style={[box, { backgroundColor: bank.color }]} accessibilityLabel={bank.name}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={{ color: '#FFFFFF', fontFamily: fonts.bold, fontSize: size * scale }}
      >
        {text}
      </Text>
    </View>
  );
}
