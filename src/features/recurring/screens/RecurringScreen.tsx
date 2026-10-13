// Khoản lặp hằng tháng app phát hiện trong lịch sử → bấm để tạo lịch nhắc.
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, EmptyState, Screen } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { useMoneyFormat } from '@/features/settings';
import { formatDate } from '@/lib/date';

import { useRecurringSuggestions } from '../hooks';
import { createScheduleFromSuggestion, dismissSuggestion } from '../repository';

export function RecurringScreen() {
  const format = useMoneyFormat();
  const { data: suggestions } = useRecurringSuggestions();
  const { data: accounts = [] } = useLiveData(['accounts'], () => listAccounts(db));
  // Gợi ý vừa bị ẩn: danh sách lấy từ DB không đổi nên cần ẩn ngay trên giao diện
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const shown = (suggestions ?? []).filter((s) => !hidden.has(s.key));
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '';

  const create = (index: number) => {
    const s = shown[index];
    try {
      createScheduleFromSuggestion(db, s);
      setHidden((h) => new Set(h).add(s.key));
      showSnackbar({ text: `Đã tạo lịch “${s.title}”`, tone: 'success' });
    } catch (error) {
      Alert.alert('Chưa tạo được', error instanceof Error ? error.message : String(error));
    }
  };

  const dismiss = (key: string) => {
    dismissSuggestion(key);
    setHidden((h) => new Set(h).add(key));
  };

  return (
    <Screen title="Khoản lặp phát hiện được">
      <AppText color="textMuted">
        App tìm các khoản xuất hiện đều đặn mỗi tháng (tiền nhà, đăng ký, lương…) mà bạn chưa đặt
        lịch. Tạo lịch để được nhắc trước hạn và thấy trong dự báo dòng tiền.
      </AppText>

      {suggestions && shown.length === 0 ? (
        <Card>
          <EmptyState
            icon="repeat-outline"
            title="Chưa phát hiện khoản lặp nào"
            description="Cần một khoản xuất hiện ít nhất 3 tháng liên tiếp, cùng ngày và số tiền gần nhau. Ghi chép thêm vài tháng là app sẽ nhận ra."
          />
        </Card>
      ) : null}

      {shown.map((s, i) => (
        <Card key={s.key} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" numberOfLines={1}>
                {s.title}
              </AppText>
              <AppText variant="caption" color="textMuted">
                Hằng tháng, khoảng ngày {s.monthDay} · {s.occurrences} tháng gần đây
              </AppText>
            </View>
            <AppText
              variant="heading"
              color={s.type === 'income' ? 'income' : 'expense'}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {s.type === 'income' ? '+' : '−'}
              {format.money(s.amount)}
            </AppText>
          </View>
          <AppText variant="caption" color="textMuted">
            {s.isEstimate ? 'Số tiền thay đổi, lấy mức trung vị · ' : ''}
            Lần gần nhất {formatDate(s.lastDate)} · kỳ tới dự kiến {formatDate(s.nextDate)}
            {accountName(s.accountId) ? ` · ${accountName(s.accountId)}` : ''}
          </AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Tạo lịch" size="sm" icon="add" onPress={() => create(i)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Không phải khoản lặp"
                size="sm"
                variant="secondary"
                onPress={() => dismiss(s.key)}
              />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
