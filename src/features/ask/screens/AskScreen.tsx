// Hỏi app bằng tiếng Việt: gõ câu hỏi → thẻ trả lời từ dữ liệu trong máy (không cần mạng, không gửi đi đâu).
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/glass/IconButton';
import { AppText, Card, Chip, Screen, TextField } from '@/components/ui';
import { db } from '@/db';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { todayVn } from '@/lib/date';
import { t } from '@/lib/i18n';
import { createStyles } from '@/theme';

import { answerQuestion, type Answer } from '../answer';
import { parseQuestion } from '../parse';

const EXAMPLES = [
  'Tháng này tôi tiêu bao nhiêu?',
  'Cafe tháng này mấy lần?',
  'Tháng này chi nhiều hơn tháng trước không?',
  'Khoản chi lớn nhất tháng này',
  'Tiêu nhiều nhất vào đâu?',
  'Ngân sách còn bao nhiêu?',
  'Số dư các ví',
];

type Turn = { id: number; question: string; answer: Answer };

export function AskScreen() {
  const styles = useStyles();
  const format = useMoneyFormat();
  const startDay = useSettings((s) => s.startDayOfMonth);
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);

  const ask = (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    const answer = answerQuestion(db, parseQuestion(question, todayVn(), startDay), {
      today: todayVn(),
      startDay,
      money: format.money,
    });
    setTurns((prev) => [{ id: prev.length + 1, question, answer }, ...prev]);
    setText('');
  };

  return (
    <Screen title="Hỏi app" scroll>
      <View style={styles.inputRow}>
        <View style={{ flex: 1 }}>
          <TextField
            icon="chatbubble-ellipses-outline"
            placeholder="vd: tháng này tôi tiêu bao nhiêu?"
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => ask(text)}
            returnKeyType="send"
          />
        </View>
        <IconButton icon="arrow-up" accessibilityLabel={t('Gửi')} onPress={() => ask(text)} />
      </View>

      {!turns.length ? (
        <View style={styles.chips}>
          {EXAMPLES.map((ex) => (
            <Chip key={ex} label={t(ex)} onPress={() => ask(ex)} />
          ))}
        </View>
      ) : null}

      {turns.map((turn) => (
        <View key={turn.id} style={styles.turn}>
          <View style={styles.bubble}>
            <AppText color="primary">{turn.question}</AppText>
          </View>
          <Card>
            {turn.answer.understood ? (
              <>
                {turn.answer.headline ? (
                  <AppText variant="display">{turn.answer.headline}</AppText>
                ) : null}
                {turn.answer.summary ? (
                  <AppText color="textMuted">{turn.answer.summary}</AppText>
                ) : null}
                {turn.answer.rows.map((row, i) => (
                  <View key={i} style={styles.row}>
                    <AppText style={{ flex: 1 }}>{row.label}</AppText>
                    <AppText style={styles.value}>{row.value}</AppText>
                  </View>
                ))}
                {turn.answer.href ? (
                  <Pressable onPress={() => router.push(turn.answer.href as Href)} hitSlop={8}>
                    <AppText color="primary">Xem chi tiết</AppText>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                <AppText>Mình chưa hiểu câu này. Thử hỏi kiểu:</AppText>
                {EXAMPLES.slice(0, 4).map((ex) => (
                  <AppText key={ex} color="primary" onPress={() => ask(ex)}>
                    {ex}
                  </AppText>
                ))}
              </>
            )}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const useStyles = createStyles((th) => ({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
  turn: { gap: th.spacing.sm },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    paddingHorizontal: th.spacing.md,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: th.colors.surface,
  },
  row: { flexDirection: 'row', gap: th.spacing.md, alignItems: 'center', paddingVertical: 2 },
  value: { fontVariant: ['tabular-nums'] },
}));
