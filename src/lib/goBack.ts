// Quay lại màn trước; nếu không có màn trước (mở từ thông báo / liên kết / khởi động lại ở màn này) thì về Tổng quan.
import { router } from 'expo-router';

export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
