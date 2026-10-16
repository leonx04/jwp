import { useSettings } from '@/features/settings/store';

import { t } from './index';

describe('t()', () => {
  afterEach(() => useSettings.getState().update({ language: 'vi' }));

  it('tiếng Việt: giữ nguyên chuỗi gốc và thay tham số', () => {
    useSettings.getState().update({ language: 'vi' });
    expect(t('Tổng quan')).toBe('Tổng quan');
    expect(t('Chào {name}', { name: 'Jung' })).toBe('Chào Jung');
  });

  it('tiếng Anh: tra bản dịch, thiếu thì quay về tiếng Việt', () => {
    useSettings.getState().update({ language: 'en' });
    expect(t('Tổng quan')).toBe('Overview');
    expect(t('Chào {name}', { name: 'Jung' })).toBe('Hello Jung');
    expect(t('Chuỗi chưa dịch')).toBe('Chuỗi chưa dịch');
  });
});
