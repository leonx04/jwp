import { moveItem } from './move';

describe('moveItem', () => {
  it('đổi chỗ với phần tử kề; ngoài biên thì giữ nguyên; không sửa mảng gốc', () => {
    const a = ['a', 'b', 'c'];
    expect(moveItem(a, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(a, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(a, 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(a, 2, 1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(a, 9, 1)).toEqual(['a', 'b', 'c']);
    expect(a).toEqual(['a', 'b', 'c']);
  });
});
