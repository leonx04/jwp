// Cài đặt cá nhân bằng JSON: dán → xem trước từng thay đổi → áp dụng.
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { db } from '@/db';
import { getSettings, useSettings } from '@/features/settings';
import { t } from '@/lib/i18n';
import { createStyles } from '@/theme';

import { applyPlan, exportProfile, planProfile } from './profile';

export function ProfileImportScreen() {
  const styles = useStyles();
  const update = useSettings((s) => s.update);
  const [text, setText] = useState('');
  const [version, setVersion] = useState(0);

  // `version` đổi sau khi áp dụng → tính lại kế hoạch theo dữ liệu mới
  const plan = useMemo(
    () => (text.trim() ? planProfile(db, text, update) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, version, update],
  );

  const paste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (clip.trim()) setText(clip);
    else showSnackbar({ text: t('Bộ nhớ tạm đang trống.'), tone: 'error' });
  };

  const apply = () => {
    if (!plan || plan.error || !plan.steps.length) return;
    Alert.alert(
      t('Áp dụng {n} thay đổi?', { n: plan.steps.length }),
      t('Nên sao lưu trước. Thay đổi ngân sách và tag sẽ ghi ngay vào dữ liệu.'),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Áp dụng'),
          onPress: () => {
            try {
              const n = applyPlan(db, plan);
              showSnackbar({ text: t('Đã áp dụng {n} thay đổi.', { n }), tone: 'success' });
              setText('');
              setVersion((v) => v + 1);
            } catch (e) {
              showSnackbar({ text: e instanceof Error ? e.message : t('Không áp dụng được.'), tone: 'error' });
            }
          },
        },
      ],
    );
  };

  return (
    <Screen title="Cài đặt cá nhân" scroll>
      <AppText color="textMuted">
        Dán một đoạn JSON để đặt ngân sách (ngày bắt đầu chu kỳ, quy tắc cuối tuần), dọn tag và vài
        tuỳ chọn. Bạn sẽ thấy từng thay đổi trước khi áp dụng.
      </AppText>

      <View style={styles.row}>
        <Button title="Dán từ bộ nhớ tạm" icon="clipboard-outline" size="sm" variant="secondary" onPress={paste} />
        <Button
          title="Lấy mẫu từ dữ liệu hiện tại"
          icon="document-text-outline"
          size="sm"
          variant="secondary"
          onPress={() => setText(exportProfile(db, getSettings()))}
        />
      </View>

      <TextField
        placeholder='{ "budgets": [ { "name": "Đổ xăng", "startDay": 17, "weekendRule": "after" } ] }'
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.code}
      />

      {plan?.error ? (
        <Card>
          <AppText color="expense">{plan.error}</AppText>
        </Card>
      ) : null}

      {plan && !plan.error && plan.steps.length ? (
        <Card>
          <AppText variant="label" color="textMuted">
            Sẽ thay đổi ({plan.steps.length})
          </AppText>
          {plan.steps.map((step, i) => (
            <AppText key={i}>• {step.label}</AppText>
          ))}
        </Card>
      ) : null}

      {plan && plan.warnings.length ? (
        <Card>
          <AppText variant="label" color="textMuted">
            Lưu ý
          </AppText>
          {plan.warnings.map((w, i) => (
            <AppText key={i} variant="caption" color="textMuted">
              • {w}
            </AppText>
          ))}
        </Card>
      ) : null}

      {plan && !plan.error && plan.steps.length ? (
        <Button title={t('Áp dụng {n} thay đổi', { n: plan.steps.length })} icon="checkmark" onPress={apply} />
      ) : null}
    </Screen>
  );
}

const useStyles = createStyles((th) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
  code: { fontFamily: 'monospace', fontSize: 13, minHeight: 140, textAlignVertical: 'top' },
}));
