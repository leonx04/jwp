// Đa ngôn ngữ: chuỗi tiếng Việt trong code là "khoá gốc"; ngôn ngữ khác tra theo đúng chuỗi đó.
// - t('Tổng số dư')                      → "Total balance" (en) / nguyên văn (vi)
// - t('Đã chi {amount}', { amount })     → thay {amount}
// Thiếu bản dịch → hiện tiếng Việt (không bao giờ trống). Thêm ngôn ngữ: tạo file <mã>.ts rồi đăng ký ở DICTIONARIES + LANGUAGES.
import { getLocales } from 'expo-localization';

import { useSettings } from '@/features/settings/store';

import { en } from './locales/en';

export type Language = 'vi' | 'en';
export type LanguagePreference = 'system' | Language;

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
];

const DICTIONARIES: Record<Language, Record<string, string>> = { vi: {}, en };

export function resolveLanguage(pref: LanguagePreference): Language {
  if (pref !== 'system') return pref;
  const device = getLocales()[0]?.languageCode ?? 'vi';
  return LANGUAGES.some((l) => l.code === device) ? (device as Language) : 'vi';
}

export function getLanguage(): Language {
  return resolveLanguage(useSettings.getState().language);
}

/** Hook: component gọi để tự vẽ lại khi đổi ngôn ngữ */
export function useLanguage(): Language {
  const pref = useSettings((s) => s.language);
  return resolveLanguage(pref);
}

/** Tra đúng chuỗi; không có thì thử bản bỏ khoảng trắng đầu/cuối (đoạn chữ cạnh biểu thức JSX hay có dấu cách) */
function lookup(dictionary: Record<string, string>, source: string): string {
  const exact = dictionary[source];
  if (exact !== undefined) return exact;
  const core = source.trim();
  const translated = core !== source ? dictionary[core] : undefined;
  if (translated === undefined) return source;
  const start = source.indexOf(core);
  return source.slice(0, start) + translated + source.slice(start + core.length);
}

export function t(
  source: string,
  params?: Record<string, string | number | null | undefined>,
): string {
  const lang = getLanguage();
  const text = lang === 'vi' ? source : lookup(DICTIONARIES[lang], source);
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key] ?? '') : match,
  );
}

/** Mã locale cho Intl / định dạng ngày giờ */
export function intlLocale(): string {
  return getLanguage() === 'vi' ? 'vi-VN' : 'en-US';
}
