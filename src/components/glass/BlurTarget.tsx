// Vùng nội dung để lớp kính phía trên làm mờ. Chỉ iOS mới làm mờ thật; Android dùng lớp phủ đặc
// (làm mờ thời gian thực trên Android chụp lại nội dung mỗi khung hình → giật và nóng máy).
import { BlurTargetView } from 'expo-blur';
import { forwardRef, type RefObject } from 'react';
import { Platform, View, type ViewProps, type View as RNView } from 'react-native';

export const BlurTarget = forwardRef<RNView, ViewProps>(function BlurTarget(props, ref) {
  return Platform.OS === 'ios' ? <BlurTargetView ref={ref as RefObject<RNView | null>} {...props} /> : <View ref={ref} {...props} />;
});
