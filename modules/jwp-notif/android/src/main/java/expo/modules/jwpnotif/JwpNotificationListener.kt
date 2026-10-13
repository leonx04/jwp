package expo.modules.jwpnotif

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Bắt thông báo của các app ngân hàng / ví điện tử trong danh sách cho phép (do JS đặt bằng
 * setAllowedPackages) và đưa vào hàng đợi. Thông báo của app khác và của chính JWP bị bỏ qua.
 */
class JwpNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val n = sbn ?: return
    val pkg = n.packageName ?: return
    if (pkg == packageName) return
    if (pkg !in CaptureStore.packages(this)) return

    val notification = n.notification ?: return
    // Thông báo tóm tắt nhóm không có nội dung riêng
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

    val extras = notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: ""
    if (title.isBlank() && text.isBlank()) return

    CaptureStore.add(this, "notification", pkg, title, text, n.postTime)
  }
}
