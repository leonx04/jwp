// Một mục tiêu tiết kiệm: tiến độ, còn thiếu, cần góp mỗi tháng. Dùng ở màn Quỹ và Tổng quan.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Button, IconBadge } from '@/components/ui';
import { useMoneyFormat, useSettings } from '@/features/settings';
import { ProgressBar } from '@/features/today/components/ProgressBar';
import { formatDate } from '@/lib/date';

import type { GoalItem } from '../queries';

type GoalCardProps = {
  item: GoalItem;
  /** Hiện nút "Góp thêm" / "Sửa" (màn Quỹ); Tổng quan chỉ cần dòng tóm tắt */
  actions?: boolean;
};

export function GoalCard({ item, actions = false }: GoalCardProps) {
  const format = useMoneyFormat();
  const hide = useSettings((s) => s.hideBalance);
  const mask = (text: string) => (hide ? '••••••' : text);
  const { goal } = item;

  const edit = () => router.push({ pathname: '/goal/edit', params: { id: goal.id } });
  const contribute = () =>
    router.push({
      pathname: '/transaction/new',
      params: {
        type: 'transfer',
        toAccountId: goal.accountId ?? '',
        title: `Góp quỹ ${goal.name}`,
      },
    });

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        onPress={edit}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <IconBadge icon="flag-outline" color={goal.color} size={40} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium" numberOfLines={1}>
            {goal.name}
          </AppText>
          <AppText variant="caption" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
            {mask(`${format.money(item.saved)} / ${format.money(item.target)}`)}
          </AppText>
        </View>
        <AppText
          variant="heading"
          color={item.done ? 'income' : 'text'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {Math.floor(item.ratio * 100)}%
        </AppText>
      </Pressable>

      <ProgressBar value={item.ratio} color={item.done ? undefined : goal.color} height={8} />

      <AppText
        variant="caption"
        color={item.overdue ? 'expense' : item.done ? 'income' : 'textMuted'}
      >
        {item.done
          ? 'Đã đạt mục tiêu 🎉'
          : mask(
              `Còn thiếu ${format.money(item.remaining)}${
                goal.deadline ? ` · hạn ${formatDate(goal.deadline)}` : ''
              }${
                item.overdue
                  ? ` · quá hạn ${-(item.daysLeft ?? 0)} ngày`
                  : item.perMonth
                    ? ` · góp ${format.money(item.perMonth)}/tháng`
                    : ''
              }`,
            )}
      </AppText>

      {actions && !item.done ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {goal.accountId ? (
            <View style={{ flex: 1 }}>
              <Button title="Góp thêm" size="sm" icon="add" onPress={contribute} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button
              title="Sửa"
              size="sm"
              variant="secondary"
              icon="create-outline"
              onPress={edit}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
