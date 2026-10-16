// Import Ivy Wallet: chọn file → xem trước → xác nhận → ghi (1 transaction) → kiểm tra lại.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from '@/lib/haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  AmountText,
  AppText,
  Button,
  Card,
  ListRow,
  Screen,
  SectionTitle,
  StatGrid,
  SwitchRow,
} from '@/components/ui';
import { db } from '@/db';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { useTheme } from '@/theme';

import { pickFile } from '../fileIO';
import {
  IvyReadError,
  mapIvyBackup,
  readIvyBackup,
  verifyIvyImport,
  writeIvyImport,
  type ImportCounts,
  type IvyImportPlan,
  type VerifyResult,
} from '../ivy';

type Step =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'preview'; plan: IvyImportPlan; fileName: string; encoding: string }
  | { kind: 'importing'; plan: IvyImportPlan }
  | { kind: 'done'; plan: IvyImportPlan; counts: ImportCounts; verify: VerifyResult }
  | { kind: 'error'; message: string };

const ENCODING_LABEL: Record<string, string> = {
  'utf-16be': 'UTF-16 Big-Endian',
  'utf-16le': 'UTF-16 Little-Endian',
  'utf-8': 'UTF-8',
};

export function ImportIvyScreen() {
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [applySettings, setApplySettings] = useState(true);
  const format = useMoneyFormat();
  const { colors } = useTheme();

  const choose = async () => {
    try {
      const file = await pickFile(['application/json', 'application/zip', '*/*']);
      if (!file) return;
      setStep({ kind: 'reading' });
      // Nhường một khung hình để hiện vòng quay trước khi xử lý file lớn
      await new Promise((resolve) => setTimeout(resolve, 16));
      const read = readIvyBackup(file.bytes);
      const plan = mapIvyBackup(read.backup);
      setStep({ kind: 'preview', plan, fileName: file.name, encoding: read.encoding });
    } catch (error) {
      setStep({
        kind: 'error',
        message:
          error instanceof IvyReadError
            ? error.message
            : `Không đọc được file: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  const runImport = async (plan: IvyImportPlan) => {
    setStep({ kind: 'importing', plan });
    await new Promise((resolve) => setTimeout(resolve, 16));
    try {
      const counts = writeIvyImport(db, plan);
      const verify = await verifyIvyImport(db, plan);
      if (applySettings) useSettings.getState().update({ ...plan.settings, onboarded: true });
      else useSettings.getState().update({ onboarded: true });
      Haptics.notificationAsync(
        verify.ok
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
      setStep({ kind: 'done', plan, counts, verify });
    } catch (error) {
      setStep({
        kind: 'error',
        message: `Import thất bại, chưa có gì được ghi vào máy. ${error instanceof Error ? error.message : ''}`,
      });
    }
  };

  if (step.kind === 'reading' || step.kind === 'importing') {
    return (
      <Screen
        title="Import Ivy Wallet"
        contentStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <AppText color="textMuted">
          {step.kind === 'reading' ? 'Đang đọc file…' : 'Đang ghi dữ liệu…'}
        </AppText>
      </Screen>
    );
  }

  if (step.kind === 'preview') {
    const { plan } = step;
    const s = plan.stats;
    const settingsText = [
      plan.settings.themePreference === 'dark' && 'theme tối',
      plan.settings.safetyThreshold != null &&
        `ngưỡng an toàn ${format.money(plan.settings.safetyThreshold)}`,
      plan.settings.transfersAsIncomeExpense && 'tính chuyển khoản là thu/chi',
    ]
      .filter(Boolean)
      .join(', ');
    return (
      <Screen title="Import Ivy Wallet">
        <Card>
          <ListRow
            icon="document-outline"
            title={step.fileName}
            subtitle={`Mã hoá ${ENCODING_LABEL[step.encoding] ?? step.encoding} · đúng cấu trúc Ivy Wallet`}
          />
        </Card>

        <SectionTitle>Sẽ import</SectionTitle>
        <Card>
          <StatGrid
            items={[
              { label: 'Ví', value: s.accounts },
              { label: 'Danh mục', value: s.categories },
              { label: 'Tag', value: s.tags },
              { label: 'Khoản chi', value: s.expense },
              { label: 'Khoản thu', value: s.income },
              { label: 'Chuyển khoản', value: s.transfer },
              { label: 'Lịch định kỳ', value: s.schedules, hint: `${s.activeSchedules} đang chạy` },
              { label: 'Khoản nợ', value: s.debts },
              { label: 'Ngân sách', value: s.budgets },
            ]}
          />
          <AppText variant="caption" color="textMuted">
            {s.upcomingSkipped} khoản “sắp tới” Ivy sinh sẵn không import thành giao dịch — JWP tự
            tính lại từ {s.schedules} lịch định kỳ.
            {s.uncategorized ? ` ${s.uncategorized} giao dịch chưa phân loại.` : ''}
            {s.deletedSkipped ? ` Bỏ qua ${s.deletedSkipped} bản ghi đã xoá.` : ''}
          </AppText>
        </Card>

        <SectionTitle>Số dư sau khi import</SectionTitle>
        <Card>
          {plan.balances.map((b) => (
            <ListRow
              key={b.accountId}
              icon="wallet-outline"
              iconColor={plan.accounts.find((a) => a.id === b.accountId)?.color}
              title={b.name}
              subtitle={b.includeInBalance ? undefined : 'Không tính vào tổng'}
              right={<AmountText amount={b.balance} />}
            />
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="heading">Tổng</AppText>
            <AmountText amount={plan.totalBalance} variant="heading" />
          </View>
        </Card>

        {plan.warnings.length > 0 && (
          <>
            <SectionTitle>Lưu ý</SectionTitle>
            <Card>
              {plan.warnings.map((w) => (
                <AppText key={w} variant="caption" color="warning">
                  • {w}
                </AppText>
              ))}
            </Card>
          </>
        )}

        {settingsText ? (
          <Card>
            <SwitchRow
              icon="settings-outline"
              title="Dùng cài đặt từ Ivy"
              subtitle={settingsText}
              value={applySettings}
              onValueChange={setApplySettings}
            />
          </Card>
        ) : null}

        <Button icon="download-outline" title="Import vào JWP" onPress={() => runImport(plan)} />
        <Button title="Chọn file khác" variant="ghost" onPress={choose} />
      </Screen>
    );
  }

  if (step.kind === 'done') {
    const { verify, counts } = step;
    const skipped = counts.transactions.skipped;
    return (
      <Screen title="Import Ivy Wallet">
        <Card style={{ alignItems: 'center' }}>
          <Ionicons
            name={verify.ok ? 'checkmark-circle' : 'alert-circle'}
            size={64}
            color={verify.ok ? colors.income : colors.warning}
          />
          <AppText variant="title">
            {verify.ok ? 'Import thành công' : 'Đã import, cần xem lại'}
          </AppText>
          <AppText color="textMuted" style={{ textAlign: 'center' }}>
            {verify.ok
              ? `Đã kiểm tra lại: đủ dữ liệu, số dư ${verify.balances.length} ví khớp với Ivy.`
              : 'Một số số dư khác bản xem trước (thường do ví đã có giao dịch khác trong JWP).'}
          </AppText>
        </Card>
        <Card>
          <StatGrid
            columns={2}
            items={[
              { label: 'Giao dịch mới', value: counts.transactions.inserted },
              { label: 'Đã có sẵn (bỏ qua)', value: skipped },
              { label: 'Ví mới', value: counts.accounts.inserted },
              { label: 'Lịch mới', value: counts.schedules.inserted },
            ]}
          />
        </Card>
        {!verify.ok && (
          <Card>
            {verify.balances
              .filter((b) => b.actual !== b.expected)
              .map((b) => (
                <ListRow
                  key={b.name}
                  title={b.name}
                  subtitle={`Ivy: ${format.money(b.expected)}`}
                  right={<AmountText amount={b.actual} />}
                />
              ))}
          </Card>
        )}
        <Button title="Về Tổng quan" onPress={() => router.dismissTo('/')} />
      </Screen>
    );
  }

  return (
    <Screen title="Import Ivy Wallet">
      <Card>
        <AppText variant="heading">Chuyển dữ liệu từ Ivy Wallet</AppText>
        <AppText color="textMuted">
          1. Mở Ivy Wallet → Cài đặt → Backup data → lưu file .zip.{'\n'}
          2. Bấm nút dưới đây và chọn file đó (.zip hoặc file .json bên trong).{'\n'}
          3. Xem trước số dư từng ví, xác nhận để import.
        </AppText>
        <AppText variant="caption" color="textMuted">
          Import lại nhiều lần cũng không bị trùng. Dữ liệu chỉ nằm trên máy này.
        </AppText>
      </Card>
      {step.kind === 'error' && (
        <Card>
          <AppText color="expense">{step.message}</AppText>
        </Card>
      )}
      <Button icon="folder-open-outline" title="Chọn file backup" onPress={choose} />
    </Screen>
  );
}
