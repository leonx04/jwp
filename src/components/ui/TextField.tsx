import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import type { IconName } from '@/lib/icons';
import { createStyles, useTheme } from '@/theme';

import { AppText } from './AppText';

type TextFieldProps = TextInputProps & {
  label?: string;
  icon?: IconName;
};

/** Ô nhập kính bo tròn */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, icon, style, multiline, ...rest },
  ref,
) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.wrapper}>
      {label ? (
        <AppText variant="label" color="textMuted">
          {label}
        </AppText>
      ) : null}
      <View style={[styles.box, multiline && styles.multilineBox]}>
        {icon ? <Ionicons name={icon} size={18} color={theme.colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          multiline={multiline}
          style={[styles.input, multiline && styles.multiline, style]}
          {...rest}
        />
      </View>
    </View>
  );
});

const useStyles = createStyles((t) => ({
  wrapper: {
    gap: t.spacing.xs,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 48,
    paddingHorizontal: t.spacing.lg,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.glassBorder,
    backgroundColor: t.colors.glassFill,
  },
  multilineBox: {
    alignItems: 'flex-start',
    paddingVertical: t.spacing.sm,
  },
  input: {
    flex: 1,
    ...t.typography.body,
    color: t.colors.text,
    paddingVertical: t.spacing.sm,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
}));
