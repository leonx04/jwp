// Màn chọn nội dung cho widget "JWP · Tùy chỉnh": hiện khi thêm widget ra màn hình chính và khi giữ lâu → Cài đặt.
// Chạy trong một Activity riêng của thư viện widget (không có expo-router) nên chỉ dùng các thành phần thuần.
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';

import { AppText, Button, Card, Chip, SectionTitle, SwitchRow, TextField } from '@/components/ui';
import { db } from '@/db';
import { listAccounts } from '@/features/accounts/repository';
import { listBudgetRows } from '@/features/budgets/repository';
import { listGoalRows } from '@/features/goals/repository';
import { AppThemeProvider } from '@/features/settings';
import { t } from '@/lib/i18n';
import { createStyles } from '@/theme';

import {
  CASH_MODES,
  METRICS,
  PALETTES,
  PALETTE_COLORS,
  PERIODS,
  getWidgetConfig,
  saveWidgetConfig,
  type CashMode,
  type Metric,
  type Palette,
  type Period,
  type WidgetConfig,
} from './config';
import { CustomWidget, backgroundOf } from './CustomWidget';
import { resolveCard } from './metrics';

const METRIC_LABEL: Record<Metric, string> = {
  safe_today: 'Còn được tiêu hôm nay',
  balance: 'Số dư',
  cashflow: 'Thu chi',
  budget: 'Ngân sách',
  goal: 'Quỹ tiết kiệm',
  credit: 'Dư nợ trả sau',
  upcoming: 'Khoản sắp tới',
  debt: 'Sổ nợ',
};

const PERIOD_LABEL: Record<Period, string> = {
  today: 'Hôm nay',
  week: 'Tuần này',
  month: 'Tháng này',
  cycle: 'Kỳ lương',
  year: 'Năm nay',
};

const CASH_LABEL: Record<CashMode, string> = {
  expense: 'Chi',
  income: 'Thu',
  net: 'Còn lại',
  both: 'Thu và chi',
};

const PALETTE_LABEL: Record<Palette, string> = {
  auto: 'Tự động',
  purple: 'Tím',
  blue: 'Xanh dương',
  green: 'Xanh lá',
  orange: 'Cam',
  rose: 'Hồng',
  dark: 'Tối',
};

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function Body({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [cfg, setCfg] = useState<WidgetConfig>(() => getWidgetConfig(widgetInfo.widgetId));
  const set = (patch: Partial<WidgetConfig>) => setCfg((c) => ({ ...c, ...patch }));

  // Danh sách để chọn: đọc một lần khi mở màn
  const [accounts] = useState(() => listAccounts(db));
  const [budgets] = useState(() => listBudgetRows(db));
  const [goals] = useState(() => listGoalRows(db));
  const creditAccounts = accounts.filter((a) => a.isCredit);

  const card = useMemo(() => resolveCard(db, cfg), [cfg]);
  const bg = backgroundOf(cfg, card.tone);

  const done = () => {
    saveWidgetConfig(widgetInfo.widgetId, cfg);
    renderWidget(
      <CustomWidget
        card={resolveCard(db, cfg)}
        config={cfg}
        size={{ width: widgetInfo.width, height: widgetInfo.height }}
      />,
    );
    setResult('ok');
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <AppText variant="heading">Tùy chỉnh widget</AppText>

      {/* Xem trước */}
      <View style={[styles.preview, { backgroundColor: bg.from }]}>
        <AppText variant="label" style={styles.previewSoft}>
          {card.label.toUpperCase()}
        </AppText>
        <AppText variant="display" style={styles.previewValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {cfg.hideAmounts ? '••••' : card.value}
        </AppText>
        {cfg.showBar && card.ratio !== null ? (
          <View style={styles.track}>
            <View style={[styles.fill, { flex: Math.max(0.001, card.ratio) }]} />
            <View style={{ flex: Math.max(0.001, 1 - card.ratio) }} />
          </View>
        ) : null}
        {card.sub && !cfg.hideAmounts ? (
          <AppText variant="caption" style={styles.previewSoft}>
            {card.sub}
          </AppText>
        ) : null}
      </View>

      <SectionTitle>Hiển thị</SectionTitle>
      <View style={styles.chips}>
        {METRICS.map((m) => (
          <Chip key={m} label={t(METRIC_LABEL[m])} selected={cfg.metric === m} onPress={() => set({ metric: m })} />
        ))}
      </View>

      {cfg.metric === 'cashflow' ? (
        <Card>
          <AppText variant="label" color="textMuted">
            Kỳ
          </AppText>
          <View style={styles.chips}>
            {PERIODS.map((p) => (
              <Chip key={p} label={t(PERIOD_LABEL[p])} selected={cfg.period === p} onPress={() => set({ period: p })} />
            ))}
          </View>
          <AppText variant="label" color="textMuted">
            Hiện
          </AppText>
          <View style={styles.chips}>
            {CASH_MODES.map((m) => (
              <Chip key={m} label={t(CASH_LABEL[m])} selected={cfg.cash === m} onPress={() => set({ cash: m })} />
            ))}
          </View>
        </Card>
      ) : null}

      {cfg.metric === 'balance' || cfg.metric === 'cashflow' ? (
        <Card>
          <AppText variant="label" color="textMuted">
            {cfg.metric === 'balance' ? 'Ví (không chọn = tất cả ví tính vào số dư)' : 'Ví (không chọn = tất cả)'}
          </AppText>
          <View style={styles.chips}>
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                color={a.color}
                selected={cfg.accountIds.includes(a.id)}
                onPress={() => set({ accountIds: toggle(cfg.accountIds, a.id) })}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {cfg.metric === 'credit' ? (
        <Card>
          <AppText variant="label" color="textMuted">
            Ví trả sau (không chọn = tất cả)
          </AppText>
          <View style={styles.chips}>
            {creditAccounts.length ? (
              creditAccounts.map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  color={a.color}
                  selected={cfg.accountIds.includes(a.id)}
                  onPress={() => set({ accountIds: toggle(cfg.accountIds, a.id) })}
                />
              ))
            ) : (
              <AppText color="textMuted">Chưa có ví trả sau.</AppText>
            )}
          </View>
        </Card>
      ) : null}

      {cfg.metric === 'budget' ? (
        <Card>
          <AppText variant="label" color="textMuted">
            Ngân sách
          </AppText>
          <View style={styles.chips}>
            <Chip label={t('Sát hạn mức nhất')} selected={cfg.budgetId === null} onPress={() => set({ budgetId: null })} />
            {budgets.map((b) => (
              <Chip key={b.id} label={b.name} selected={cfg.budgetId === b.id} onPress={() => set({ budgetId: b.id })} />
            ))}
          </View>
        </Card>
      ) : null}

      {cfg.metric === 'goal' ? (
        <Card>
          <AppText variant="label" color="textMuted">
            Quỹ
          </AppText>
          <View style={styles.chips}>
            <Chip label={t('Quỹ chưa đạt đầu tiên')} selected={cfg.goalId === null} onPress={() => set({ goalId: null })} />
            {goals.map((g) => (
              <Chip key={g.id} label={g.name} color={g.color} selected={cfg.goalId === g.id} onPress={() => set({ goalId: g.id })} />
            ))}
          </View>
        </Card>
      ) : null}

      <SectionTitle>Giao diện</SectionTitle>
      <View style={styles.chips}>
        {PALETTES.map((p) => (
          <Chip
            key={p}
            label={t(PALETTE_LABEL[p])}
            color={p === 'auto' ? null : PALETTE_COLORS[p].from}
            selected={cfg.palette === p}
            onPress={() => set({ palette: p })}
          />
        ))}
      </View>
      <Card>
        <SwitchRow title="Thanh tiến độ" value={cfg.showBar} onValueChange={(v) => set({ showBar: v })} />
        <SwitchRow
          title="Ẩn số tiền"
          subtitle="Hiện •••• thay vì số tiền, để màn hình chính kín đáo"
          value={cfg.hideAmounts}
          onValueChange={(v) => set({ hideAmounts: v })}
        />
        <TextField label="Tên riêng (không bắt buộc)" value={cfg.title} onChangeText={(v) => set({ title: v })} maxLength={24} />
      </Card>

      <View style={styles.buttons}>
        <Button title="Xong" icon="checkmark" onPress={done} />
        <Button title="Huỷ" variant="secondary" onPress={() => setResult('cancel')} />
      </View>
    </ScrollView>
  );
}

export function WidgetConfigScreen(props: WidgetConfigurationScreenProps) {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <Body {...props} />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

const useStyles = createStyles((th) => ({
  root: { flex: 1, backgroundColor: th.colors.background },
  content: { paddingHorizontal: th.spacing.lg, gap: th.spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
  buttons: { gap: th.spacing.sm, marginTop: th.spacing.sm },
  preview: { borderRadius: 22, padding: 14, gap: 4 },
  previewSoft: { color: 'rgba(255,255,255,0.78)' },
  previewValue: { color: '#ffffff', fontWeight: '800' },
  track: { height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.28)' },
  fill: { backgroundColor: '#ffffff', borderRadius: 3 },
}));
