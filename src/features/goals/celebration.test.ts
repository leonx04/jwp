import { newlyReached } from './useGoalCelebration';

describe('newlyReached', () => {
  it('chỉ trả về quỹ đang đạt mà chưa ăn mừng', () => {
    expect(newlyReached(['a', 'b'], ['a'])).toEqual(['b']);
    expect(newlyReached(['a'], ['a'])).toEqual([]);
    expect(newlyReached([], ['a'])).toEqual([]);
    expect(newlyReached(['a'], [])).toEqual(['a']);
  });
});
