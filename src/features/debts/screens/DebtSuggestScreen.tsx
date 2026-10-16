// Gợi ý dựng Sổ nợ từ giao dịch cũ ("Mượn a Quý", "Nợ a Quý", "Cho em Lít Vay"...). Xem lại rồi mới tạo.
import { goBack } from '@/lib/goBack';
import { t } from '@/lib/i18n';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, EmptyState, Screen } from '@/components/ui';
import { db } from '@/db';
import { useMoneyFormat } from '@/features/settings';
import { formatDate, toVnDate } from '@/lib/date';

import { DIRECTION_LABEL } from '../components/display';
import { useDebtProposals } from '../hooks';
import { adoptProposal } from '../repository';
import type { DebtProposal } from '../suggest';

export function DebtSuggestScreen() {
  const format = useMoneyFormat();
  const { data: proposals } = useDebtProposals();

  const adopt = (items: DebtProposal[]) => {
    try {
      for (const p of items) adoptProposal(db, p);
      showSnackbar({
        text: t('Đã tạo {length} khoản nợ', { length: items.length }),
        tone: 'success',
      });
      if (items.length === proposals?.length) goBack();
    } catch (error) {
      Alert.alert('Chưa tạo được', error instanceof Error ? error.message : String(error));
    }
  };

  const confirmAll = () =>
    Alert.alert(
      t('Tạo {length} khoản nợ?', { length: proposals?.length }),
      'Các giao dịch liên quan sẽ được gắn vào sổ nợ và không còn tính vào thống kê chi tiêu. Số dư ví không đổi.',
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Tạo', onPress: () => adopt(proposals ?? []) },
      ],
    );

  return (
    <Screen title="Gợi ý từ giao dịch cũ">
      <AppText color="textMuted">
        {
          'App tìm các giao dịch có tiêu đề kiểu “Mượn a Quý”, “Nợ a Quý”, “Cho em Lít Vay”, “Văn trả nợ”. Khi tạo, các giao dịch đó được gắn vào sổ nợ (vay / trả nợ không phải chi tiêu nên không tính vào thống kê). Số dư ví không đổi.'
        }
      </AppText>

      {proposals && proposals.length === 0 ? (
        <Card>
          <EmptyState icon="checkmark-done-outline" title="Không còn gợi ý nào" />
        </Card>
      ) : null}

      {proposals && proposals.length > 1 ? (
        <Button
          title={t('Tạo tất cả ({length})', { length: proposals.length })}
          icon="checkmark-done"
          onPress={confirmAll}
        />
      ) : null}

      {proposals?.map((p) => (
        <Card key={p.key} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" numberOfLines={1}>
                {p.personName}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {DIRECTION_LABEL[p.direction]} · từ {formatDate(toVnDate(p.opening.date))}
              </AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText
                variant="bodyMedium"
                color={
                  p.remaining > 0 ? (p.direction === 'lent' ? 'income' : 'expense') : 'textMuted'
                }
                style={{ fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {p.remaining > 0
                  ? t('Còn {remaining}', { remaining: format.money(p.remaining) })
                  : 'Đã xong'}
              </AppText>
              <AppText variant="caption" color="textMuted">
                Gốc {format.money(p.opening.amount)}
              </AppText>
            </View>
          </View>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" color="textMuted">
              {p.opening.title} · {format.money(p.opening.amount)}
            </AppText>
            {p.records.map((r) => (
              <AppText key={r.txId} variant="caption" color="textMuted">
                {r.type === 'repay' ? '↳ trả' : '↳ vay thêm'} · {formatDate(toVnDate(r.date))} ·{' '}
                {format.money(r.amount)}
              </AppText>
            ))}
          </View>
          <Button title="Tạo khoản nợ" size="sm" variant="secondary" onPress={() => adopt([p])} />
        </Card>
      ))}
    </Screen>
  );
}
