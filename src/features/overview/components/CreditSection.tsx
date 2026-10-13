// Mục "Trả sau" trên Tổng quan: thẻ từng ví trả sau + cảnh báo bill trả sau so với thu nhập.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { AppText, SectionTitle } from '@/components/ui';
import { CreditCard } from '@/features/credit/components';
import type { CreditSummary } from '@/features/credit/queries';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { mix, useTheme } from '@/theme';

import type { BnplLoad } from '../bnpl';

type CreditSectionProps = {
  credit: readonly CreditSummary[];
  load: BnplLoad | null;
};

export const CreditSection = memo(function CreditSection({ credit, load }: CreditSectionProps) {
  const { colors, spacing } = useTheme();
  const format = useMoneyFormat();
  const hideBalance = useSettings((s) => s.hideBalance);
  if (!credit.length) return null;

  return (
    <View style={{ gap: spacing.md }}>
      <SectionTitle tone="section">Trả sau</SectionTitle>
      {load?.warn && load.ratio != null && load.avgMonthlyIncome ? (
        <GlassSurface
          background={mix(colors.surface, colors.warning, colors.dark ? 0.14 : 0.08)}
          contentStyle={{
            flexDirection: 'row',
            gap: spacing.sm,
            alignItems: 'flex-start',
            padding: spacing.lg,
          }}
        >
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyMedium">
              Bill trả sau 30 ngày tới ≈ {Math.round(load.ratio * 100)}% thu nhập tháng
            </AppText>
            <AppText
              variant="caption"
              color="textMuted"
              style={{ fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {hideBalance
                ? 'Cân nhắc trước khi mua trả sau thêm.'
                : `Phải trả ${format.compact(load.billsTotal)} · thu nhập TB ${format.compact(load.avgMonthlyIncome)}/tháng. Cân nhắc trước khi mua trả sau thêm.`}
            </AppText>
          </View>
        </GlassSurface>
      ) : null}
      {credit.map((summary) => (
        <CreditCard
          key={summary.account.id}
          summary={summary}
          onPress={() => router.push(`/account/${summary.account.id}`)}
        />
      ))}
    </View>
  );
});
