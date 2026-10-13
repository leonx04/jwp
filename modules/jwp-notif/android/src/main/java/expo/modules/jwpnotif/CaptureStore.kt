package expo.modules.jwpnotif

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Hàng đợi các thông báo / SMS đã bắt được, lưu trong SharedPreferences để service nền ghi được
 * ngay cả khi app (JS) không chạy. JS lấy ra bằng drainQueue() mỗi lần mở app.
 * Toàn bộ dữ liệu nằm trên máy, không gửi đi đâu.
 */
object CaptureStore {
  private const val PREFS = "jwp_capture"
  private const val KEY_QUEUE = "queue"
  private const val KEY_PACKAGES = "packages"
  private const val KEY_SMS = "sms"

  /** Giữ tối đa bấy nhiêu mục chưa lấy (cũ nhất bị bỏ trước) */
  private const val MAX_ITEMS = 300

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun setPackages(context: Context, packages: List<String>) {
    prefs(context).edit().putStringSet(KEY_PACKAGES, packages.toSet()).apply()
  }

  fun packages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_PACKAGES, emptySet()) ?: emptySet()

  fun setSmsEnabled(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_SMS, enabled).apply()
  }

  fun smsEnabled(context: Context): Boolean = prefs(context).getBoolean(KEY_SMS, false)

  @Synchronized
  fun add(context: Context, source: String, sender: String, title: String, text: String, postedAt: Long) {
    val p = prefs(context)
    val queue = try {
      JSONArray(p.getString(KEY_QUEUE, "[]"))
    } catch (e: Exception) {
      JSONArray()
    }
    queue.put(
      JSONObject()
        .put("source", source)
        .put("sender", sender)
        .put("title", title)
        .put("text", text)
        .put("postedAt", postedAt),
    )
    // Quá giới hạn: bỏ các mục cũ nhất
    val trimmed = if (queue.length() > MAX_ITEMS) {
      val out = JSONArray()
      for (i in queue.length() - MAX_ITEMS until queue.length()) out.put(queue.get(i))
      out
    } else {
      queue
    }
    p.edit().putString(KEY_QUEUE, trimmed.toString()).apply()
  }

  /** Lấy toàn bộ rồi xoá hàng đợi */
  @Synchronized
  fun drain(context: Context): List<Map<String, Any>> {
    val p = prefs(context)
    val raw = p.getString(KEY_QUEUE, "[]") ?: "[]"
    val queue = try {
      JSONArray(raw)
    } catch (e: Exception) {
      JSONArray()
    }
    p.edit().remove(KEY_QUEUE).apply()
    val out = ArrayList<Map<String, Any>>(queue.length())
    for (i in 0 until queue.length()) {
      val o = queue.optJSONObject(i) ?: continue
      out.add(
        mapOf(
          "source" to o.optString("source"),
          "sender" to o.optString("sender"),
          "title" to o.optString("title"),
          "text" to o.optString("text"),
          "postedAt" to o.optLong("postedAt"),
        ),
      )
    }
    return out
  }
}
