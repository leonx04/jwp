// Khung chung cho mọi màn hình: nền lỏng + nội dung + header kính nổi (làm mờ thật nội dung cuộn phía sau).
// - Màn trong stack: truyền `title` → header gọn có nút quay lại / đóng.
// - Màn tab: `largeTitle` → tiêu đề lớn nằm trong nội dung, header gọn chỉ hiện khi cuộn xuống.
import { goBack } from '@/lib/goBack';
import { t } from '@/lib/i18n';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type View as RNView,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlurTarget } from '@/components/glass/BlurTarget';
import { AppBackground } from '@/components/glass/AppBackground';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { IconButton } from '@/components/glass/IconButton';
import { useTheme } from '@/theme';

import { AppText } from './AppText';

/** Chiều cao dock nổi + khoảng hở — màn tab cần chừa chỗ này ở cuối nội dung */
export const TAB_BAR_HEIGHT = 64;
const HEADER_BAR = 56;
const FOOTER_RADIUS = 28;

type ScreenLayout = {
  blurTarget: RefObject<RNView | null>;
  /** Khoảng cần chừa phía trên (header) */
  top: number;
  /** Khoảng cần chừa phía dưới (thanh tab / footer) */
  bottom: number;
  scrollY: SharedValue<number>;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  /** Dành cho FlashList / FlatList: chúng tự gọi onScroll như hàm thường nên không nhận được handler của Reanimated */
  onScrollJS: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const ScreenContext = createContext<ScreenLayout | null>(null);

/** Dùng trong màn tự quản lý danh sách (FlashList) để biết phần đệm trên/dưới và gắn onScroll */
export function useScreenLayout(): ScreenLayout {
  const ctx = useContext(ScreenContext);
  if (!ctx) throw new Error('useScreenLayout phải nằm trong <Screen>');
  return ctx;
}

type ScreenProps = {
  children: ReactNode;
  /** false: màn hình tự dùng danh sách (FlashList) — lấy phần đệm qua useScreenLayout() */
  scroll?: boolean;
  title?: string;
  /** Dòng nhỏ phía trên tiêu đề lớn (vd ngày hôm nay) */
  subtitle?: string;
  largeTitle?: boolean;
  /** Nút bên trái header: quay lại / đóng (modal) / không có */
  leading?: 'back' | 'close' | 'none';
  headerRight?: ReactNode;
  /** Màn nằm trong tab → chừa chỗ cho thanh tab nổi */
  tabBar?: boolean;
  /** Vùng cố định dưới cùng (vd nút Lưu, bàn phím số) */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = true,
  title,
  subtitle,
  largeTitle = false,
  leading,
  headerRight,
  tabBar = false,
  footer,
  contentStyle,
}: ScreenProps) {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<RNView>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const onScrollJS = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.set(e.nativeEvent.contentOffset.y);
    },
    [scrollY],
  );

  const lead = leading ?? (title && !largeTitle ? 'back' : 'none');
  const showHeader = !!title || lead !== 'none' || !!headerRight;
  const headerHeight = insets.top + HEADER_BAR;
  const top = largeTitle
    ? insets.top + spacing.sm
    : showHeader
      ? headerHeight + spacing.md
      : insets.top + spacing.sm;
  const bottom = tabBar
    ? insets.bottom + TAB_BAR_HEIGHT + spacing.xl + spacing.md
    : footer
      ? footerHeight + spacing.lg
      : insets.bottom + spacing.xl;

  const layout: ScreenLayout = { blurTarget, top, bottom, scrollY, onScroll, onScrollJS };

  return (
    <ScreenContext.Provider value={layout}>
      <View style={styles.root}>
        <BlurTarget ref={blurTarget} style={StyleSheet.absoluteFill}>
          <AppBackground />
          {scroll ? (
            <Animated.ScrollView
              onScroll={onScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                {
                  paddingTop: top,
                  paddingBottom: bottom,
                  paddingHorizontal: spacing.lg,
                  gap: spacing.lg,
                },
                contentStyle,
              ]}
            >
              {largeTitle && title ? (
                <LargeTitle title={title} subtitle={subtitle} right={headerRight} />
              ) : null}
              {children}
            </Animated.ScrollView>
          ) : (
            <View style={[styles.fill, contentStyle]}>{children}</View>
          )}
        </BlurTarget>

        {showHeader && (!largeTitle || title) ? (
          <GlassHeader
            title={title}
            leading={lead}
            right={largeTitle ? null : headerRight}
            collapsible={largeTitle}
          />
        ) : null}

        {footer ? (
          // Ghim dưới đáy như một bảng trượt kính; đo chiều cao để nội dung cuộn chừa đủ chỗ
          <View
            style={styles.footer}
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          >
            <GlassSurface
              variant="chrome"
              blurTarget={blurTarget}
              radius={FOOTER_RADIUS}
              shadow
              style={{ marginBottom: -FOOTER_RADIUS }}
              contentStyle={{ paddingBottom: insets.bottom + spacing.sm + FOOTER_RADIUS }}
            >
              {footer}
            </GlassSurface>
          </View>
        ) : null}
      </View>
    </ScreenContext.Provider>
  );
}

/** Tiêu đề lớn (màn tab) — dùng lại được trong ListHeaderComponent của FlashList */
export function LargeTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.largeTitle}>
      <View style={styles.fill}>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
        <AppText variant="display">{title}</AppText>
      </View>
      {right ? <View style={styles.row}>{right}</View> : null}
    </View>
  );
}

function GlassHeader({
  title,
  leading,
  right,
  collapsible,
}: {
  title?: string;
  leading: 'back' | 'close' | 'none';
  right?: ReactNode;
  collapsible: boolean;
}) {
  const { blurTarget, scrollY } = useScreenLayout();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  // Màn tiêu đề lớn: nền kính + tiêu đề gọn hiện dần khi tiêu đề lớn cuộn khuất
  const fade = useAnimatedStyle(() => ({
    opacity: collapsible ? interpolate(scrollY.value, [56, 92], [0, 1], Extrapolation.CLAMP) : 1,
  }));

  return (
    <View
      pointerEvents={collapsible ? 'box-none' : 'auto'}
      style={[styles.header, { height: insets.top + HEADER_BAR, paddingTop: insets.top }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, fade]} pointerEvents="none">
        <GlassSurface
          variant="chrome"
          blurTarget={blurTarget}
          radius={0}
          bordered={false}
          shadow={false}
          style={StyleSheet.absoluteFill}
          contentStyle={StyleSheet.absoluteFill}
        />
        <View style={[styles.hairline, { backgroundColor: colors.glassBorder }]} />
      </Animated.View>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
        {leading !== 'none' ? (
          <IconButton
            icon={leading === 'close' ? 'close' : 'chevron-back'}
            accessibilityLabel={t(leading === 'close' ? 'Đóng' : 'Quay lại')}
            onPress={() => goBack()}
          />
        ) : null}
        <Animated.View style={[styles.fill, collapsible && fade]}>
          {title ? (
            <AppText variant="heading" numberOfLines={1}>
              {title}
            </AppText>
          ) : null}
        </Animated.View>
        {right ? <View style={styles.row}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  largeTitle: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
});
