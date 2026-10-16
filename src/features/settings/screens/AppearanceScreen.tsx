import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, useColorScheme, View } from 'react-native';

import {
  AmountText,
  AppText,
  Card,
  Screen,
  SectionTitle,
  SegmentedControl,
  SwitchRow,
} from '@/components/ui';
import { CURRENCY_SYMBOLS, type CurrencySymbol } from '@/lib/money';
import { ACCENTS, ACCENT_KEYS, createStyles, useTheme, type ThemePreference } from '@/theme';

import { useSettings } from '../store';

const THEME_OPTIONS = [
  { value: 'system', label: 'Hệ thống' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

const SYMBOL_OPTIONS = CURRENCY_SYMBOLS.map((symbol) => ({ value: symbol, label: symbol }));

export function AppearanceScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const systemScheme = useColorScheme();
  const settings = useSettings();
  const willBeDark =
    settings.themePreference === 'dark' ||
    (settings.themePreference === 'system' && systemScheme === 'dark');

  return (
    <Screen title="Giao diện">
      <SectionTitle>Chế độ</SectionTitle>
      <Card>
        <SegmentedControl
          options={THEME_OPTIONS}
          value={settings.themePreference}
          onChange={settings.setThemePreference}
        />
        <SwitchRow
          icon="moon-outline"
          title="Đen tuyền (AMOLED)"
          subtitle={
            willBeDark
              ? 'Nền đen hoàn toàn, tiết kiệm pin trên màn OLED'
              : 'Chỉ áp dụng khi đang ở chế độ tối'
          }
          value={settings.amoled}
          onValueChange={settings.setAmoled}
        />
      </Card>

      <SectionTitle>Thu chi</SectionTitle>
      <Card>
        <SwitchRow
          icon="swap-horizontal-outline"
          title="Tính chuyển khoản là thu / chi"
          subtitle="Tắt (khuyên dùng): chuyển giữa các ví của bạn không làm tăng thu hay chi"
          value={settings.transfersAsIncomeExpense}
          onValueChange={(transfersAsIncomeExpense) =>
            settings.update({ transfersAsIncomeExpense })
          }
        />
      </Card>

      <SectionTitle>Màu chủ đạo</SectionTitle>
      <Card>
        <View style={styles.swatches}>
          {ACCENT_KEYS.map((key) => {
            const selected = key === settings.accent;
            const color = theme.dark ? ACCENTS[key].dark : ACCENTS[key].light;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={ACCENTS[key].name}
                accessibilityState={{ selected }}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  settings.setAccent(key);
                }}
                style={styles.swatchCell}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    selected && { borderColor: theme.colors.text },
                  ]}
                >
                  {selected && (
                    <Ionicons name="checkmark" size={20} color={theme.colors.onPrimary} />
                  )}
                </View>
                <AppText
                  variant="caption"
                  color={selected ? 'text' : 'textMuted'}
                  numberOfLines={1}
                >
                  {ACCENTS[key].name}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <SectionTitle>Ký hiệu tiền</SectionTitle>
      <Card>
        <SegmentedControl<CurrencySymbol>
          options={SYMBOL_OPTIONS}
          value={settings.currencySymbol}
          onChange={settings.setCurrencySymbol}
        />
        <View style={styles.previewRow}>
          <AppText color="textMuted">Đầy đủ</AppText>
          <AmountText amount={1_500_000} />
        </View>
        <View style={styles.previewRow}>
          <AppText color="textMuted">Rút gọn</AppText>
          <AmountText amount={2_350_000_000} compact />
        </View>
        <View style={styles.flowBlock}>
          <AppText color="textMuted">Chi · Thu · Chuyển</AppText>
          <View style={styles.flowRow}>
            <AmountText amount={50_000} flow="expense" />
            <AmountText amount={50_000} flow="income" />
            <AmountText amount={50_000} flow="transfer" />
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: t.spacing.md,
  },
  swatchCell: {
    width: '25%',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  flowBlock: {
    gap: t.spacing.xs,
  },
  flowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: t.spacing.sm,
  },
}));
