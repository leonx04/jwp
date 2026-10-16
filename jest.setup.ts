// Chạy trước mọi file test. Module native (SQLite) không có trong môi trường Node → thay bằng bản giả.
jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (key: string) => store.get(key) ?? null,
      setItemSync: (key: string, value: string) => void store.set(key, value),
      removeItemSync: (key: string) => store.delete(key),
    },
  };
});

// Máy thử mặc định tiếng Việt để chuỗi hiển thị khớp bản gốc
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'vi', languageTag: 'vi-VN' }],
}));
