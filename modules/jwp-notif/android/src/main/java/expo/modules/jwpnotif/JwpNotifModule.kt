package expo.modules.jwpnotif

import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Cầu nối JS ↔ service đọc thông báo / bộ nhận SMS. Service chạy nền độc lập với JS;
 * JS chỉ đặt cấu hình (app nào, có đọc SMS không) và lấy hàng đợi ra khi mở app.
 */
class JwpNotifModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("JwpNotif")

    // Quyền "Truy cập thông báo" đã bật cho JWP chưa
    Function("isListenerEnabled") {
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      enabled?.split(":")?.any { it.startsWith(context.packageName + "/") } ?: false
    }

    Function("openListenerSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("setAllowedPackages") { packages: List<String> ->
      CaptureStore.setPackages(context, packages)
    }

    Function("setSmsEnabled") { enabled: Boolean ->
      CaptureStore.setSmsEnabled(context, enabled)
    }

    Function("drainQueue") {
      CaptureStore.drain(context)
    }
  }
}
