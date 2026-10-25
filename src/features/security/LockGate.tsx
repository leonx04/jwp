// Màn khoá phủ lên toàn app khi bật "Khoá app": lúc mở app, và khi quay lại sau hơn 30 giây.
// Phủ lên thay vì bỏ cây điều hướng → mở khoá xong vẫn đúng màn đang xem dở.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useSettings } from '@/features/settings/store';
import { t } from '@/lib/i18n';
import { useTheme } from '@/theme';

import { authenticate, shouldRelock } from './lock';

export function LockGate({ children }: { children: ReactNode }) {
  const enabled = useSettings((s) => s.appLock);
  const [lockedState, setLocked] = useState(enabled);
  // Tắt khoá trong Cài đặt → mở ngay
  const locked = enabled && lockedState;
  const busy = useRef(false);
  const leftAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (await authenticate(t('Mở khoá JWP'))) setLocked(false);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      // Hộp vân tay của hệ thống cũng làm app đổi trạng thái → bỏ qua khi đang mở khoá
      if (busy.current) return;
      if (state === 'background') leftAt.current = Date.now();
      else if (state === 'active') {
        if (useSettings.getState().appLock && shouldRelock(leftAt.current, Date.now())) {
          setLocked(true);
        }
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  // Vừa khoá → tự hiện hộp mở khoá, khỏi phải bấm nút
  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked ? <LockScreen onUnlock={() => void unlock()} /> : null}
    </View>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
          padding: spacing.xl,
        },
      ]}
    >
      <Ionicons name="lock-closed" size={44} color={colors.primary} />
      <AppText variant="title">JWP đang khoá</AppText>
      <AppText color="textMuted" style={{ textAlign: 'center' }}>
        Dùng vân tay, khuôn mặt hoặc mã PIN của máy để mở.
      </AppText>
      <Button title="Mở khoá" icon="finger-print" onPress={onUnlock} />
    </View>
  );
}
