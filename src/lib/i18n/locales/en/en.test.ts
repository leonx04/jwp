import { en } from './index';

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('bản dịch tiếng Anh', () => {
  it('không có bản dịch rỗng', () => {
    const empty = Object.entries(en).filter(([, value]) => !value.trim());
    expect(empty).toEqual([]);
  });

  it('giữ nguyên các biến {tên} của câu gốc', () => {
    const broken = Object.entries(en)
      .filter(([source, value]) => placeholders(source) !== placeholders(value))
      .map(([source]) => source);
    expect(broken).toEqual([]);
  });
});
