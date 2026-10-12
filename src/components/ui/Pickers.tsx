// Bộ chọn màu + bộ chọn biểu tượng hợp nhất (Ionicons theo nhóm + logo ngân hàng / ví điện tử).
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DEFAULT_ACCOUNT_ICON,
  DEFAULT_CATEGORY_ICON,
  iconInfo,
  type AppIcon,
  type IconName,
} from '@/lib/icons';
import {
  BANK_GROUP_KEY,
  filterIconGroups,
  iconOptionGroups,
  iconOptionLabel,
  suggestIcons,
  type IconOption,
  type IconOptionGroup,
  type IconPickerKind,
} from '@/lib/icons/search';
import { bankFromIcon } from '@/lib/banks';
import { createStyles, readableOn, rgba, useTheme } from '@/theme';

import { AppText } from './AppText';
import { BankMark } from './BankMark';
import { Chip } from './Chip';
import { IconBadge } from './IconBadge';
import { TextField } from './TextField';

/** Bảng màu cho ví / danh mục / tag */
export const COLOR_CHOICES = [
  '#5B5BD6',
  '#7C3AED',
  '#2563EB',
  '#0EA5E9',
  '#0D9488',
  '#16A34A',
  '#65A30D',
  '#CA8A04',
  '#EA580C',
  '#DC2626',
  '#E11D48',
  '#DB2777',
  '#A16207',
  '#64748B',
  '#475569',
  '#111827',
] as const;

const COLOR_COLUMNS = 8;

/** Lưới màu 8 cột chia đều bề ngang (không hở mép phải) */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
      {COLOR_CHOICES.map((color) => {
        const selected = color.toUpperCase() === value.toUpperCase();
        return (
          <View key={color} style={{ width: `${100 / COLOR_COLUMNS}%`, alignItems: 'center' }}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={color}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChange(color);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: color,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 3,
                borderColor: selected ? colors.text : 'transparent',
              }}
            >
              {selected ? <Ionicons name="checkmark" size={18} color={readableOn(color)} /> : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// ───────────────────────────── Bộ chọn biểu tượng ─────────────────────────────

type IconPickerProps = {
  value: AppIcon;
  onChange: (icon: AppIcon) => void;
  /** Màu của danh mục / ví — tô icon đang chọn */
  color: string;
  /**
   * 'compact' (mặc định): một dòng icon hiện tại + "Đổi biểu tượng" mở bảng chọn trượt từ dưới lên,
   * kèm hàng gợi ý theo tên. 'inline': lưới chọn ngay trong màn (lọc theo nhóm, có ô tìm).
   */
  mode?: 'compact' | 'inline';
  /** 'account': đưa logo ngân hàng & nhóm tài chính lên đầu */
  kind?: IconPickerKind;
  /** Văn bản để gợi ý icon (vd tên danh mục đang nhập) */
  hint?: string;
  /** Gợi ý cả logo ngân hàng nhận ra từ hint (mặc định bật) */
  hintBanks?: boolean;
  /** Tiêu đề dòng compact & bảng chọn */
  title?: string;
};

/**
 * Chọn biểu tượng cho danh mục / ví: ~170 icon theo nhóm đời sống người Việt + logo ngân hàng & ví
 * điện tử, tìm không dấu ("ca phe", "xang", "vcb"). Giá trị lưu là AppIcon (tên Ionicons hoặc 'bank:<CODE>').
 */
export function IconPicker({
  value,
  onChange,
  color,
  mode = 'compact',
  kind = 'category',
  hint,
  hintBanks = true,
  title = 'Biểu tượng',
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(
    () => (hint ? suggestIcons(hint, { banks: hintBanks }) : []),
    [hint, hintBanks],
  );

  if (mode === 'inline') {
    return (
      <IconPickerPanel
        value={value}
        onChange={onChange}
        color={color}
        kind={kind}
        suggestions={suggestions}
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <CompactRow value={value} color={color} title={title} onPress={() => setOpen(true)} />
      {suggestions.length > 0 ? (
        <SuggestionStrip
          suggestions={suggestions}
          value={value}
          color={color}
          onPick={onChange}
        />
      ) : null}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <IconPickerSheet
          title={title}
          value={value}
          color={color}
          kind={kind}
          suggestions={suggestions}
          onClose={() => setOpen(false)}
          onChange={(icon) => {
            onChange(icon);
            setOpen(false);
          }}
        />
      </Modal>
    </View>
  );
}

function CompactRow({
  value,
  color,
  title,
  onPress,
}: {
  value: AppIcon;
  color: string;
  title: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const label = iconOptionLabel(value) ?? 'Biểu tượng riêng';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${label}. Đổi biểu tượng`}
      onPress={onPress}
      style={({ pressed }) => [styles.compact, pressed && { opacity: 0.75 }]}
    >
      <IconBadge icon={value} color={color} size={44} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <View style={styles.changeButton}>
        <AppText variant="label" color="primary" style={{ fontSize: 13 }}>
          Đổi biểu tượng
        </AppText>
      </View>
    </Pressable>
  );
}

/** Hàng gợi ý theo tên — chọn một chạm, không cần mở bảng */
function SuggestionStrip({
  suggestions,
  value,
  color,
  onPick,
}: {
  suggestions: AppIcon[];
  value: AppIcon;
  color: string;
  onPick: (icon: AppIcon) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label" color="textMuted">
        Gợi ý theo tên
      </AppText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {suggestions.map((icon) => {
          const selected = icon === value;
          const bank = bankFromIcon(icon);
          return (
            <Pressable
              key={icon}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={iconOptionLabel(icon) ?? icon}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onPick(icon);
              }}
              style={({ pressed }) => ({
                flex: 1,
                maxWidth: 56,
                aspectRatio: 1,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: selected ? color : 'transparent',
                backgroundColor: selected ? rgba(color, colors.dark ? 0.28 : 0.14) : colors.glassFill,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {bank ? (
                <BankMark bank={bank} size={32} />
              ) : (
                <Ionicons
                  name={icon as IconName}
                  size={22}
                  color={selected ? color : colors.textMuted}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Bảng chọn trượt từ dưới lên (nằm trong <Modal>) */
function IconPickerSheet({
  title,
  value,
  color,
  kind,
  suggestions,
  onChange,
  onClose,
}: {
  title: string;
  value: AppIcon;
  color: string;
  kind: IconPickerKind;
  suggestions: AppIcon[];
  onChange: (icon: AppIcon) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.86);

  // Trượt lên khi mở (Modal tự mờ dần nền tối)
  const offset = useSharedValue(sheetHeight);
  useEffect(() => {
    offset.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [offset]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <View style={styles.sheetRoot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đóng"
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
      />
      <Animated.View
        style={[styles.sheet, { height: sheetHeight, paddingBottom: insets.bottom + 8 }, slide]}
      >
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <AppText variant="heading" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>
        <IconPickerPanel
          value={value}
          onChange={onChange}
          color={color}
          kind={kind}
          suggestions={suggestions}
          scrollable
        />
      </Animated.View>
    </View>
  );
}

// ───────────────────────────── Lưới icon ─────────────────────────────

const GAP = 8;
const MIN_CELL = 48;
const HEADER_HEIGHT = 36;
const BANK_LABEL_HEIGHT = 16;
const SUGGESTED_KEY = 'suggested';

type Row =
  | { type: 'header'; key: string; label: string }
  | { type: 'icons'; key: string; options: readonly IconOption[]; labeled: boolean };

/** Số cột cố định theo bề ngang đo được, ô chia đều → lưới lấp đầy, không hở mép phải */
function gridLayout(width: number) {
  const columns = Math.max(4, Math.min(8, Math.floor((width + GAP) / (MIN_CELL + GAP))));
  // Làm tròn xuống 0,1 để tổng không vượt bề ngang do sai số
  const size = Math.floor(((width - GAP * (columns - 1)) / columns) * 10) / 10;
  return { columns, size };
}

function buildRows(groups: readonly IconOptionGroup[], columns: number, headers: boolean): Row[] {
  const rows: Row[] = [];
  for (const group of groups) {
    if (headers) rows.push({ type: 'header', key: `h:${group.key}`, label: group.label });
    // Logo ngân hàng kèm tên (nhiều logo cùng tông xanh, dễ nhầm)
    const labeled = group.options.some((o) => o.bank);
    for (let i = 0; i < group.options.length; i += columns) {
      rows.push({
        type: 'icons',
        key: `${group.key}:${i}`,
        options: group.options.slice(i, i + columns),
        labeled,
      });
    }
  }
  return rows;
}

const rowHeight = (row: Row, size: number) =>
  row.type === 'header' ? HEADER_HEIGHT : size + GAP + (row.labeled ? BANK_LABEL_HEIGHT : 0);

function IconPickerPanel({
  value,
  onChange,
  color,
  kind,
  suggestions,
  scrollable = false,
}: {
  value: AppIcon;
  onChange: (icon: AppIcon) => void;
  color: string;
  kind: IconPickerKind;
  suggestions: AppIcon[];
  /** true: danh sách cuộn ảo hoá (trong bảng chọn), có tab "Tất cả" */
  scrollable?: boolean;
}) {
  const baseGroups = iconOptionGroups(kind);

  // Nhóm "Gợi ý theo tên" đứng đầu khi xem tất cả
  const suggestedGroup = useMemo<IconOptionGroup | null>(() => {
    if (!suggestions.length) return null;
    const all = new Map(baseGroups.flatMap((g) => g.options.map((o) => [o.icon, o] as const)));
    const options = suggestions.map((icon) => all.get(icon)).filter((o): o is IconOption => !!o);
    return options.length ? { key: SUGGESTED_KEY, label: 'Gợi ý theo tên', options } : null;
  }, [baseGroups, suggestions]);

  // Inline: mở sẵn nhóm chứa icon đang chọn (không có "Tất cả" để tránh một bức tường icon)
  const [groupKey, setGroupKey] = useState<string | null>(() =>
    scrollable ? null : (groupKeyOf(value) ?? baseGroups[0].key),
  );
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [width, setWidth] = useState(0);

  const searching = deferredQuery.trim().length > 0;
  const groups = useMemo(() => {
    if (searching) return filterIconGroups(baseGroups, deferredQuery);
    if (groupKey) return baseGroups.filter((g) => g.key === groupKey);
    return suggestedGroup ? [suggestedGroup, ...baseGroups] : baseGroups;
  }, [baseGroups, deferredQuery, groupKey, searching, suggestedGroup]);

  const { columns, size } = useMemo(() => gridLayout(width), [width]);
  const showHeaders = searching || groupKey === null;
  const rows = useMemo(
    () => (width > 0 ? buildRows(groups, columns, showHeaders) : []),
    [columns, groups, showHeaders, width],
  );

  // Hàm chọn ổn định → các ô memo không vẽ lại khi màn cha render
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const pick = useCallback((icon: AppIcon) => {
    Haptics.selectionAsync().catch(() => {});
    onChangeRef.current(icon);
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  const renderRow = (row: Row): ReactElement =>
    row.type === 'header' ? (
      <View key={row.key} style={{ height: HEADER_HEIGHT, justifyContent: 'center' }}>
        <AppText variant="bodyMedium" color="textMuted" style={{ fontSize: 14 }}>
          {row.label}
        </AppText>
      </View>
    ) : (
      <IconRow
        key={row.key}
        options={row.options}
        labeled={row.labeled}
        size={size}
        // Chỉ hàng chứa icon đang chọn nhận giá trị → chọn icon chỉ vẽ lại 1–2 hàng
        selected={row.options.some((o) => o.icon === value) ? value : null}
        color={color}
        onPick={pick}
      />
    );

  const chips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 8 }}
      style={{ flexGrow: 0 }}
    >
      {scrollable ? (
        <Chip
          label="Tất cả"
          selected={groupKey === null && !searching}
          onPress={() => {
            setGroupKey(null);
            setQuery('');
          }}
        />
      ) : null}
      {baseGroups.map((g) => (
        <Chip
          key={g.key}
          label={g.label}
          selected={groupKey === g.key && !searching}
          onPress={() => {
            setGroupKey(g.key);
            setQuery('');
          }}
        />
      ))}
    </ScrollView>
  );

  const empty =
    searching && rows.length === 0 ? (
      <AppText variant="caption" color="textMuted" style={{ paddingVertical: 12 }}>
        Không tìm thấy “{deferredQuery.trim()}”. Thử từ khác: ăn, xăng, điện, lương, MB, Momo…
      </AppText>
    ) : null;

  // Cuộn tới hàng đang chọn khi mở bảng (bỏ qua icon mặc định để bảng mở từ đầu)
  const defaultIcon = kind === 'account' ? DEFAULT_ACCOUNT_ICON : DEFAULT_CATEGORY_ICON;
  const selectedRowIndex =
    value === defaultIcon
      ? -1
      : rows.findIndex((r) => r.type === 'icons' && r.options.some((o) => o.icon === value));

  return (
    <View style={[{ gap: 12 }, scrollable && { flex: 1 }]}>
      <TextField
        icon="search"
        placeholder="Tìm: cà phê, xăng, điện, MB, Momo…"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {chips}
      <View onLayout={onLayout} style={scrollable ? { flex: 1 } : undefined}>
        {width === 0 ? null : scrollable ? (
          <IconList
            rows={rows}
            size={size}
            renderRow={renderRow}
            extra={`${value}|${color}|${size}`}
            initialIndex={selectedRowIndex > 0 ? selectedRowIndex - 1 : 0}
            footer={empty}
          />
        ) : (
          <>
            {rows.map(renderRow)}
            {empty}
          </>
        )}
      </View>
      {scrollable ? null : (
        <AppText variant="caption" color="textMuted">
          {groupKey === BANK_GROUP_KEY
            ? 'Logo hiện ở mọi nơi dùng danh mục / ví này'
            : 'Chọn nhóm hoặc gõ để tìm, không cần dấu'}
        </AppText>
      )}
    </View>
  );
}

/** Danh sách ảo hoá cho bảng chọn: chiều cao hàng cố định → getItemLayout chính xác */
function IconList({
  rows,
  size,
  renderRow,
  extra,
  initialIndex,
  footer,
}: {
  rows: Row[];
  size: number;
  renderRow: (row: Row) => ReactElement;
  extra: string;
  initialIndex: number;
  footer: ReactElement | null;
}) {
  const offsets = useMemo(() => {
    const out: number[] = [];
    let y = 0;
    for (const row of rows) {
      out.push(y);
      y += rowHeight(row, size);
    }
    return out;
  }, [rows, size]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={({ item }) => renderRow(item)}
      extraData={extra}
      getItemLayout={(_, index) => ({
        length: rows[index] ? rowHeight(rows[index], size) : 0,
        offset: offsets[index] ?? 0,
        index,
      })}
      initialScrollIndex={initialIndex < rows.length ? initialIndex : 0}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={7}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      ListFooterComponent={footer}
      contentContainerStyle={{ paddingBottom: 16 }}
    />
  );
}

const IconRow = memo(function IconRow({
  options,
  labeled,
  size,
  selected,
  color,
  onPick,
}: {
  options: readonly IconOption[];
  labeled: boolean;
  size: number;
  selected: AppIcon | null;
  color: string;
  onPick: (icon: AppIcon) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: GAP,
        height: size + GAP + (labeled ? BANK_LABEL_HEIGHT : 0),
      }}
    >
      {options.map((option) => (
        <IconCell
          key={option.icon}
          option={option}
          size={size}
          labeled={labeled}
          selected={option.icon === selected}
          color={color}
          onPick={onPick}
        />
      ))}
    </View>
  );
});

const IconCell = memo(function IconCell({
  option,
  size,
  labeled,
  selected,
  color,
  onPick,
}: {
  option: IconOption;
  size: number;
  labeled: boolean;
  selected: boolean;
  color: string;
  onPick: (icon: AppIcon) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}
      onPress={() => onPick(option.icon)}
      style={({ pressed }) => ({ width: size, alignItems: 'center', opacity: pressed ? 0.65 : 1 })}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size / 3.2),
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: selected ? color : 'transparent',
          backgroundColor: selected ? rgba(color, colors.dark ? 0.28 : 0.14) : colors.glassFill,
        }}
      >
        {option.bank ? (
          <BankMark bank={option.bank} size={Math.round(size * 0.68)} />
        ) : (
          <Ionicons
            name={option.icon as IconName}
            size={Math.round(size * 0.46)}
            color={selected ? color : colors.textMuted}
          />
        )}
      </View>
      {labeled ? (
        <AppText
          variant="label"
          color={selected ? 'text' : 'textMuted'}
          numberOfLines={1}
          style={{ fontSize: 10, lineHeight: BANK_LABEL_HEIGHT, maxWidth: size }}
        >
          {option.label}
        </AppText>
      ) : null}
    </Pressable>
  );
});

/** Nhóm chứa icon (để mở đúng tab ở chế độ inline) */
function groupKeyOf(icon: AppIcon): string | null {
  if (bankFromIcon(icon)) return BANK_GROUP_KEY;
  return iconInfo(icon)?.group ?? null;
}

const useStyles = createStyles((t) => ({
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
  },
  changeButton: {
    paddingHorizontal: t.spacing.md,
    height: 32,
    borderRadius: t.radius.full,
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radius.xl,
    borderTopRightRadius: t.radius.xl,
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: t.spacing.sm,
    backgroundColor: t.colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.glassFill,
  },
}));
