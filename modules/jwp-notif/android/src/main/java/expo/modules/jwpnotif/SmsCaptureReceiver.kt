package expo.modules.jwpnotif

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/**
 * Nhận SMS mới (chỉ khi người dùng bật "đọc SMS" và đã cấp quyền RECEIVE_SMS).
 * Chỉ giữ tin từ người gửi dạng tên chữ (MBBANK, TPBank…): tin từ số điện thoại cá nhân bị bỏ qua.
 */
class SmsCaptureReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    if (!CaptureStore.smsEnabled(context)) return
    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return

    // Tin dài bị tách nhiều phần: ghép lại theo người gửi
    val bySender = LinkedHashMap<String, StringBuilder>()
    var time = System.currentTimeMillis()
    for (m in messages) {
      val address = m.originatingAddress ?: continue
      bySender.getOrPut(address) { StringBuilder() }.append(m.messageBody ?: "")
      time = m.timestampMillis
    }
    for ((address, body) in bySender) {
      if (address.none { it.isLetter() }) continue
      CaptureStore.add(context, "sms", address, "", body.toString(), time)
    }
  }
}
