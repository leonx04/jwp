import { Switch } from 'react-native';

import { useTheme, withAlpha } from '@/theme';

import type { IconName } from './IconBadge';
import { ListRow } from './ListRow';

type SwitchRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export function SwitchRow({ value, onValueChange, disabled, ...row }: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <ListRow
      {...row}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.5) }}
          thumbColor={value ? colors.primary : colors.surfaceAlt}
        />
      }
    />
  );
}
