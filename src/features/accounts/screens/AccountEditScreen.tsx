import { goBack } from '@/lib/goBack';
import { t } from '@/lib/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import {
  AppText,
  BankMark,
  Button,
  Card,
  Chip,
  ColorPicker,
  IconBadge,
  IconPicker,
  MoneyField,
  Screen,
  SectionTitle,
  SwitchRow,
  TextField,
} from '@/components/ui';
import { db } from '@/db';
import { bankFromIcon, bankIcon } from '@/lib/banks';
import { DEFAULT_ACCOUNT_ICON, toAppIcon, type AppIcon } from '@/lib/icons';
import { suggestedBank } from '@/lib/icons/search';
import { createStyles } from '@/theme';

import {
  accountTransactionCount,
  deleteAccount,
  listAccounts,
  saveAccount,
  setAccountArchived,
} from '../repository';

export function AccountEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id
    ? listAccounts(db, { includeArchived: true }).find((a) => a.id === id)
    : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? '#5B5BD6');
  const [icon, setIcon] = useState<AppIcon>(toAppIcon(existing?.icon, DEFAULT_ACCOUNT_ICON));
  const [includeInBalance, setIncludeInBalance] = useState(existing?.includeInBalance ?? true);
  const [archived, setArchived] = useState(existing?.archived ?? false);
  // Ví trả sau / thẻ tín dụng
  const [isCredit, setIsCredit] = useState(existing?.isCredit ?? false);
  const [creditLimit, setCreditLimit] = useState(existing?.creditLimit ?? 0);
  const [statementDay, setStatementDay] = useState(dayText(existing?.statementDay));
  const [dueDay, setDueDay] = useState(dayText(existing?.dueDay));
  const [paymentAccountId, setPaymentAccountId] = useState(existing?.paymentAccountId ?? null);
  const styles = useStyles();

  const otherAccounts = listAccounts(db).filter((a) => a.id !== id && !a.isCredit);
  const suggestion = suggestedBank(name, icon);

  // Chọn logo ngân hàng / ví → lấy luôn màu thương hiệu (vẫn đổi lại được ở mục Màu)
  const pickIcon = (next: AppIcon) => {
    setIcon(next);
    const bank = bankFromIcon(next);
    if (bank) setColor(bank.color);
  };

  const toggleCredit = (value: boolean) => {
    setIsCredit(value);
    // Dư nợ trả sau không phải tiền đang có → ví mới mặc định không cộng vào tổng số dư
    if (value && !id) setIncludeInBalance(false);
  };

  const save = () => {
    try {
      const credit = isCredit
        ? {
            limit: creditLimit || null,
            statementDay: parseDay(statementDay),
            dueDay: parseDay(dueDay),
            paymentAccountId,
          }
        : null;
      const savedId = saveAccount(db, { id, name, color, icon, includeInBalance, credit });
      if (id && archived !== existing?.archived) setAccountArchived(db, savedId, archived);
      showSnackbar({ text: id ? 'Đã lưu ví' : 'Đã thêm ví', tone: 'success' });
      goBack();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  const remove = () => {
    if (!id) return;
    const count = accountTransactionCount(db, id);
    if (count === 0) {
      Alert.alert('Xoá ví?', t('Xoá "{name}".', { name: existing?.name }), [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            deleteAccount(db, id);
            router.dismissTo('/accounts');
          },
        },
      ]);
      return;
    }
    Alert.alert(
      'Ví còn giao dịch',
      t(
        'Ví có {count} giao dịch. Nên lưu trữ để giữ lịch sử, hoặc xoá cả ví và giao dịch (kể cả chuyển khoản liên quan, không hoàn tác được).',
        { count },
      ),
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Lưu trữ',
          onPress: () => {
            setAccountArchived(db, id, true);
            router.dismissTo('/accounts');
          },
        },
        {
          text: t('Xoá cả {count} giao dịch', { count }),
          style: 'destructive',
          onPress: () => {
            deleteAccount(db, id, true);
            router.dismissTo('/accounts');
          },
        },
      ],
    );
  };

  return (
    <Screen
      title={id ? 'Sửa ví' : 'Thêm ví'}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button title="Lưu" icon="checkmark" disabled={!name.trim()} onPress={save} />
        </View>
      }
    >
      <Card style={{ alignItems: 'center' }}>
        <IconBadge icon={icon} color={color} size={64} />
        <AppText variant="heading">{name.trim() || 'Tên ví'}</AppText>
      </Card>
      <TextField
        label="Tên ví"
        placeholder="vd: MB bank, Momo, SPayLater, Tiền mặt"
        value={name}
        onChangeText={setName}
        autoFocus={!id}
      />
      {suggestion ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => pickIcon(bankIcon(suggestion.code))}
          style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.7 }]}
        >
          <BankMark bank={suggestion} size={32} />
          <AppText variant="bodyMedium" style={{ flex: 1 }}>
            Dùng logo {suggestion.name}?
          </AppText>
          <AppText variant="bodyMedium" color="primary">
            Dùng
          </AppText>
        </Pressable>
      ) : null}

      {/* Logo ngân hàng / ví hoặc biểu tượng: một dòng gọn, bấm để mở bảng chọn */}
      <IconPicker
        value={icon}
        onChange={pickIcon}
        color={color}
        kind="account"
        hint={name}
        hintBanks={false}
        title="Logo / biểu tượng"
      />

      <SectionTitle>Ví trả sau / thẻ tín dụng</SectionTitle>
      <Card style={{ gap: 0 }}>
        <SwitchRow
          icon="card-outline"
          title="Đây là ví trả sau"
          subtitle="SPayLater, MoMo trả sau, thẻ tín dụng"
          value={isCredit}
          onValueChange={toggleCredit}
        />
      </Card>
      {isCredit ? (
        <Card style={{ gap: 14 }}>
          <AppText variant="caption" color="textMuted">
            Mua hàng bằng ví này: ghi khoản chi như thường. Trả bill: chuyển tiền từ ngân hàng vào
            ví này. App tự tính kỳ sao kê, số phải trả và nhắc trước hạn.
          </AppText>
          <View style={{ gap: 8 }}>
            <AppText variant="label" color="textMuted">
              Mẫu nhanh
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CREDIT_PRESETS.map((preset) => (
                <Chip
                  key={preset.label}
                  label={preset.label}
                  selected={
                    parseDay(statementDay) === preset.statementDay &&
                    parseDay(dueDay) === preset.dueDay
                  }
                  onPress={() => {
                    setStatementDay(String(preset.statementDay));
                    setDueDay(String(preset.dueDay));
                  }}
                />
              ))}
            </View>
          </View>
          <MoneyField
            label="Hạn mức"
            value={creditLimit}
            onChange={setCreditLimit}
            placeholder="vd: 5.000.000"
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Ngày chốt sao kê"
                placeholder="31 = cuối tháng"
                keyboardType="number-pad"
                maxLength={2}
                value={statementDay}
                onChangeText={setStatementDay}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Hạn thanh toán ngày"
                placeholder="31 = cuối tháng"
                keyboardType="number-pad"
                maxLength={2}
                value={dueDay}
                onChangeText={setDueDay}
              />
            </View>
          </View>
          {otherAccounts.length > 0 ? (
            <View style={{ gap: 8 }}>
              <AppText variant="label" color="textMuted">
                Thường trả bill từ ví
              </AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {otherAccounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    icon={toAppIcon(a.icon, 'wallet-outline')}
                    color={a.color}
                    selected={paymentAccountId === a.id}
                    onPress={() => setPaymentAccountId(paymentAccountId === a.id ? null : a.id)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: 0 }}>
        <SwitchRow
          icon="calculator-outline"
          title="Tính vào tổng số dư"
          subtitle={
            isCredit
              ? 'Ví trả sau nên tắt: dư nợ hiện riêng, không trừ vào tiền đang có'
              : 'Tắt cho quỹ tiết kiệm / tiền giữ hộ'
          }
          value={includeInBalance}
          onValueChange={setIncludeInBalance}
        />
        {id ? (
          <SwitchRow
            icon="archive-outline"
            title="Lưu trữ"
            subtitle="Ẩn ví khỏi danh sách, vẫn giữ lịch sử giao dịch"
            value={archived}
            onValueChange={setArchived}
          />
        ) : null}
      </Card>
      <SectionTitle>Màu</SectionTitle>
      <ColorPicker value={color} onChange={setColor} />
      {id ? <Button title="Xoá ví" variant="danger" icon="trash-outline" onPress={remove} /> : null}
    </Screen>
  );
}

/** Chu kỳ hay gặp — người dùng vẫn sửa được */
const CREDIT_PRESETS = [
  // SPayLater (Shopee): hóa đơn phát hành ngày 14 hoặc 24 tùy tài khoản — xem mục Hóa đơn trong app Shopee
  { label: 'SPayLater: hóa đơn ngày 14, hạn cuối tháng', statementDay: 14, dueDay: 31 },
  { label: 'SPayLater: hóa đơn ngày 24, hạn ngày 10', statementDay: 24, dueDay: 10 },
  { label: 'SPayLater: hóa đơn ngày 14, hạn ngày 1', statementDay: 14, dueDay: 1 },
  { label: 'Thẻ tín dụng: chốt ngày 25, hạn ngày 10', statementDay: 25, dueDay: 10 },
] as const;

const dayText = (day: number | null | undefined) => (day ? String(day) : '');

function parseDay(text: string): number | null {
  const day = Number.parseInt(text, 10);
  return day >= 1 && day <= 31 ? day : null;
}

const useStyles = createStyles((t) => ({
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.primarySoft,
  },
}));
