// Ô chọn dạng dropdown: bấm mở bảng chọn từ dưới lên (có tìm kiếm), chọn một hoặc nhiều mục.
// Thay cho hàng chip dài chiếm chỗ (danh mục, tag, ví…). Không dùng Reanimated trong Modal (Android hay kẹt).
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppIcon } from '@/lib/icons';
import { normalizeForSearch } from '@/lib/text';
import { createStyles, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { IconBadge } from './IconBadge';

export type SelectOption = {
  id: string;
  label: string;
  icon?: AppIcon | null;
  color?: string | null;
  subtitle?: string;
};

type Common = {
  label?: string;
  placeholder: string;
  title?: string;
  options: readonly SelectOption[];
  /** Icon hiện ở ô chọn khi chưa chọn gì */
  icon?: AppIcon;
  /** Dòng cuối bảng, vd "Sửa danh mục" */
  action?: { label: string; onPress: () => void };
  /** Có truyền → gõ tên chưa có sẽ hiện "Tạo '…'" ; trả về id mục mới */
  onCreate?: (name: string) => string | null;
};

type Single = Common & {
  multiple?: false;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Cho phép bỏ chọn (hàng "Không chọn") */
  clearable?: boolean;
};

type Multi = Common & {
  multiple: true;
  value: readonly string[];
  onChange: (ids: string[]) => void;
};

export function SelectField(props: Single | Multi) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedIds = useMemo(
    () => (props.multiple ? [...props.value] : props.value ? [props.value] : []),
    [props.multiple, props.value],
  );
  const selected = selectedIds
    .map((id) => props.options.find((o) => o.id === id))
    .filter((o): o is SelectOption => !!o);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query);
    const list = q
      ? props.options.filter((o) => normalizeForSearch(o.label).includes(q))
      : [...props.options];
    // Mục đang chọn lên đầu để thấy ngay
    const set = new Set(selectedIds);
    return [...list.filter((o) => set.has(o.id)), ...list.filter((o) => !set.has(o.id))];
  }, [props.options, query, selectedIds]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const toggle = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (props.multiple) {
      props.onChange(
        selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
      );
    } else {
      props.onChange(props.value === id ? (props.clearable === false ? id : null) : id);
      close();
    }
  };

  const trimmed = query.trim();
  const canCreate =
    !!props.onCreate &&
    trimmed.length > 0 &&
    !props.options.some((o) => normalizeForSearch(o.label) === normalizeForSearch(trimmed));

  const create = () => {
    const id = props.onCreate?.(trimmed);
    if (!id) return;
    if (props.multiple) props.onChange([...selectedIds, id]);
    else {
      props.onChange(id);
      close();
    }
    setQuery('');
  };

  const first = selected[0];
  const summary =
    selected.length === 0
      ? props.placeholder
      : selected.length <= 2
        ? selected.map((o) => o.label).join(', ')
        : `${selected[0].label} +${selected.length - 1}`;

  return (
    <View style={styles.wrapper}>
      {props.label ? (
        <AppText variant="label" color="textMuted">
          {props.label}
        </AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.label ?? props.placeholder}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.box, pressed && { opacity: 0.7 }]}
      >
        {first?.icon ? (
          <IconBadge icon={first.icon} color={first.color ?? undefined} size={30} />
        ) : props.icon ? (
          <Ionicons name={props.icon as never} size={20} color={colors.textMuted} />
        ) : null}
        <AppText
          style={{ flex: 1 }}
          color={selected.length ? 'text' : 'textMuted'}
          numberOfLines={1}
        >
          {summary}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.root}>
          <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Đóng" />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
            <View style={styles.handle} />
            <AppText variant="heading" style={styles.title}>
              {props.title ?? props.label ?? props.placeholder}
            </AppText>
            {props.options.length > 7 || props.onCreate ? (
              <View style={styles.search}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={props.onCreate ? 'Tìm hoặc gõ tên mới…' : 'Tìm…'}
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.primary}
                  style={[styles.searchInput, { color: colors.text }]}
                  autoCorrect={false}
                />
              </View>
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(o) => o.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListHeaderComponent={
                canCreate ? (
                  <Pressable style={styles.row} onPress={create}>
                    <IconBadge icon="add" size={34} />
                    <AppText style={{ flex: 1 }} color="primary">
                      Tạo “{trimmed}”
                    </AppText>
                  </Pressable>
                ) : !props.multiple && props.clearable && props.value ? (
                  <Pressable style={styles.row} onPress={() => props.onChange(null)}>
                    <IconBadge icon="close" size={34} />
                    <AppText style={{ flex: 1 }} color="textMuted">
                      Bỏ chọn
                    </AppText>
                  </Pressable>
                ) : null
              }
              ListEmptyComponent={
                <AppText color="textMuted" style={{ padding: 16 }}>
                  Không có mục nào khớp.
                </AppText>
              }
              renderItem={({ item }) => {
                const on = selectedIds.includes(item.id);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                    onPress={() => toggle(item.id)}
                  >
                    <IconBadge
                      icon={item.icon ?? 'ellipse-outline'}
                      color={item.color ?? undefined}
                      size={34}
                    />
                    <View style={{ flex: 1 }}>
                      <AppText numberOfLines={1}>{item.label}</AppText>
                      {item.subtitle ? (
                        <AppText variant="caption" color="textMuted" numberOfLines={1}>
                          {item.subtitle}
                        </AppText>
                      ) : null}
                    </View>
                    {on ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
            {props.action ? (
              <Pressable
                style={styles.row}
                onPress={() => {
                  close();
                  props.action?.onPress();
                }}
              >
                <IconBadge icon="settings-outline" size={34} />
                <AppText style={{ flex: 1 }} color="primary">
                  {props.action.label}
                </AppText>
              </Pressable>
            ) : null}
            {props.multiple ? <Button title="Xong" onPress={close} /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  wrapper: { gap: t.spacing.xs },
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
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: t.spacing.lg,
    paddingTop: 8,
    gap: t.spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.border,
    marginBottom: 4,
  },
  title: { paddingVertical: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
    minHeight: 44,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.glassFill,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 52,
    paddingVertical: 6,
  },
}));
