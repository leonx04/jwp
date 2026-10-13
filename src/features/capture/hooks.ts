import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  captureAvailable,
  drainQueue,
  setAllowedPackages,
  setSmsEnabled,
} from '../../../modules/jwp-notif';
import { showSnackbar } from '@/components/feedback/snackbarStore';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';

import { getCaptureConfig } from './config';
import { countPendingCaptures, ingestCaptures, listRecentCaptures } from './repository';
import { autoAcceptCaptures, listPendingWithGuess } from './rulesRepository';
import type { RawCapture } from './parse';

/** Kéo các thông báo / SMS service nền đã bắt được vào DB (khi mở app và mỗi lần quay lại app) */
export function syncCaptures(): number {
  if (!captureAvailable) return 0;
  const config = getCaptureConfig();
  setAllowedPackages(config.enabled ? config.packages : []);
  setSmsEnabled(config.enabled && config.sms);
  if (!config.enabled) return 0;
  const raws = drainQueue().map((n): RawCapture => ({
    source: n.source === 'sms' ? 'sms' : 'notification',
    sender: n.sender,
    title: n.title,
    text: n.text,
    postedAt: n.postedAt,
  }));
  if (!raws.length) return 0;
  const { pending } = ingestCaptures(db, raws, listAccounts(db));
  const auto = autoAcceptCaptures(db);
  if (auto > 0) {
    showSnackbar({ text: `Đã tự ghi ${auto} giao dịch theo quy tắc`, tone: 'success' });
  }
  return pending - auto;
}

/** Gắn một lần ở gốc app */
export function useCaptureSync() {
  useEffect(() => {
    if (!captureAvailable) return;
    const run = () => {
      try {
        syncCaptures();
      } catch {
        // đồng bộ lỗi không được làm hỏng app; lần sau thử lại
      }
    };
    run();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && run());
    return () => sub.remove();
  }, []);
}

export function usePendingCaptures() {
  return useLiveData(['captures', 'transactions', 'capture_rules'], () => listPendingWithGuess(db));
}

export function usePendingCaptureCount() {
  const { data } = useLiveData(['captures'], () => countPendingCaptures(db));
  return data ?? 0;
}

export function useRecentCaptures() {
  return useLiveData(['captures'], () => listRecentCaptures(db));
}
