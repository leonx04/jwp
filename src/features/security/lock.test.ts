import { authenticate, lockSupport, shouldRelock } from './lock';

// Giả lập bản cài cũ: chưa có module native ExpoLocalAuthentication
jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: (name: string) =>
    name === 'ExpoLocalAuthentication'
      ? null
      : jest.requireActual('expo-modules-core').requireOptionalNativeModule(name),
}));

describe('khoá app', () => {
  it('rời app dưới 30 giây thì không khoá lại', () => {
    expect(shouldRelock(null, 1_000_000)).toBe(false);
    expect(shouldRelock(1_000_000, 1_029_999)).toBe(false);
    expect(shouldRelock(1_000_000, 1_030_000)).toBe(true);
  });

  it('bản cài chưa có module native → không hỗ trợ và không chặn người dùng', async () => {
    await expect(lockSupport()).resolves.toBe('unsupported');
    await expect(authenticate('Mở khoá JWP')).resolves.toBe(true);
  });
});
